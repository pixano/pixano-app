FROM ubuntu:20.04

# Install Node.js
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update
RUN apt-get install -y nodejs
RUN node --version

# Copy bundled frontend and backend dependencies
COPY build build
COPY node_modules node_modules

# Copy files for the backend
COPY package.json package.json
COPY server server
COPY cli cli

EXPOSE 3000

# default files and folders (usefull when no volume can be mounted with this image)
RUN mkdir -p /data
COPY data-test /data/data-test

# ENTRYPOINT ["node", "server/server.js"]
RUN echo 'node cli/pixano "$@"' > entrypoint.sh
#RUN echo 'node cli/pixano "$@" > pixano_logs 2>&1' > entrypoint.sh
ENTRYPOINT ["sh", "entrypoint.sh" ]
CMD []
