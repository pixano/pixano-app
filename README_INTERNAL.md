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




# A) Open-source publication procedure
## 1. Prerequisite (only the first time)
#### have a github account and fork
- create a [github](https://github.com) $MYACCOUNT account 
- create a fork of the [original repository](https://github.com/pixano/pixano-app)
#### initialize the repository remote branch
	git remote add upstream git@github.com:$MYACCOUNT/pixano-app.git
	git fetch upstream
	git checkout -b github upstream/master

## 2. On github: Update your fork
- on your fork github (on github.com), click on "Fetch upstream", then "Fetch and merge"

## 3. Locally: Prepate the publication
	# make sure the repositories are up-to-date
	git fetch
	git fetch upstream
	git checkout github
	# integrate our modifications to the github branch
	# a few usage examples with cherry-pick :
	# import of the commit number d5e075f2 :
	git cherry-pick d5e075f2
	# import of all commits from b4cb0b18 to d5e075f2 both included:
	git cherry-pick b4cb0b18^..d5e075f2
	# import of all commits from cfbb3866 (not included) to 74e276acb:
	git cherry-pick cfbb3866..74e276acb : 

During the merge / before commiting, **do not include / delete files and internal/proprietary codes** :  

- do not include the present file [README_INTERNAL.md](./README_INTERNAL.md), nor the .gitlab-ci.yml
- do not include the folder [doc_interne](./doc_interne)
- do not include the files with tag "proprietary"
- do not include with code blocks surrounded by tag "proprietary"

### 4. Verify and validate code
#### clean and recompilation "from scratch"
	# clean
	rm -rf node_modules
	rm package-lock.json
	# compilation
	npm i
	npm run build
#### verify "by hand"
	node server/server.js data-test/

## 5. Publish
#### 1. push
	VERSION=0.4.17
	#update the publication version in the package.json
	git add package.json
	git commit -m "release $VERSION"
	git tag -m "v$VERSION" "v$VERSION"
	# push modifications on the fork
	git push upstream github:master --follow-tags
<!-- LACK IN THE PROCEDURE : tag report on the master -->
<!-- git checkout master -->
<!-- git tag -m "v$VERSION" "v$VERSION" -->
<!-- git push origin master -->
<!-- ISSUE : we cannot have 2 tags of the same name in a given repository even if the other branch is upstream -->
#### 2. pull-request
The rest is on [github](https://github.com) :

- on the fork $MYACCOUNT : onglet "Pull requests" => "New pull request" => "Create pull request" => "Create pull request"
- automatic verifications are made by github
- on the pixano account : got to "Merge pull request" => "Confirm merge"
#### 3. release
Transform the tag in github release (makes the last tag more visible and detailed) :
<!--	DOES NOT WORK (yet)?) because tags are not exported in pull requests-->
<!--	- go to the page [tags](https://github.com/pixano/pixano-elements/tags)-->
<!--	- select the last tag-->
<!--	- "Edit release"-->
<!--	- in "Release title", put the version vX.Y.Z-->
<!--	- "Update release"-->

	- go to the page in [release](https://github.com/pixano/pixano-app/releases)
	- button "Draft a new release"
	- "Tag version" vX.Y.Z
	- in "Release title", put the version vX.Y.Z
	- complete the comments
		- To easily list the commits and descriptions :
			git log v0.5.15..v0.5.16 --oneline
	- "Publish release"