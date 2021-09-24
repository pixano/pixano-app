Ce fichier contient la liste des modifications/corrections prévues dans ce code. Ce fichier doit rester interne et ne pas se retrouver sur le github.  

#Tags :
- [#interface] : modification concernant l'interface utilisateur : la visualisation, les boutons, etc
- [#bug] : bogue
	- [#firefox] : bogue lié uniquement à firefox
- [#feature] : nouvelle fonctionnalité / complément à une fonctionnalité existante
- [#doc] : besoin en documentation


# AFAIRE :
- [ ] [#doc] ajouter un test d'import/export dans la procédure avant livraison
- [ ] [#interface] quand on importe, il faudrait une boite de dialogue pour demander si on veut fusionner avec la base existante ou créer une nouvelle (actuellement, si on sélectionne une tâche il ajoute les imports avec des '-1', si on est sur "new task" il fusionne)
- [x] [#feature] ajout d'un textfield comme choix, en plus des checkbox et dropdown
- [ ] [#bogue] segmentation : mes modifs union/substract ne fonctionnent pas dans l'app
- [ ] [#bogue] l'affichage n'est pas le même (boutons manquants) quand on appuie sur le bouton image dans la liste par rapport à un appui sur les "start *"
- [ ] [#feature] possibilité pour l’annotateur de passer à l’image suivante sans la valider (abandon)
- [ ] [#interface] quand on a l'interface sombre, les properties ne ressortent pas => il faudrait les mettre sur un fond coloré ou blanc ou alotrs modifier leur couleur : blanc si fond sombre par ex.
- [-] [#bogue #firefox] les propriétés sous forme de checkbox ne fonctionnent pas (uniquement sous firefox) :
	- ils reprennent la valeur par défaut si on passe à une annotation de classe différente puis qu'on y revient
	- si on modifie la valeur sur une boite, c'est propagé à toutes les autres boites de même classe sur lesquelles on clique
- [-] [#bogue #firefox] quand on édite les annotations, puis qu'on crée de nouveau sur la même image, les propriétés restent celles de la dernière annotation modifiée (et on la modifie donc) (uniquement sous firefox)
- [ ] [#bogue] pour modifier une tâche il faut créer une nouvelle tâche, puis revenir dessus... Action à déterminer
- [ ] [#feature] affichage sous forme d’imagettes plutôt qu’une liste

- [ ] [#feature] avoir des tags test/train/validation et pouvoir segmenter la base en fonction (en lien avec l’intégration de Semfeat ?)
- [ ] [#feature] intégration Semfeat/Élise

- [ ] [#interface] à la création d'une nouvelle tâche, il faudrait pouvoir décider si on souhaite étiqueter en mode shuffle (par défaut) ou linéaire (en suivant le nom des fichiers)
- [ ] [#interface] add an error message when creating task/dataset in a path which does not exist


- Q :
	- [ ] [#feature] possibilité de ne pas annoter tous les keypoints (non visibles) ?
	- [ ] [#feature] possibilité de sélectionner plusieurs éléments pour leur donner des caractéristiques communes ?
