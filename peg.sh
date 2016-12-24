curl https://raw.githubusercontent.com/mcholste/pulsar/master/conf/es_config/elasticsearch.yml > /tmp/elasticsearch.yml &&\
docker pull elasticsearch:2.4 &&\
docker run -d --name es -v /tmp/elasticsearch.yml:/usr/share/elasticsearch/config/elasticsearch.yml elasticsearch:2.4 &&\
docker pull mcholste/pulsar &&\
docker run -d --name pulsar --link es:es -p 514:514 mcholste/pulsar &&\
docker pull mcholste/fed &&\
echo '{"datasources":{"es":{"local_nodes":[{"host":"es","port":9200}]}}}' > /tmp/fed.conf &&\
docker run -d --name fed -v /tmp/fed.conf:/opt/fed/conf/config.json --link es:es mcholste/fed &&\
docker pull mcholste/galaxy &&\
docker run -d -p 8080:8080 --name galaxy --link fed:fed mcholste/galaxy
