FROM ubuntu:20.04

# Install Node.js
RUN apt-get update && apt-get install -y --reinstall ca-certificates curl build-essential
RUN curl --silent --location https://deb.nodesource.com/setup_12.x | bash -
RUN apt-get install -y nodejs
RUN npm install -g npm@6.10.0


# Copy files for the frontend
COPY frontend frontend

# Copy files for the backend
COPY package.json package.json
COPY server server
COPY cli cli

# Build frontend and install backend dependencies
RUN npm run deps && npm run build && rm -rf frontend

EXPOSE 3000

# default files and folders (usefull when no volume can be mounted with this image)
COPY config config
RUN mkdir -p /data
COPY data-test /data/data-test

# ENTRYPOINT ["node", "server/server.js"]
#RUN echo 'pixano "$@"' > entrypoint.sh
RUN echo 'pixano "$@" > pixano_logs 2>&1' > entrypoint.sh
ENTRYPOINT ["sh", "entrypoint.sh"]
CMD []
