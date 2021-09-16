FROM ubuntu:18.04

# Install Node.js
RUN apt update && apt install -y --reinstall ca-certificates curl build-essential
RUN curl --silent --location https://deb.nodesource.com/setup_10.x | bash -
RUN apt install -y nodejs && apt install -y python-requests

COPY package.json package.json

COPY webpack.config.js webpack.config.js

COPY src src

COPY images images

COPY server server

COPY .logo-ascii .logo-ascii

RUN npm install -g npm@7.23.0 && npm i \
    && npm run build \
    && rm -rf src node_modules images \
    && npm i -D \
    && rm -rf package-lock.json webpack.config.js

EXPOSE 3000

# ENTRYPOINT ["node", "server/server.js"]
RUN echo 'cat .logo-ascii && node server/server.js "$@"' > entrypoint.sh
ENTRYPOINT ["sh", "entrypoint.sh" ]
CMD []
