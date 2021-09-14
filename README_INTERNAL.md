**ATTENTION :** ce document est interne et ne doit en aucun cas être publié sur le github !  
La documentation publique doit se trouver dans le [README.md](./README.md).  
La liste des modifications/corrections prévues dans ce code se trouve dans le [TODO_INTERNAL.md](./TODO_INTERNAL.md). Ce fichier doit rester interne et ne pas se retrouver sur le github.

Contenu de ce document :

[[_TOC_]]

# organisation/gestion des dépôts
## version opensource publiée sur github
- [dépôt](https://github.com/pixano/pixano-elements) opensource sous licence [CeCILL-C](./LICENSE.txt)
- contient tous les modules et codes issus de l'EdA
- étiquettes de versions : vX.Y.Z
- **on ne devrait jamais pousser directement sur ce dépôt !** Il faut toujours passer par les pull-request pour sécuriser et générer du trafic (voir [procédure](#procedure-de-publication)).

## version interne publiée sur notre gitlab
### branche remote github
- cette branche est une copie locale du dépôt github **forké**. Elle n'est utilisée que pour préparer et effectuer les publications (ou plus rarement pour récupérer du code du github s'il est en avance sur master du gitlab).
- pour chaque nouvelle version à publier sur le github :
	- on la prépare sur cette branche
	- on la teste et valide sur cette branche
	- on l'étiquette sur cette branche
	- on la pousse sur le github forké avant de faire une pull-request sur le dépôt original (voir [procédure détaillée](#procedure-de-publication))
### branche master
- branche par défaut récupérée par tout nouveau contributeur
- version la plus à jour, elle contient, en plus des fonctionnalités présentes sur le dépôt github, toutes les fonctionnalités intelligentes utilisables en interne labo et avec nos partenaires
- regroupe "régulièrement" les avancées projets (sauf les code projets qui restent propriétaires d'une entreprise en particulier)
- étiquettes de versions : viX.Y.Z
### autres branches
- une branche par projet (industriel, thèse, stage)
- chacune de ces branche dérive de master
- toutes les fonctionnalités ou corrections suffisamment matures sont poussées "régulièrement" sur le master (merge ou cherry-pick selon le cas)
- en fin de projet, toute la branche est fusionnée avec master
- étiquettes de versions (le cas échéant) : vipX.Y.Z ou étiquette spécifique à l'industriel (par exemple : vipX.Y.Z_arcure, vipX.Y.Z_valeo, etc)

### schématiquement :
```
github                                      gitlab  
------                     ---------------------------------------  
                                                    <--merge--> p1  
master  <------push------  github <--merge-- master <--merge--> p2  
                                                    <--merge--> p2  
                                                    ...  
```

## cas particulier d'un dépôt projet devant utiliser tuleap
- les développements liés au projet sont effectués sur le tuleap par les partenaires et par les membres CEA
- push "régulier" des avancées tuleap vers la branche du projet sur le gitlab
- remontée des avancées gitlab vers le tuleap en fonction du besoin, procédure :
	1. push tuleap vers gitlab (projet)
	2. merge des branches gitlab master et projet
	3. push gitlab (projet) vers tuleap

*On entend par "régulièrement" : tous les 6 mois environs, idéalement lors de deux campagnes à la rentrée de septembre et celle de janvier. Libre à chacun évidement de faire ces merges plus régulièrement ou au fil de l'eau.*




# Open-source publication procedure

TODO !!!
