FROM ubuntu:18.04

# Install Node.js
RUN apt-get update && apt-get install -y --reinstall ca-certificates curl build-essential
RUN curl --silent --location https://deb.nodesource.com/setup_10.x | bash -
RUN apt install -y nodejs


RUN npm i abbrev && npm i osenv && npm i npmlog \
    && npm i rimraf && npm i semver && npm i mkdirp \
    && npm i ms && npm i yallist && npm i chownr \
    && npm i mime-types && npm i safer-buffer \
    && npm i xtend && npm i errno && npm i async \
    && npm i nan && npm i normalize-path \
    && npm i end-of-stream \
    && npm i graceful-fs \
    && npm i camelcase \
    && npm i emoji-regex

EXPOSE 3000

COPY build build

COPY server server

COPY package.json package.json


RUN npm install --only=dev

ENTRYPOINT ["node", "server/server.js"]

CMD []
