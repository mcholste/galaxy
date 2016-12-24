import os
import sys
import logging
import datetime
import zlib
import base64
import copy
import socket
import struct
import random
from functools import partial
from time import time

import ujson as json
import tornado.ioloop
import tornado.web
from tornado.httpclient import AsyncHTTPClient, HTTPRequest

from queryparser import Parser

def merge(src, dst):
	if dst == None:
		return src
	if type(src) == dict and type(dst) == dict:
		for k, v in src.iteritems():
			if type(v) is dict and dst.has_key(k):
				dst[k] = merge(v, dst[k])
			elif type(v) is list and dst.has_key(k):
				if len(v) == len(dst[k]):
					for i, item in enumerate(v):
						dst[k][i] = merge(item, dst[k][i])
				else:
					raise Exception("Cannot merge arrays of different length")
			elif type(v) is int or type(v) is float and dst.has_key(k):
				dst[k] += v
			else:
				dst[k] = v
	elif type(src) == int or type(src) == float:
		dst += src
	else:
		dst = src
	return dst

TORNADO_ROUTE = "(.+)"
DEFAULT_USER = "default"
DEFAULT_ALERT_INTERVAL = 60
DEFAULT_ALERT_THROTTLE = 0

class BaseHandler(tornado.web.RequestHandler):
	def initialize(self, conf,
		loop=tornado.ioloop.IOLoop.current()):
		self.io_loop = loop
		self.client = AsyncHTTPClient(self.io_loop)
		self.passthrough_node = "%s:%d" % (conf["fed"]["host"], conf["fed"]["port"])

	def __init__(self, application, request, **kwargs):
		super(BaseHandler, self).__init__(application, request, **kwargs)
	
	def _bad_request(self, error):
		self.set_status(400)
		self.write(json.dumps({"error": error}))
		self.finish()

	def passthrough(self, **kwargs):
		self.request.host = self.passthrough_node
		self.request.uri  = "/" + "/".join(self.request.uri.split("/")[2:])
		uri = self.request.full_url()
		req = HTTPRequest(uri,
			method=self.request.method, 
			body=self.request.body,
			headers=self.request.headers,
			follow_redirects=False,
			allow_nonstandard_methods=True
		)
		
		self.log.debug("Passing req through %r" % req.url)
		self.client.fetch(req, self.passthrough_callback, raise_error=False)

	def passthrough_callback(self, response):
		if (response.error and not
			isinstance(response.error, tornado.httpclient.HTTPError)):
			self.set_status(500)
			self.write('Internal server error:\n' + str(response.error))
		else:
			self.set_status(response.code, response.reason)
			self._headers = tornado.httputil.HTTPHeaders() # clear tornado default header

			for header, v in response.headers.get_all():
				if header not in ('Content-Length', 'Transfer-Encoding', 'Content-Encoding', 'Connection'):
					self.add_header(header, v) # some header appear multiple times, eg 'Set-Cookie'

			if response.body:                   
				self.set_header('Content-Length', len(response.body))
				self.write(response.body)
		self.finish()

	@tornado.web.asynchronous
	def put(self, uri):
		self.post(uri)

	@tornado.web.asynchronous
	def head(self, uri):
		self.post(uri)

	@tornado.web.asynchronous
	def post(self, uri):
		# Unless we explicitly want to intercept and federate, pass the req through
		#  to the first node listed in local_nodes conf
		
		self.passthrough()
			
	@tornado.web.asynchronous
	def get(self, uri):
		self.post(uri)		
	
	def _finish(self):
		self.set_header("Content-Type", "application/json")
		self.write(json.dumps(self.results))
		self.finish()

class SearchHandler(BaseHandler):
	def __init__(self, application, request, **kwargs):
		self.db = kwargs["db"]
		del kwargs["db"]
		super(SearchHandler, self).__init__(application, request, **kwargs)
		self.log = logging.getLogger("galaxy.search_handler")
		self.parser = Parser()
		self.ip_fields = frozenset(["srcip", "dstip", "ip"])
		

	def initialize(self, *args, **kwargs):
		super(SearchHandler, self).initialize(*args, **kwargs)
		self.user = DEFAULT_USER

	# Using the post() coroutine
	def get(self, uri):
		query_string = self.get_argument("q")
		es_query, parsed = self.parser.parse(query_string, self)
		self.log.debug("es_query: %r" % es_query)
		self.request.parsed = parsed
		self.request.es_query = es_query
		self.request.raw_query = query_string
		self.request.body = json.dumps(es_query)
		return self.post(uri)

	def compare_searches(self, curr):
		# See if the current search is similar enough to the previous to call them related
		prev = self.db.execute("SELECT * FROM transcript " +\
			"WHERE action='SEARCH' ORDER BY id DESC LIMIT 1").fetchone()
		if not prev:
			return None
		# Split the raw_query into whitespaced tokens and compare
		prev["data"] = json.loads(prev["data"])
		prev_tokens = set(prev["data"]["raw_query"].split())
		curr_tokens = set(curr["raw_query"].split())
		self.log.debug("prev: %r, curr: %r" % (prev_tokens, curr_tokens))
		if len(curr_tokens - prev_tokens) <= 2:
			return prev["id"]
		return None


	def fixup(self, body):
		body = json.loads(body)
		self.log.debug("body: %r" % body)
		self.log.debug("parsed: %r" % self.request.parsed)
		if body.has_key("hits"):
			for hit in body["hits"]["hits"]:
				hit["_source"]["orig_@timestamp"] = hit["_source"]["@timestamp"]
				hit["_source"]["@timestamp"] = datetime.datetime.fromtimestamp(int(hit["_source"]["@timestamp"])/1000).isoformat()
		if body.has_key("aggregations"):
			for rawfield, buckethash in body["aggregations"].iteritems():
				fields = rawfield.split(",")
				ipfields = []
				for i, field in enumerate(fields):
					if field in self.ip_fields:
						ipfields.append(i)
				self.log.debug("rawfield: %s, ipfields: %r" % (rawfield, ipfields))
				
				for bucket in buckethash["buckets"]:
					if bucket.has_key("key_as_string"):
						values = [ bucket["key_as_string"] ]
					else:
						values = str(bucket["key"]).split("\t")
					newvalues = []
					for i, value in enumerate(values):
						if i in ipfields and "." not in value:
							newvalues.append(socket.inet_ntoa(struct.pack("!I", int(value))))
						else:
							newvalues.append(value)
					bucket["keys"] = newvalues
					bucket["key"] = "-".join(newvalues)
		
		# Build desc
		desc = self.request.es_query["query"]["bool"]["must"][0]["query"]["query_string"]["query"]
		if self.request.parsed.has_key("groupby"):
			desc += " (" + ",".join(self.request.parsed["groupby"][1:]) + ")"
		desc = "[%d] " % body.get("hits", {}).get("total", 0) + desc

		body = {
			"results": body,
			"query": self.request.parsed,
			"raw_query": self.request.raw_query,
			"es_query": self.request.es_query,
			"description": desc
		}
		
		return body

	def record(self, body):
		data = {
			"raw_query": self.request.raw_query,
			"query": self.request.parsed,
			"es_query": self.request.es_query
		}

		scope_id = self.get_argument("scope_id", None)
		if scope_id:
			scope_id = int(scope_id)
			body["scope_id"] = scope_id
		ref_id = self.get_argument("ref_id", None)
		if ref_id:
			body["ref_id"] = data["ref_id"] = int(ref_id)
		elif scope_id:
			body["ref_id"] = data["ref_id"] = int(scope_id)
		else:
			body["ref_id"] = data["ref_id"] = self.compare_searches(data)
			self.log.debug("ref_id: %r" % body["ref_id"])
			row = self.db.execute("SELECT data FROM transcript WHERE id=?", 
				(body["ref_id"],)).fetchone()
			# if row:
			# 	self.log.debug("row: %r" % row)
			# 	body["referenced_search_description"] = json.loads(row["data"])["raw_query"]

		
		if not scope_id:
			scope_id = self.db.execute("SELECT id FROM scopes WHERE scope=?", 
				("default",)).fetchone()["id"]
				
		# Log to results
		self.db.execute("INSERT INTO results (user_id, results, timestamp) " +\
			"VALUES ((SELECT id FROM users WHERE user=?),?,?)", 
			(DEFAULT_USER, base64.encodestring(zlib.compress(json.dumps(body))), time()))
		id = self.db.execute("SELECT id FROM results " +\
			"WHERE user_id=(SELECT id FROM users WHERE user=?) " +\
			"ORDER BY id DESC LIMIT 1", (self.user,)).fetchone()
		body["results_id"] = id["id"]

		self.db.execute("INSERT INTO transcript (user_id, action, data, description, " + \
			"ref_id, scope_id, results_id, timestamp) " +\
			"VALUES ((SELECT id FROM users WHERE user=?),?,?,?,?,?,?,?)",
			(self.user, "SEARCH", json.dumps(data), body["description"], 
				body["ref_id"], scope_id, id["id"], time()))
		newid = self.db.execute("SELECT id FROM transcript " +\
			"ORDER BY timestamp DESC LIMIT 1").fetchone()
		body["transcript_id"] = newid["id"]

		return body


	@tornado.web.gen.coroutine
	def post(self, uri):
		# Unless we explicitly want to intercept and federate, pass the req through
		#  to the first node listed in local_nodes conf
		
		# query = self.request.get_argument("q", default=None)
		# if not query:
		# 	return self._bad_request("No q param given for query.")


		self.request.host = self.passthrough_node
		self.request.uri  = "/es/_search"
		uri = self.request.full_url()
		req = HTTPRequest(uri,
			method=self.request.method, 
			body=self.request.body,
			headers=self.request.headers,
			follow_redirects=False,
			allow_nonstandard_methods=True
		)
		
		self.log.debug("Passing req through %r" % req.url)
		response = yield self.client.fetch(req, raise_error=False)
		self.log.debug("got response: %r" % response)
		if (response.error and not
			isinstance(response.error, tornado.httpclient.HTTPError)):
			self.set_status(500)
			self.write('Internal server error:\n' + str(response.error))
		else:
			self.set_status(response.code, response.reason)
			self._headers = tornado.httputil.HTTPHeaders() # clear tornado default header

			for header, v in response.headers.get_all():
				if header not in ('Content-Length', 'Transfer-Encoding', 'Content-Encoding', 'Connection'):
					self.add_header(header, v) # some header appear multiple times, eg 'Set-Cookie'

			if response.body:
				# Apply any last minute field translations
				fixedup_body = self.fixup(response.body)
				fixedup_body = self.record(fixedup_body)
				fixedup_body = json.dumps(fixedup_body)
				self.set_header('Content-Length', len(fixedup_body))
				self.write(fixedup_body)
		self.finish()

class BaseWebHandler(tornado.web.RequestHandler):
	def __init__(self, *args, **kwargs):
		super(BaseWebHandler, self).__init__(*args, **kwargs)

	def initialize(self, *args, **kwargs):
		super(BaseWebHandler, self).initialize()
		self.log = logging.getLogger("galaxy.web.handler")
		self.user = DEFAULT_USER
		self.set_status(200)
		self.set_header("Content-Type", "application/javascript")

class IndexHandler(BaseWebHandler):
	def initialize(self, filename, mimetype="text/html"):
		super(IndexHandler, self).initialize()
		self.filename = filename
		self.mimetype = mimetype

	def get(self):
		self.set_header("Content-Type", self.mimetype)
		self.write(open(self.filename).read())

class StaticHandler(BaseWebHandler):
	def __init__(self, *args, **kwargs):
		super(StaticHandler, self).__init__(*args, **kwargs)
		self.mimemap = {
			"css": "text/css",
			"html": "text/html",
			"js": "application/javascript",
			"map": "application/javascript",
			"png": "image/png",
			"woff": "application/octet-stream",
			"woff2": "application/octet-stream",
			"jpg": "image/jpeg"
		}

	def initialize(self, path, mimetype="application/javascript"):
		super(StaticHandler, self).initialize()
		self.content_dir = path
		self.mimetype = mimetype

	def get(self, path):
		extension = path.split(".")[-1]
		self.mimetype = self.mimemap[extension]
		self.set_header("Content-Type", self.mimetype)
		self.write(open(self.content_dir + "/" + path).read())

class BackgroundHandler(StaticHandler):
	def __init__(self, *args, **kwargs):
		super(BackgroundHandler, self).__init__(*args, **kwargs)
		
	def initialize(self, *args, **kwargs):
		#super(BackgroundHandler, self).initialize(*args, **kwargs)
		self.backgrounds = kwargs["backgrounds"]
		
	def get(self):
		id = int(self.get_argument("t", 0))
		background = self.backgrounds[ id % len(self.backgrounds) ]
		print background
		extension = background.split(".")[-1]
		self.mimetype = self.mimemap[extension]
		self.set_header("Content-Type", self.mimetype)
		self.set_header("Cache-Control", "no-cache")
		self.write(open(background).read())

class TranscriptHandler(BaseWebHandler):
	def __init__(self, application, request, **kwargs):
		super(TranscriptHandler, self).__init__(application, request, **kwargs)
		self.log = logging.getLogger("galaxy.transcript_handler")
		self.db = kwargs["db"]


	def initialize(self, *args, **kwargs):
		super(TranscriptHandler, self).initialize(*args, **kwargs)

	def get(self):
		user = DEFAULT_USER
		req_id = self.get_argument("id", None)
		if req_id:
			needed_row = self.db.execute(
				"SELECT a.*, b.description AS referenced_search_description, " +\
				"c.scope, c.category, c.search AS scope_search " +\
				"FROM transcript AS a " +\
				"LEFT JOIN transcript AS b ON a.ref_id=b.id " +\
				"LEFT JOIN scopes AS c ON a.scope_id=c.id " +\
				"WHERE a.user_id=(SELECT id FROM users WHERE user=?) AND a.id=?",
				(user, req_id)).fetchone()
			self.write(json.dumps(needed_row))
			return
		limit = self.get_argument("limit", 50)
		self.set_status(200)
		self.set_header("Content-Type", "application/javascript")
		rows = self.db.execute(
			"SELECT a.*, b.description AS referenced_search_description, " +\
			"c.scope, c.category, c.search AS scope_search " +\
			"FROM transcript AS a " +\
			"LEFT JOIN transcript AS b ON a.ref_id=b.id " +\
			"LEFT JOIN scopes AS c ON a.scope_id=c.id " +\
			"WHERE a.user_id=(SELECT id FROM users WHERE user=?) AND a.visible=1 " +\
			"ORDER BY a.id DESC LIMIT ?", (user, limit)).fetchall()
		self.write(json.dumps(rows))

	def put(self):
		user = DEFAULT_USER
		action = self.get_argument("action")
		rawdata = self.get_argument("data", None)
		if rawdata:
			try:
				data = json.loads(rawdata)
			except Exception as e:
				self.log.exception("Error parsing JSON from %s" % data, exc_info=e)
				self.set_status(400)
				self.write("data param must be in JSON format")
				return
		description = self.get_argument("description", None)
		results_id = self.get_argument("results_id", None)
		ref_id = self.get_argument("ref_id", None)
		scope_id = self.get_argument("scope_id", None)
		self.log.debug("user: %s, action: %s, data: %s, description: %s, results_id: %s" %\
			(user, action, rawdata, description, results_id))
		if not scope_id and action != "SCOPE":
			# Get default scope ID
			scope_id = self.db.execute("SELECT id FROM scopes " +\
				"WHERE user_id=(SELECT id FROM users where user=?) AND scope=?",
				(user, "default")).fetchone()["id"]

		user_id = self.db.execute("SELECT id FROM users WHERE user=?", (user,)).fetchone()["id"]
		
		if action == "TAG":
			tag = data["tag"]
			value = data["value"]
			if not self.db.execute("INSERT INTO tags (user_id, tag, value, timestamp) " +\
				"VALUES (?,?,?,?)",
				(user_id, tag, value, time())).rowcount:
				self.set_status(400)
				self.write("Error tagging value")
				return
			self.log.debug("New tag %d %s=%s" % (user_id, tag, value))
		elif action == "FAVORITE":
			value = data["value"]
			if not self.db.execute("INSERT INTO favorites (user_id, value, timestamp) " +\
				"VALUES (?,?,?)",
				(user_id, value, time())).rowcount:
				self.set_status(400)
				self.write("Error setting favorite value")
				return
			self.log.debug("New favorite %d %s" % (user_id, value))
		elif action == "NOTE":
			note = data["note"]
			value = data["value"]
			if not self.db.execute("INSERT INTO notes (user_id, note, value, timestamp) " +\
				"VALUES (?,?,?,?)",
				(user_id, note, value, time())).rowcount:
				self.set_status(400)
				self.write("Error setting favorite value")
				return
			self.log.debug("New favorite %d %s" % (user_id, value))
		elif action == "SCOPE" and not scope_id:
			value = data["value"]
			search = data.get("search", None)
			category = data.get("category", None)
			scope_id = self.db.execute("SELECT * FROM scopes WHERE user_id=? AND scope=?",
				(user_id, value)).fetchone().get("id")
			self.log.debug("found scope_id: %d" % scope_id)
			if not scope_id:
				scope_id = self.db.execute("INSERT INTO scopes (user_id, scope, " +\
				"category, search, created) " +\
				"VALUES (?,?,?,?,?)",
				(user_id, value, category, search, time())).lastrowid
			self.log.debug("New scope %d %d %s" % (scope_id, user_id, value))

		if results_id:
			self.db.execute("INSERT INTO transcript (user_id, action, data, " +\
				"description, ref_id, scope_id, results_id, timestamp) " +\
				"VALUES ((SELECT id FROM users WHERE user=?),?,?,?,?,?,?,?)",
				(user, action, rawdata, description, ref_id, scope_id, results_id, time()))
		else:
			self.db.execute("INSERT INTO transcript (user_id, action, data, " +\
			"description, ref_id, scope_id, timestamp) VALUES " + \
			"((SELECT id FROM users WHERE user=?),?,?,?,?,?,?)",
			(user, action, rawdata, description, ref_id, scope_id, time()))
		newid = self.db.execute("SELECT * FROM transcript " +\
			"ORDER BY id DESC LIMIT 1").fetchone()

		self.set_status(200)
		self.set_header("Content-Type", "application/javascript")
		self.write(newid)

	def post(self):
		user = DEFAULT_USER
		action = self.get_argument("action")
		id = self.get_argument("id")
		self.log.debug("user: %s, action: %s, id: %s" % (user, action, id))
		if action == "HIDE":
			changed = self.db.execute("UPDATE transcript SET visible=0 " +\
				"WHERE user_id=(SELECT id FROM users WHERE user=?) " +\
				"AND id=?", (user, id)).rowcount
			if not changed:
				self.set_status(400)
				self.write("Bad request, unknown user or id")
				return	
		else:
			self.set_status(400)
			self.write("Bad request, unknown action")
			return

		self.set_status(200)
		self.set_header("Content-Type", "application/javascript")
		self.write({"action": action, "id": id, "status": "ok"})

class SearchResultsHandler(BaseWebHandler):
	def __init__(self, application, request, **kwargs):
		super(SearchResultsHandler, self).__init__(application, request, **kwargs)
		self.log = logging.getLogger("galaxy.search_result_handler")
		self.db = kwargs["db"]


	def initialize(self, *args, **kwargs):
		super(SearchResultsHandler, self).initialize(*args, **kwargs)

	def get(self, id):
		user = DEFAULT_USER
		try:
			id = int(id)
		except Exception as e:
			self.log.exception("Failed to parse id", exc_info=e)
			self.set_status(400)
			self.write("Invalid id")
			self.finish()
			return
		result = self.db.execute("SELECT * FROM results " +\
			"WHERE user_id=(SELECT id FROM users WHERE user=?) AND id=?", 
			(user, id)).fetchone()
		if not result:
			self.set_status(404)
			self.finish()
			return
		# ret = {
		# 	"id": result["id"],
		# 	"timestamp": result["timestamp"],
		# 	"results": json.loads(zlib.decompress(base64.decodestring(result["results"])))
		# }
		self.set_status(200)
		self.set_header("Content-Type", "application/javascript")
		self.write(zlib.decompress(base64.decodestring(result["results"])))
		# self.write(json.dumps(ret))

class TagsHandler(BaseWebHandler):
	def __init__(self, application, request, **kwargs):
		super(TagsHandler, self).__init__(application, request, **kwargs)
		self.log = logging.getLogger("galaxy.tags_handler")
		self.db = kwargs["db"]


	def initialize(self, *args, **kwargs):
		super(TagsHandler, self).initialize(*args, **kwargs)

	def get(self):
		user = DEFAULT_USER
		limit = self.get_argument("limit", 50)
		self.set_status(200)
		self.set_header("Content-Type", "application/javascript")
		self.write(json.dumps(self.db.execute("SELECT * FROM tags " +\
			"WHERE user_id=(SELECT id FROM users WHERE user=?) " +\
			"ORDER BY timestamp DESC LIMIT ?", (user, limit)).fetchall()))

	def delete(self):
		user = DEFAULT_USER
		tag = self.get_argument("tag")
		value = self.get_argument("value")
		self.set_status(200)
		self.set_header("Content-Type", "application/javascript")
		self.write(json.dumps({"ok": self.db.execute("DELETE FROM tags " +\
			"WHERE user_id=(SELECT id FROM users WHERE user=?) " +\
			"AND tag=? AND value=?", (user, tag, value)).rowcount}))

class FavoritesHandler(BaseWebHandler):
	def __init__(self, application, request, **kwargs):
		super(FavoritesHandler, self).__init__(application, request, **kwargs)
		self.log = logging.getLogger("galaxy.favorites_handler")
		self.db = kwargs["db"]


	def initialize(self, *args, **kwargs):
		super(FavoritesHandler, self).initialize(*args, **kwargs)

	def get(self):
		user = DEFAULT_USER
		limit = self.get_argument("limit", 50)
		self.set_status(200)
		self.set_header("Content-Type", "application/javascript")
		self.write(json.dumps(self.db.execute("SELECT * FROM favorites " +\
			"WHERE user_id=(SELECT id FROM users WHERE user=?) " +\
			"ORDER BY timestamp DESC LIMIT ?", (user, limit)).fetchall()))

	def delete(self):
		user = DEFAULT_USER
		value = self.get_argument("value")
		self.set_status(200)
		self.set_header("Content-Type", "application/javascript")
		self.write(json.dumps({"ok": self.db.execute("DELETE FROM favorites " +\
			"WHERE user_id=(SELECT id FROM users WHERE user=?) " +\
			"AND value=?", (user, value)).rowcount}))

class ScopesHandler(BaseWebHandler):
	def __init__(self, application, request, **kwargs):
		super(ScopesHandler, self).__init__(application, request, **kwargs)
		self.log = logging.getLogger("galaxy.scopes_handler")
		self.db = kwargs["db"]

	def initialize(self, *args, **kwargs):
		super(ScopesHandler, self).initialize(*args, **kwargs)

	def get(self):
		user = DEFAULT_USER
		limit = self.get_argument("limit", 50)
		self.set_status(200)
		self.set_header("Content-Type", "application/javascript")
		rows = self.db.execute("SELECT * FROM scopes " +\
			"WHERE user_id=(SELECT id FROM users WHERE user=?) " +\
			"ORDER BY created DESC LIMIT ?", (user, limit)).fetchall()
		ret = {}
		for row in rows:
			if not ret.has_key(row["category"]):
				ret[ row["category"] ] = {}
			ret[ row["category"] ][ row["scope"] ] = row["search"]
		self.log.debug('ret: %r' % ret)
		self.write(json.dumps(ret))

	def delete(self):
		user = DEFAULT_USER
		value = self.get_argument("value")
		self.set_status(200)
		self.set_header("Content-Type", "application/javascript")
		self.write(json.dumps({"ok": self.db.execute("DELETE FROM favorites " +\
			"WHERE user_id=(SELECT id FROM users WHERE user=?) " +\
			"AND value=?", (user, value)).rowcount}))

class AlertGetterHandler(BaseWebHandler):
	def __init__(self, application, request, **kwargs):
		super(AlertGetterHandler, self).__init__(application, request, **kwargs)
		self.log = logging.getLogger("galaxy.alert_getter_handler")
		self.db = kwargs["db"]

	def initialize(self, *args, **kwargs):
		super(AlertGetterHandler, self).initialize(*args, **kwargs)
		self.user = DEFAULT_USER
		self.set_status(200)
		self.set_header("Content-Type", "application/javascript")

	def get(self):
		limit = self.get_argument("limit", 50)
		offset = self.get_argument("offset", 0)
		rows = self.db.execute("SELECT * FROM alerts " +\
			"WHERE user_id=(SELECT id FROM users WHERE user=?) " +\
			"ORDER BY created DESC LIMIT ?,?", (self.user, offset, limit)).fetchall()
		self.write(json.dumps(rows))

	def put(self):
		# params = json.loads(self.request.body)
		# query = params["query"]
		# title = params["title"]
		query = self.get_argument("query")
		title = self.get_argument("title")
		interval = self.get_argument("interval", DEFAULT_ALERT_INTERVAL)
		throttle = self.get_argument("throttle", DEFAULT_ALERT_THROTTLE)
		id = self.db.execute("INSERT INTO alerts (user_id, title, query, created, interval, throttle) " +\
			"VALUES((SELECT id FROM users WHERE user=?),?,?,?,?,?)",
			(self.user, title, query, time(), interval, throttle)).lastrowid
		self.write(json.dumps(
			self.db.execute("SELECT * FROM alerts WHERE id=?", (id,)).fetchone()
		))

class AlertManagementHandler(BaseWebHandler):
	def __init__(self, application, request, **kwargs):
		super(AlertManagementHandler, self).__init__(application, request, **kwargs)
		self.log = logging.getLogger("galaxy.alert_management_handler")
		self.db = kwargs["db"]

	def initialize(self, *args, **kwargs):
		super(AlertManagementHandler, self).initialize(*args, **kwargs)
		self.log.debug("args: %r, kwargs: %r" % (args, kwargs))
		self.user = DEFAULT_USER
		self.set_status(200)
		self.set_header("Content-Type", "application/javascript")

	def _prepare(self, args):
		self.log.debug("type args: %s" % type(args))
		self.log.debug("args: %r" % args)
		self.id = int(args[0])
		if len(args) > 1:
			self.field = args[1]

	def get(self, *args):
		self._prepare(*args)
		self.write(json.dumps(
			self.db.execute("SELECT * FROM alerts WHERE user_id=" +\
			"(SELECT id FROM users WHERE user=?) and id=?",
			(self.user, self.id)).fetchone()
		))

	def delete(self, *args):
		self._prepare(*args)
		self.write(json.dumps(
			{
				"ok": self.db.execute("DELETE FROM alerts " +\
					"WHERE user_id=(SELECT id FROM users WHERE user=?) " +\
					"AND id=?", (self.user, self.id)).rowcount
			}
		))

	def post(self, *args):
		self._prepare(list(args))
		if not self.field or \
			self.field not in ["throttle", "active", "title", "query", "interval"]:
			self._bad_request("Invalid field")
			return;
		value = self.get_argument("value")
		if not value:
			self._bad_request("No value.")
			return
		if self.field in ["throttle", "active", "interval"]:
			try:
				value = int(value)
			except:
				self._bad_request("Invalid value, must be numeric.")
				return

		#params = json.loads(self.request.body)
		self.db.execute(("UPDATE alerts SET %s=?, updated=? WHERE id=? AND user_id=" +\
			"(SELECT id FROM users WHERE user=?)") % self.field, (value, time(), self.id, self.user))
		self.write(json.dumps(
			self.db.execute("SELECT * FROM alerts WHERE id=? AND user_id=" +\
				"(SELECT id FROM users WHERE user=?)", (self.id, self.user)).fetchone()
		))


class NotificationsHandler(BaseWebHandler):
	def __init__(self, application, request, **kwargs):
		super(NotificationsHandler, self).__init__(application, request, **kwargs)
		self.log = logging.getLogger("galaxy.notifications_handler")
		self.db = kwargs["db"]

	def get(self):
		limit = self.get_argument("limit", 50)
		inactive = self.get_argument("all", None)
		clause = "active=1"
		if inactive:
			clause = "1=1"
		query = ("SELECT * FROM notifications " +\
			"WHERE %s AND user_id=(SELECT id FROM users WHERE user=?) " +\
			"ORDER BY timestamp DESC LIMIT ?") % clause
		self.write(json.dumps(self.db.execute(query, (self.user, limit)).fetchall()))

	def delete(self):
		id = int(self.get_argument("id"))
		self.write(json.dumps({"ok": self.db.execute("UPDATE notifications " +\
			"SET active=0 WHERE user_id=(SELECT id FROM users WHERE user=?) " +\
			"AND id=?", (user, id)).rowcount}))
		

