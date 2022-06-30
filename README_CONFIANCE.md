Process utilisateur confiance / cas d'usages
===============

## Démo en local :
Aller dans le dossier pixano-app
### démarrage d'Élise
```
sudo docker run -it --rm -p 8081:8081 pixano/elise:confiance-v0.1.0
```
### démarrage de l'émulateur minio
```
cd /data/PIXANOws && python /home/bburger/CEA/PIXANO2021/doc/python-server-with-cors.py 1234
# sert les images/dossiers présents dans /data/PIXANOws et les rend accessible via l'uri : http://localhost:1234/
```
### lancement de pixano
```
pixano -w /data/PIXANOws/ --elise-url=http://127.0.0.1:8081
# OU
sudo docker run -it --rm -v "$PWD":/data -p 3000:3000 --network=host pixano/pixano-app:confiance-v1.7.0 --elise-url=http://127.0.0.1:8081
```

-----------------
## accès aux autres ressources du projet Confiance sur ec5-dev :
### [DEBIAI](https://debiai-ec5.confiance.irtsystemx.org/#/)
### [KAFKA](https://kafka-ec5.confiance.irtsystemx.org/topic/selection/)
### [MINIO](https://minio-ec5.confiance.irtsystemx.org/buckets/pixanoimagesselection/)
### [ELASTIC](https://elasticsearch-ec5.confiance.irtsystemx.org/)
### [KIBANA](https://kibana-ec5.confiance.irtsystemx.org/)
### [ELISE](https://elise-ec5.confiance.irtsystemx.org/)

-----------------
## Démo dans l'environnement ec5-dev avec code dans conteneur démo (dvc-pod-2)
### connexion
```
sudo ipsec up IRT_Client
k login
k port-forward dvc-pod-2 3000:3000 &
k exec -ti dvc-pod-2 -- bash
```
```
#root@dvc-pod-2:/mlops
cd /mlops/code/pixano-app
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
sudo docker build -t pixano/pixano-app:confiance-v1.7.0 -f Dockerfile-local .
# tester le bon fonctionnement (pas de volumes dans confiance)
sudo docker run -it --rm -p 3000:3000 pixano/pixano-app:confiance-v1.7.0
# le cas échéant en faire une sauvegarde locale
sudo docker save -o /data/pixano-confiance-v1.7.0.tar pixano/pixano-app:confiance-v1.7.0
```
### pousser sur dockerhub
```
# si l'image venait d'ailleurs, commencer par la charger
sudo docker load -i /data/pixano-confiance.tar
# modifier le tag et pousser
sudo docker tag pixano/pixano-app:confiance-v1.7.0 pixano/pixano-dev:confiance-v1.7.0
sudo docker push pixano/pixano-dev:confiance-v1.7.0
```
### connexion
```
sudo ipsec up IRT_Client
k login
```
### importer l'image sur kubernetes et la lancer (sans déploiement, pour test)
```
# création du pod :
k run pixano-v1-7-0 -n ec5-dev --image pixano/pixano-dev:confiance-v1.7.0
# vérification (au départ, il faut le temps qu'il télécharge l'image depuis dockerhub) :
k get pods
# en cas de problème, on peut avoir plus de détails
k describe pod pixano-v1-7-0
# forwarder les ports pour pouvoir accéder à Pixano
k port-forward pixano-v1-7-0 3012:3000 &
## accès à pixano via http://localhost:3012
```
### déploiement réel :
```
git clone git@git.irt-systemx.fr:confianceai/ec_5/ec5_as2/deployment-configurations.git
cd deployment-configurations
k apply -f pixano_deployment-dev.yaml
## attendre un peu : l'image va être téléchargée en tâche de fond
## accès à pixano via https://pixano-ec5.confiance.irtsystemx.org/#/
```


-----------------
## Démo dans l'environnement ec5-integration

### connexion au cluster
#### première fois :
```
git clone git@git.irt-systemx.fr:confianceai/ec_1/fa2_infrastructure/kubectl-config.git
cd kubectl-config/
./install_and_config_kubectl.sh
k login public-v2
k config set-context --current --namespace=ec5-integration
k get pods
```
#### à chaque fois :
```
k login public-v2
k get pods
```
### déploiement :
```
git clone git@git.irt-systemx.fr:confianceai/ec_5/ec5_as2/deployment-configurations.git
cd deployment-configurations
k apply -f elise_deployment.yaml
k apply -f pixano_deployment.yaml
```
#### vérifs
```
# vérifier le déploiement
k get pods
# vérifier le log de Pixano
k logs pixano-69766cb5d8-zfjqz
```
#### supprimer un déploiement
```
k delete all -l app=pixano
```
### [accès réseau](https://pixano-ec5.apps.confianceai-public.irtsysx.fr/)



-----------------
## tests de connexion - communication
#### Élise
```
curl https://elise-ec5.confiance.irtsystemx.org -F action=search -F save=0
curl localhost:8081 -F action=search -F image=@/home/bburger/data/video/01.png
```
#### ElasticSearch/Opensearch
```
## nettoyer (=supprimer et recréer) un index elastic :
curl -X DELETE https://opensearch-ec5.confiance.irtsystemx.org/pixano_export_data/
curl -X PUT https://opensearch-ec5.confiance.irtsystemx.org/pixano_export_data/
### voir le contenu :
curl -X GET https://opensearch-ec5.confiance.irtsystemx.org/pixano_export_data/_search?size=10000&pretty=true&q=*:*
```


