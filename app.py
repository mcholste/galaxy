import os
import sys
import logging
import importlib
import sqlite3

from time import time

import ujson as json
import tornado.ioloop
import tornado.web

sys.path.insert(1, sys.path[0] + "/lib")
from handlers import *
from alerts import *

DEFAULT_LISTEN_PORT = 8080
MIN_ALERT_TIME = 6

class App:
	def __init__(self, conf, loop, port=DEFAULT_LISTEN_PORT):
		self.log = logging.getLogger("galaxy.app")
		if conf.has_key("listen_port"):
			port = conf["listen_port"]
		self.port = port
		self.loop = loop
		self.conf = conf
		self._init_db()

		backgrounds = []
		background_dir = os.path.join(os.path.dirname(__file__), "inc/backgrounds")
		for dir in os.walk(background_dir):
			for filename in dir[2]:
				backgrounds.append(os.path.join(background_dir, filename))

		tornado_config = [
			(r"/search(.*)", SearchHandler, {"conf": conf, "loop": loop, "db": self.db }),
			(r"/inc/(.*)", StaticHandler, 
				dict(path=os.path.join(os.path.dirname(__file__), "inc"))),
			(r"/fonts/(.*)", StaticHandler, 
				dict(path=os.path.join(os.path.dirname(__file__), "inc"))),
			(r"/background", BackgroundHandler, dict(backgrounds=backgrounds)),
			("/transcript", TranscriptHandler, dict(db=self.db)),
			("/tags", TagsHandler, dict(db=self.db)),
			("/favorites", FavoritesHandler, dict(db=self.db)),
			("/scopes", ScopesHandler, dict(db=self.db)),
			("/notifications", NotificationsHandler, dict(db=self.db)),
			(r"/alerts/(\d+)(?:/(\w+))?", AlertManagementHandler, dict(db=self.db)),
			("/alerts", AlertGetterHandler, dict(db=self.db)),
			(r"/results/(.*)", SearchResultsHandler, dict(db=self.db)),
			("/", IndexHandler, 
				dict(filename=os.path.join(os.path.dirname(__file__), "inc/index.html"),
					mimetype="text/html"))
		]
		self.application = tornado.web.Application(tornado_config, debug=True)

		# Add on periodic jobs
		# Alerting
		self.runner = AlertRunner(self.conf)
		self.periodic = tornado.ioloop.PeriodicCallback(self.process_alerts, 
			MIN_ALERT_TIME * 1000, io_loop=loop)
		#self.loop.handle_callback_exception(self._callback_error)
		self.periodic.start()
		self.log.debug("periodic: %s" % self.periodic.is_running())

	def _callback_error(self, *args, **kwargs):
		self.log.error("args: %r, kwargs: %r" % (args, kwargs))
		self.log.exception("exception", exc_info=sys.exc_info)
	
	@tornado.web.gen.coroutine
	def process_alerts(self):
		self.log.debug("Processing alerts...")
		try:
			# self.db.execute("UPDATE alerts SET active=0 WHERE id IN " +\
			# 	"(SELECT COUNT(*) AS count, id FROM alerts WHERE ")
			
			for alert in self.db.execute("SELECT * FROM alerts WHERE active=1 " +\
				"AND (last_run IS NULL OR (last_run + interval) < ?)", (time(),)).fetchall():
				alert["query"] = json.loads(alert["query"])
				self.log.debug("Running alert %r" % alert)
				start = time()
				result = yield self.runner.run_alert(alert)
				#result = self.runner.run_alert_sync(alert)
				if type(result) is tornado.web.HTTPError:
					self.log.error(result["error"])
					continue
				result = json.loads(result.body)
				now = time()
				self.log.debug("Ran alert query in %f seconds" % (now - start))
				self.db.execute("UPDATE alerts SET last_run=? WHERE id=?", (now, alert["id"]))
				if result and result.has_key("hits") and result["hits"].has_key("hits") and\
					result["hits"]["hits"]:
					num_hits = len(result["hits"]["hits"])
					self.log.debug("Got %d hits on alert %s" % (num_hits, alert["title"]))
					result_id = self.db.execute("INSERT INTO results (user_id, results, timestamp) " +\
						"VALUES (?,?,?)", (alert["user_id"], json.dumps(result), now)).lastrowid
					alert_result_id = self.db.execute("INSERT INTO alert_results " +\
						"(alert_id, hits, result_id) " +\
						"VALUES(?,?,?)", (alert["id"], num_hits, result_id)).lastrowid
					self.db.execute("INSERT INTO notifications (user_id, type, message, " +\
						"alert_result_id, timestamp) VALUES(?,?,?,?,?)", 
						(alert["user_id"], "alert", 
							alert["title"] + (" %d hits" % num_hits), alert_result_id, now))
				else:
					self.log.debug("Result did not have hits, not recording.")
		except Exception as e:
			self.log.exception("Error running alerts", exc_info=e)
		
	def start(self):
		self.application.listen(self.port)
		self.loop.start()

	def _init_db(self):
		self.db = sqlite3.Connection("%s/galaxy.db" % self.conf.get("db_path", "/tmp"))
		# Set autocommit
		self.db.isolation_level = None
		
		def dict_factory(cursor, row):
			d = {}
			for idx, col in enumerate(cursor.description):
				d[col[0]] = row[idx]
			return d
		self.db.row_factory = dict_factory
		self.db = self.db.cursor()

		self.log.debug("Ensuring database tables exists")

		self.db.execute("""
CREATE TABLE IF NOT EXISTS users (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user TEXT UNIQUE
)
""")
		self.db.execute("INSERT OR IGNORE INTO users (user) VALUES (?)", (DEFAULT_USER,))
		self.db.execute("""
CREATE TABLE IF NOT EXISTS transcript (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id INTEGER,
	action TEXT,
	data TEXT,
	description TEXT,
	ref_id INTEGER,
	scope_id INTEGER,
	results_id INTEGER,
	timestamp INTEGER,
	visible INTEGER NOT NULL DEFAULT 1,
	FOREIGN KEY (user_id) REFERENCES users (id),
	FOREIGN KEY (ref_id) REFERENCES transcript (id),
	FOREIGN KEY (results_id) REFERENCES results (id),
	FOREIGN KEY (scope_id) REFERENCES scopes (id)
)
""")
		self.db.execute("""
CREATE INDEX IF NOT EXISTS timestamp ON transcript (timestamp)
""")
		self.db.execute("""
CREATE INDEX IF NOT EXISTS user_id_action ON transcript (user_id, action)
""")
		self.db.execute("""
CREATE TABLE IF NOT EXISTS results (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id INTEGER,
	results BLOB,
	timestamp INTEGER,
	FOREIGN KEY (user_id) REFERENCES users (id)
)
""")
		self.db.execute("""
CREATE TABLE IF NOT EXISTS tags (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id INTEGER,
	tag TEXT,
	value TEXT,
	timestamp INTEGER,
	UNIQUE (user_id, tag, value) ON CONFLICT IGNORE,
	FOREIGN KEY (user_id) REFERENCES users (id)
)""")
		self.db.execute("""
CREATE TABLE IF NOT EXISTS favorites (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id INTEGER,
	value TEXT,
	timestamp INTEGER,
	UNIQUE (user_id, value) ON CONFLICT IGNORE,
	FOREIGN KEY (user_id) REFERENCES users (id)
)""")
		self.db.execute("""
CREATE TABLE IF NOT EXISTS notes (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id INTEGER,
	note TEXT,
	value TEXT,
	timestamp INTEGER,
	FOREIGN KEY (user_id) REFERENCES users (id)
)""")
		self.db.execute("""
CREATE TABLE IF NOT EXISTS scopes (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id INTEGER,
	scope TEXT,
	search TEXT,
	category TEXT,
	created INTEGER,
	UNIQUE (user_id, scope) ON CONFLICT IGNORE,
	FOREIGN KEY (user_id) REFERENCES users (id)
)""")
		scopes = {
			"default": {
				"default": ""
			},
			"Network connections seen by Bro (session data)": {
				"Top Services": "class=bro_conn | groupby service",
				"Port 53 groupby Service": "class=bro_conn AND dstport=53 | groupby service"
			},
			"DHCP transactions seen by Bro": {
				"Top Assigned IPs": "class:bro_dhcp AND 68 | groupby assigned_ip"
			},
			"DNP3 traffic seen by Bro": {
				"SRC IPs": "class:bro_dnp3 | groupby srcip"
			},
			"DNS transactions seen by Bro": {
				"Clients": "class:bro_dns AND dstport=53 | groupby srcip"
			},
			"Files transferred via network seen by Bro": {
				"MIME Types": "class:bro_files | groupby mimetype"
			}
		}
		for category in scopes.keys():
			for scope, search in scopes[category].iteritems():
				self.db.execute("""
INSERT OR IGNORE INTO scopes (user_id, category, scope, search, created) 
VALUES ((SELECT id FROM users WHERE user=?),?,?,?,?)
""", (DEFAULT_USER, category, scope, search, time()))

		self.db.execute("""
CREATE TABLE IF NOT EXISTS alerts (
	id INTEGER PRIMARY KEY,
	user_id INTEGER,
	title TEXT,
	query TEXT,
	created INTEGER NOT NULL,
	updated INTEGER,
	interval INTEGER NOT NULL DEFAULT 60,
	last_run INTEGER,
	throttle INTEGER NOT NULL DEFAULT 0,
	active INTEGER NOT NULL DEFAULT 1,
	FOREIGN KEY (user_id) REFERENCES users (id)
)""")
		self.db.execute("""
CREATE TABLE IF NOT EXISTS alert_results (
	id INTEGER PRIMARY KEY,
	alert_id INTEGER,
	result_id INTEGER,
	hits INTEGER NOT NULL,
	FOREIGN KEY (alert_id) REFERENCES alerts (id),
	FOREIGN KEY (result_id) REFERENCES results (id)
)""")
		self.db.execute("""
CREATE TABLE IF NOT EXISTS notifications (
	id INTEGER PRIMARY KEY,
	user_id INTEGER,
	type TEXT,
	message TEXT,
	timestamp INTEGER NOT NULL,
	active INTEGER NOT NULL DEFAULT 1,
	alert_result_id INTEGER,
	FOREIGN KEY (user_id) REFERENCES users (id)
)""")
		self.db.execute("""
CREATE INDEX IF NOT EXISTS active ON notifications (user_id, active)
""")
		
if __name__ == "__main__":
	logging.basicConfig()
	log = logging.getLogger()
	log.setLevel(logging.DEBUG)
	conf = {
		"fed": {
			"host": "localhost",
			"port": 8888
		},
		"db_path": "/tmp"
	}
	if len(sys.argv) > 1:
		conf = json.load(open(sys.argv[1]))
	app = App(conf, tornado.ioloop.IOLoop.current())
	app.start()