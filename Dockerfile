FROM ubuntu:18.04

# Install Node.js
RUN apt update && apt install -y --reinstall ca-certificates curl build-essential
RUN curl --silent --location https://deb.nodesource.com/setup_12.x | bash -
RUN apt install -y nodejs && apt install -y python-requests
RUN npm install -g npm@6.10.0

# Copy files for the frontend
COPY frontend frontend

# Copy files for the backend
COPY package.json package.json
COPY server server
COPY .logo-ascii .logo-ascii

# Build frontend and install backend dependencies
RUN npm i && cd frontend/ && npm i && npm run build && rm -rf src frontend && cd ..

EXPOSE 3000

# ENTRYPOINT ["node", "server/server.js"]
RUN echo 'cat .logo-ascii && node server/server.js "$@"' > entrypoint.sh
ENTRYPOINT ["sh", "entrypoint.sh" ]
CMD []
