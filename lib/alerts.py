import os
import sys
import logging
from time import time

import ujson as json
import tornado.ioloop
from tornado.web import gen
from tornado.httpclient import AsyncHTTPClient, HTTPClient, HTTPRequest

class AlertRunner(object):

	def __init__(self, conf):
		self.log = logging.getLogger("galaxy.alert_runner")
		self.client = AsyncHTTPClient()
		#self.client = HTTPClient()
		self.passthrough_node = "%s:%d" % (conf["fed"]["host"], conf["fed"]["port"])

	@gen.coroutine
	def run_alert(self, alert):
		es_query = alert["query"]["es_query"]
		self.log.debug("es_query: %r" % es_query)
		# Adjust time
		start = alert["last_run"]
		if not start:
			start = time() - alert["interval"]
		try:
			for i, f in enumerate(es_query["query"]["bool"]["filter"]):
				if f.has_key("range") and f["range"].has_key("@timestamp"):
					time_filter = es_query["query"]["bool"]["filter"][i]["range"]["@timestamp"]
					time_filter["gte"] = int(start * 1000)
					del time_filter["lte"]
		except KeyError:
			if es_query.has_key("query") and es_query["query"].has_key("bool") and\
				es_query["query"]["bool"].has_key("filter"):
				es_query["query"]["bool"]["filter"]["range"] = {
					"@timestamp": {
						"gte": int(start * 1000)
					}
				}
			else:
				raise gen.Return({"error": "Query does not support specific times."})

		self.log.debug("Running query %s" % json.dumps(alert["query"]["es_query"]))
		req = HTTPRequest("http://" + self.passthrough_node + "/es/_search",
			method="POST",
			body=json.dumps(alert["query"]["es_query"])
		)
		response = yield self.client.fetch(req, raise_error=False)
		self.log.debug("response: %r" % response)
		self.log.debug("body: %s" % response.body)
		raise gen.Return(response)


	def run_alert_sync(self, alert):
		es_query = alert["query"]["es_query"]
		self.log.debug("es_query: %r" % es_query)
		# Adjust time
		start = alert["last_run"]
		if not start:
			start = time() - alert["interval"]
		try:
			for i, f in enumerate(es_query["query"]["bool"]["filter"]):
				if f.has_key("range") and f["range"].has_key("@timestamp"):
					time_filter = es_query["query"]["bool"]["filter"][i]["range"]["@timestamp"]
					time_filter["gte"] = int(start * 1000)
					del time_filter["lte"]
		except KeyError:
			if es_query.has_key("query") and es_query["query"].has_key("bool") and\
				es_query["query"]["bool"].has_key("filter"):
				es_query["query"]["bool"]["filter"]["range"] = {
					"@timestamp": {
						"gte": int(start * 1000)
					}
				}
			else:
				return {"error": "Query does not support specific times."}

		self.log.debug("Running query %s" % json.dumps(alert["query"]["es_query"]))
		req = HTTPRequest("http://" + self.passthrough_node + "/es/_search",
			method="POST",
			body=json.dumps(alert["query"]["es_query"])
		)
		response = self.client.fetch(req, raise_error=False)
		self.log.debug("resp: %r" % response)
		return response