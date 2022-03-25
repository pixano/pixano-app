Process utilisateur confiance / cas d'usages
===============

## Démo en local :
Aller dans le dossier pixano-app
### nettoyage préventif
```
rm -rf ELISE/elise/repository.db ELISE/Elise_sqlite/ ELISE/elise_ext/data/idx/*
rm -rf /data/PIXANOws/db.ldb
```
### démarrage d'Élise
```
export ELISE_BASE="$(pwd)/ELISE"
export ELISE_DIST=$ELISE_BASE/elise_ext
export LD_LIBRARY_PATH=$ELISE_DIST/lib
# 1) lancer un searcher, il continue à tourner en tâche de fond
$ELISE_DIST/bin/run_search_server --param=$ELISE_BASE/eliseCfg/elise_search_FSF_config.xml -tSEARCHER_FSF &
# 2) lancement du serveur Élise
$ELISE_DIST/bin/run_elise_server --param=$ELISE_BASE/eliseCfg/elise_server_config_sqlite.xml &
```
### démarrage de l'émulateur minio
```
cd /data/PIXANOws && python /home/bburger/CEA/PIXANO2021/doc/python-server-with-cors.py 1234
# sert les images/dossiers présents dans /data/PIXANOws et les rend accessible via l'uri : http://localhost:1234/
```
### lancement de pixano
```
node server/server.js /data/PIXANOws/
```

-----------------
## accès aux autres ressources du projet Confiance sur ec5-dev :
### [DEBIAI](https://debiai-ec5.confiance.irtsystemx.org/#/)
### [KAFKA](https://kafka-ec5.confiance.irtsystemx.org/topic/selection/)
### [MINIO](https://minio-ec5.confiance.irtsystemx.org/buckets/pixanoimagesselection/)
### [ELASTIC](https://elasticsearch-ec5.confiance.irtsystemx.org/)
### [KIBANA](https://kibana-ec5.confiance.irtsystemx.org/)

-----------------
## Démo dans l'environnement ec5-dev avec code dans conteneur démo (dvc-pod-2)
### connexion
```
sudo swanctl --initiate --ike ikev1-psk-xauth-aggressive --child ikev1-psk-xauth-aggressive
k login
k port-forward dvc-pod-2 3000:3000 &
k exec -ti dvc-pod-2 -- bash
```
```
#root@dvc-pod-2:/mlops
cd /mlops/code/pixano-app
```
### nettoyage préventif
```
rm -rf ELISE/elise/repository.db ELISE/Elise_sqlite/ ELISE/elise_ext/data/idx/*
rm -rf /mlops/pixdata/db.ldb
```
### démarrage d'Élise
```
export ELISE_BASE="$(pwd)/ELISE"
export ELISE_DIST=$ELISE_BASE/elise_ext
export LD_LIBRARY_PATH=$ELISE_DIST/lib
# 1) lancer un searcher, il continue à tourner en tâche de fond
$ELISE_DIST/bin/run_search_server --param=$ELISE_BASE/eliseCfg/elise_search_FSF_config.xml -tSEARCHER_FSF &
# 2) lancement du serveur Élise
$ELISE_DIST/bin/run_elise_server --param=$ELISE_BASE/eliseCfg/elise_server_config_sqlite.xml &
```
### lancement de pixano
```
node server/server.js /mlops/pixdata/
```
### test d'un message kafka :
```
cd /mlops/testKafka/kafka/ ; node kafka_producer2.js
##s'il ne trouve pas les messages malgré plusieurs productions, il faut changer de groupe
ctrl-C
cd /mlops/code/pixano-app
node server/server.js /mlops/pixdata/
```

-----------------
## Démo dans l'environnement ec5-dev via docker
À noter :  
1. Pour l'instant, on est obligé de passer par un dépôt public sur DockerHub. Quand l'environnement sera plus abouti, on pourra utiliser le dépôt interne de l'IRT.  
2. On ne peut pas monter de volume dans l'environnement Confiance (pour l'instant en tout cas).
### créer une nouvelle image
```
# s'assurer que le code est bien construit
npm run build
# lancer la construction
sudo docker build -t pixano/pixano-app:confiance-v1.5.1 -f Dockerfile-local .
# tester le bon fonctionnement (pas de volumes dans confiance)
sudo docker run -it --rm -p 3000:3000 -p 8081:8081 pixano/pixano-app:confiance-v1.5.1
# le cas échéant en faire une sauvegarde locale
sudo docker save -o /data/pixano-confiance-v1.5.1.tar pixano/pixano-app:confiance-v1.5.1
```
### pousser sur dockerhub
```
# si l'image venait d'ailleurs, commencer par la charger
sudo docker load -i /data/pixano-confiance.tar
# modifier le tag et pousser
sudo docker tag pixano/pixano-app:confiance-v1.5.1 pixano/pixano-dev:confiance-v1.5.1
sudo docker push pixano/pixano-dev:confiance-v1.5.1
```
### connexion
```
sudo swanctl --initiate --ike ikev1-psk-xauth-aggressive --child ikev1-psk-xauth-aggressive
k login
```
### importer l'image sur kubernetes et la lancer (sans déploiement, pour test)
```
# création du pod :
k run pixano-v1-5-1 -n ec5-dev --image pixano/pixano-dev:confiance-v1.5.1
# vérification (au départ, il faut le temps qu'il télécharge l'image depuis dockerhub) :
k get pods
# en cas de problème, on peut avoir plus de détails
k describe pod pixano-v1-5-1
# forwarder les ports pour pouvoir accéder à Pixano
k port-forward pixano-v1-5-1 3012:3000 &
## accès à pixano via http://localhost:3012

###... port à valider : DebiAI utilise a priori le même, d'autres peut-être aussi, on pourra éventuellement le rediriger sur un autre port du genre : 3001:3000
###... si on veut rendre Élise accessible, il suffira également de forwarder les ports : 8081:8081
```
### déploiement réel :
```
## commencer par adapter la version de l'image docker dans pixano-app/kubernetes_deploy_pixano.yaml
k apply -f kubernetes_deploy_pixano.yaml
## attendre un peu : l'image va être téléchargée en tâche de fond
## accès à pixano via https://pixano-ec5.confiance.irtsystemx.org/#/
```



