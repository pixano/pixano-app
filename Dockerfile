FROM ubuntu:18.04

# Install Node.js
RUN apt-get update && apt-get install -y --reinstall ca-certificates curl build-essential
RUN curl --silent --location https://deb.nodesource.com/setup_10.x | bash -
RUN apt install -y nodejs

RUN npm i \
    && npm i abbrev && npm i osenv && npm i npmlog \
    && npm i rimraf && npm i semver && npm i mkdirp \
    && npm i ms && npm i yallist && npm i chownr \
    && npm i mime-types && npm i safer-buffer \
    && npm i xtend && npm i errno && npm i async \
    && npm i nan && npm i normalize-path \
    && npm i end-of-stream \
    && npm i graceful-fs \
    && npm i camelcase \
    && npm i emoji-regex \
    && npm i archiver \
    && npm i arg \
    && npm i bcrypt \
    && npm i boxen \
    && npm i chalk \
    && npm i cli-progress \
    && npm i cookie-parser \
    && npm i express \
    && npm i fs \
    && npm i glob \
    && npm i google-protobuf \
    && npm i grpc \
    && npm i jsonwebtoken \
    && npm i level \
    && npm i moment \
    && npm i normalize-path \
    && npm i object-sizeof \
    && npm i path \
    && npm i save \
    && npm i short-uuid \
    && npm i tmp \
    && npm run build

EXPOSE 3000

COPY server server

COPY .logo-ascii .logo-ascii

COPY package.json package.json

# ENTRYPOINT ["node", "server/server.js"]
ENTRYPOINT cat .logo-ascii && node server/server.js

CMD []
