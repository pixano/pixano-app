How To Install and Use Elise
===============

# what is Elise
**TODO**

# Installation
### via the build of a Docker image
```
# clone elise
npm run elise_clone
# build docker image with elise
sudo docker build -t pixano/pixano-app:pixano-elise-v0 -f Dockerfile-local .
```

### build directly in PIXANO (for developpers)
#### dependencies
```
apt install build-essential cmake libpoco-dev libopencv-dev libatlas-base-dev
```
#### installation
```
# clone elise
npm run elise_clone
# build elise
export ELISE_BASE="$(pwd)/ELISE"
export ELISE_EXTERNALS=$ELISE_BASE/elise_ext
export OPENCV_DIST=$ELISE_EXTERNALS
export JULIET_DIST=$ELISE_EXTERNALS
export OPENCV_DIST=$ELISE_EXTERNALS
export ELISE_DIST=$ELISE_EXTERNALS
export ELISE_CONFIG=$ELISE_EXTERNALS/../elise/
export LD_LIBRARY_PATH=$ELISE_DIST/lib
# préparation
rm -rf $ELISE_EXTERNALS && mkdir -p $ELISE_EXTERNALS
# installation de Juliet
mkdir -p $ELISE_EXTERNALS/build && cd $ELISE_EXTERNALS/build && cmake -DCMAKE_INSTALL_PREFIX=$ELISE_EXTERNALS $ELISE_BASE/juliet/Sources/ && make -j8 && make install && cd ../../..
# installation de FastSearch
mkdir -p $ELISE_EXTERNALS/buildfs && cd $ELISE_EXTERNALS/buildfs && cmake -DCMAKE_INSTALL_PREFIX=$ELISE_EXTERNALS $ELISE_BASE/fastsearch/ && make -j8 && make install && cd ../../..
# installation de Elise
rm -rf $ELISE_BASE/elise/build && mkdir -p $ELISE_BASE/elise/build && cd $ELISE_BASE/elise/build && cmake -D WITH_MYSQL=NO -DCMAKE_INSTALL_PREFIX=$ELISE_EXTERNALS .. && make -j8 && make install && cd ../../..
mkdir -p $ELISE_EXTERNALS/data/idx/
```

# Usage
## launch the service
### via a Docker image
```
sudo docker run -it --rm -v "$PWD":/data -p 3000:3000 -p 8081:8081 pixano/pixano-app:pixano-elise-v0
```
### via the local build  (for developpers)
```
# 1) lancer un searcher, il continue à tourner en tâche de fond
$ELISE_DIST/bin/run_search_server --param=$ELISE_BASE/eliseCfg/elise_search_FSF_config.xml -tSEARCHER_FSF &

# 2) lancement du serveur Élise
$ELISE_DIST/bin/run_elise_server --param=$ELISE_BASE/eliseCfg/elise_server_config_sqlite.xml &
```

## ...

