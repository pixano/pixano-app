Ce fichier contient la liste des modifications/corrections prévues dans ce code. Ce fichier doit rester interne et ne pas se retrouver sur le github.  

#Tags :
- [#interface] : modification concernant l'interface utilisateur : la visualisation, les boutons, etc
- [#bug] : bogue
	- [#firefox] : bogue lié uniquement à firefox
- [#feature] : nouvelle fonctionnalité / complément à une fonctionnalité existante
- [#doc] : besoin en documentation


# AFAIRE :

## général
- [o] [#doc] Manque README global qui explique comment est construit Pixano et ses dépôts, mettre des schémas pour montrer les utilisations (distribué, standalone facile, etc)
- [ ] [#doc] Getting started blog post
- [ ] [#doc] Ajouter des démos complètes sexy + ajouter un bouton ajouter une config pour tester ton projet facilelement
- [ ] [#feature] Ajouter un exécutable
- [x] [#doc] mise à jour de la procédure de livraison : idem elements
- [ ] [#doc] ajouter un test d'import/export dans la procédure avant livraison

## admin
- [ ] [#doc] afficher le numéro de version de pixano-app
	- sol 1: https://www.npmjs.com/package/git-describe : récupérer côté serveur et envoyer au client
	- sol 2: inclure dans les scripts npm la création d'un fichier de version (https://www.npmjs.com/package/get-git-version), et l'inclure côté client
- [x] [#doc] readme add 'cd ...' + add folder path in commands to make sure we run in the right folder
- [ ] [#feature] fichiers à supprimer si pb (compléter commande cleanall)
- [ ] [#interface] quand on a l'interface sombre, les properties ne ressortent pas => il faudrait les mettre sur un fond coloré ou blanc ou alotrs modifier leur couleur : blanc si fond sombre par ex.
### gestion des tâches
- [ ] [#bogue] pour modifier une tâche il faut créer une nouvelle tâche, puis revenir dessus... Action à déterminer
- [ ] [#feature] implémentation de la navigation dans les fichiers lors de la création de tâches
- [ ] [#interface] quand on importe, il faudrait une boite de dialogue pour demander si on veut fusionner avec la base existante ou créer une nouvelle (actuellement, si on sélectionne une tâche il ajoute les imports avec des '-1', si on est sur "new task" il fusionne)
- [ ] [#feature] ajouter un système de versionning dans les fichiers import/export
- [ ] [#feature] fichiers import/export : une fois le versionning en place, créer une v2 avec : category -> categoryName + ...
- [ ] [#interface] à la création d'une nouvelle tâche, il faudrait pouvoir décider si on souhaite étiqueter en mode shuffle (par défaut) ou linéaire (en suivant le nom des fichiers)
- [ ] [#interface] add an error message when creating task/dataset in a path which does not exist
### gestion des utilisateurs
- [ ] [#feature] revoir les rôles :
	- [ ] [#feature] possibilité d'utiliser des annotations multiples et concurrente et valider par consensus plutôt que d'avoir un validateur
	- [ ] [#feature] séparation complète des tâches d'admin qui ne devrait ni annoter, ni valider
	- [ ] [#feature] annotateurs à compétence différenciée, par ex : les annotateurs de niveau 1 font les BB autour des voitures, les annotateurs de niveau 2 complètent les marques et modèles
- [x] [#bogue] le REJECT ne fonctionne pas (firefox sur rectangle sans annotation dans l'image)
### gestion des jeux de données
- [ ] [#feature] séparer la gestion des tâches et des datasets => implémentation du bouton création
- [ ] [#feature] possibilité de prendre en compte une modification de la base de données images => bouton "refresh database" ?
- [ ] [#feature] avoir des tags test/train/validation et pouvoir segmenter la base en fonction (en lien avec l’intégration de Semfeat ?)
- [x] [#feature] intégration Semfeat/Élise (sur une branche Élise)
	- [x] ajouter Élise dans la génération du docker
	- [x] synchroniser la base de données image
	- Q: comment gérer plusieurs datasets différents ? possible directement avec Élise ? ou il faudra créer plusieurs instances ?
	- [x] créer les interactions
- [x] [#feature] nouveau module de classification
### visualisation / sélection des données
- [ ] [#feature] commencer par mettre les images en visu et ne plus mettre nécessairement toutes les images en to_annotate par défaut => il faut pouvoir sélectionner une partie de la base de donnée facilement pour l'étiquetage
- [ ] [#feature] passerelle Mturk / Amazon SageMaker
- [ ] [#bogue] l'affichage n'est pas le même (boutons manquants) quand on appuie sur le bouton image dans la liste par rapport à un appui sur les "start *"
- [o] [#feature] affichage sous forme d’imagettes plutôt qu’une liste
	- [x] [#feature] création des imagettes et intégration dans la liste de fichiers
	- [ ] [#feature] généralisation des imagettes à toutes les formes de fichiers en entrée
- [ ] [#feature] affichage sous forme d'un mur d'imagette + étiquetage rapide directement sur le mur
	- [ ] [#feature] possibilité de n'afficher dans ce mur qu'une sous-sélection grâce aux filtres dans la liste
- [ ] [#feature] visualisation des annotations existantes/de résultats importés dans ces imagettes => recalculer les thumbnails après chaque submit ?
- [ ] [#bogue] après une sélection via un filtre, on reste sur la même page d'affichage, mais s'il n'y a plus autant d'images à afficher => il faudrait revenir à 0
- [ ] [#bogue] quand on clique sur l'affichage d'image après avoir filtré une partie du contenu, il ne fait rien (image vide ou image précédente s'il y en avait une

## annotation
- [x] [#feature] ajouter un champs commentaire : le validateur peut commenter, l'annotateur peut voir les commentaires, les commentaires sont transmissibles via json. => cf. branche eurovanille
- [ ] [#feature] rajout d'informations dans les jsons : date de dernière annotation, utilisateur à l'origine de la dernière annotation
- [ ] [#feature] possibilité de transmettre l'état des annotations (validé/rejeté) via json
	- [ ] [#feature] possibilité de conserver un historique de ces validations/rejets (objectif: identifier les tâches ou cas compliqués ou mal définis)
- [ ] [#doc] afficher le numéro de version de pixano-element et de pixano-app + afficher si element est local ou version npm
- [ ] [#interface] afficher la liste des objets étiquetés et revoir les interactions pour ne pas remodifier le dernier objet créé
- [ ] [#doc] tabulations/espaces uniformisée dans tous les fichiers
- [ ] [#interface] manque pop-up erreur
- [ ] [#interface] aide affichée à la 1ère connexion
- [x] [#feature] ajout d'un textfield comme choix, en plus des checkbox et dropdown
- [ ] [#feature] possibilité pour l’annotateur de passer à l’image suivante sans la valider (abandon)
- [x] [#bogue #firefox] les propriétés sous forme de checkbox ne fonctionnent pas (uniquement sous firefox) :
	- ils reprennent la valeur par défaut si on passe à une annotation de classe différente puis qu'on y revient
	- si on modifie la valeur sur une boite, c'est propagé à toutes les autres boites de même classe sur lesquelles on clique
- [x] [#bogue #firefox] quand on édite les annotations, puis qu'on crée de nouveau sur la même image, les propriétés restent celles de la dernière annotation modifiée (et on la modifie donc) (uniquement sous firefox)
- [ ] [#feature] possibilité de sélectionner plusieurs éléments pour leur donner des caractéristiques communes ?
### plugin keypoints
- [ ] [#feature] possibilité de ne pas annoter tous les keypoints (non visibles) ?
### plugin segmentation
- [x] [#bogue] segmentation : mes modifs union/substract ne fonctionnent pas dans l'app
- [x] [#bogue] setMask non entièrement fonctionnel : rien en s'affiche et on ne peut rien sélectionner
- [x] [#bogue] add/substract désélectionne la zone
- [ ] [#bogue] segmentation : si on change de classe en mode ajout, çà ne fonctionne pas => sortir du mode ajout/suppression dès qu'on chage de classe


