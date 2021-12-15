FROM ubuntu:20.04

# Install Node.js
RUN apt-get update && apt-get install -y --reinstall ca-certificates curl build-essential
RUN curl --silent --location https://deb.nodesource.com/setup_12.x | bash -
RUN apt-get install -y nodejs
RUN npm install -g npm@6.10.0


###### Élise (this image can only be created into the CEA network) (version WITH_MYSQL=NO)

# prérequis
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y libpoco-dev libopencv-dev cmake libatlas-base-dev
# téléchargements
COPY ELISE ELISE
# définition des variables d'environnement
ENV ELISE_BASE=$pwd/ELISE
ENV ELISE_EXTERNALS=$ELISE_BASE/elise_ext
ENV OPENCV_DIST=$ELISE_EXTERNALS
ENV JULIET_DIST=$ELISE_EXTERNALS
ENV OPENCV_DIST=$ELISE_EXTERNALS
ENV ELISE_DIST=$ELISE_EXTERNALS
ENV ELISE_CONFIG=$ELISE_EXTERNALS/../elise/
ENV LD_LIBRARY_PATH=$ELISE_DIST/lib
# préparation
RUN rm -rf $ELISE_BASE/elise/build && rm -rf $ELISE_EXTERNALS && mkdir -p $ELISE_EXTERNALS
# installation de Juliet
RUN mkdir -p $ELISE_EXTERNALS/build && cd $ELISE_EXTERNALS/build && cmake -DCMAKE_INSTALL_PREFIX=$ELISE_EXTERNALS $ELISE_BASE/juliet/Sources/ && make -j8 && make install && cd ../../..
# installation de FastSearch
RUN mkdir -p $ELISE_EXTERNALS/buildfs && cd $ELISE_EXTERNALS/buildfs && cmake -DCMAKE_INSTALL_PREFIX=$ELISE_EXTERNALS $ELISE_BASE/fastsearch/ && make -j8 && make install && cd ../../..
# installation de Elise
RUN mkdir -p $ELISE_BASE/elise/build && cd $ELISE_BASE/elise/build && cmake -D WITH_MYSQL=NO -DCMAKE_INSTALL_PREFIX=$ELISE_EXTERNALS .. && make -j8 && make install && cd ../../..
RUN mkdir -p $ELISE_EXTERNALS/data/idx/

EXPOSE 8081
###### fin Élise


# Copy files for the frontend
COPY frontend frontend

# Copy files for the backend
COPY package.json package.json
COPY server server
COPY .logo-ascii .logo-ascii

# Build frontend and install backend dependencies
RUN npm deps && npm run build && rm -rf frontend

EXPOSE 3000


# clean the image
RUN rm -rf ELISE/elise/repository.db ELISE/Elise_sqlite/ ELISE/elise_ext/data/idx/*

# default files and folders (usefull when no volume can be mounted with this image)
RUN mkdir -p /data
COPY exconf.json /exconf.json


# ENTRYPOINT ["node", "server/server.js"]
# RUN echo 'cat .logo-ascii && node server/server.js "$@"' > entrypoint.sh
RUN echo 'bash -c "$ELISE_DIST/bin/run_search_server --param=$ELISE_BASE/eliseCfg/elise_search_FSF_config.xml -tSEARCHER_FSF &" && bash -c "$ELISE_DIST/bin/run_elise_server --param=$ELISE_BASE/eliseCfg/elise_server_config_sqlite.xml &" && cat .logo-ascii && node server/server.js "$@"' > entrypoint.sh
ENTRYPOINT ["sh", "entrypoint.sh"]
CMD []
