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

DEFAULT_LISTEN_PORT = 8080

class App:
	def __init__(self, conf, loop, port=DEFAULT_LISTEN_PORT):
		self.log = logging.getLogger("galaxy.app")
		if conf.has_key("listen_port"):
			port = conf["listen_port"]
		self.port = port
		self.loop = loop
		self.conf = conf
		self._init_db()

		tornado_config = [
			(r"/search(.*)", SearchHandler, {"conf": conf, "loop": loop, "db": self.db }),
			(r"/inc/(.*)", StaticHandler, 
				dict(path=os.path.join(os.path.dirname(__file__), "inc"))),
			(r"/fonts/(.*)", StaticHandler, 
				dict(path=os.path.join(os.path.dirname(__file__), "inc"))),
			("/transcript", TranscriptHandler, dict(db=self.db)),
			("/tags", TagsHandler, dict(db=self.db)),
			("/favorites", FavoritesHandler, dict(db=self.db)),
			("/scopes", ScopesHandler, dict(db=self.db)),
			(r"/results/(.*)", SearchResultsHandler, dict(db=self.db)),
			("/", IndexHandler, 
				dict(filename=os.path.join(os.path.dirname(__file__), "inc/index.html"),
					mimetype="text/html"))
		]
		self.application = tornado.web.Application(tornado_config, debug=True)
		
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
	app = App(conf, tornado.ioloop.IOLoop.instance())
	app.start()