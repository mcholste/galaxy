FROM python:2-onbuild
RUN pip install --upgrade tornado\
	pyparsing \
	ujson && \
	mkdir -p /opt/galaxy
ADD . /opt/galaxy
EXPOSE 8080
CMD ["python", "/opt/galaxy/app.py", "/opt/galaxy/galaxy.conf"]
