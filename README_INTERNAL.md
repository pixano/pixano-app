**ATTENTION :** this document is internal and must not be published on the github !  
The public documentation must be in the [README.md](./README.md).  
The list of planned code modifications/corrections are in [TODO_INTERNAL.md](./TODO_INTERNAL.md). This file must also stay internal and not be published on the github !

Document content :

[[_TOC_]]

# Organisation/repository management
## opensource version published on github
- [repository](https://github.com/pixano/pixano-app) opensource under licence [CeCILL-C](./LICENSE.txt)
- contains all modules and codes from SoTA
- version tags : vX.Y.Z
- **never push directly on the github !** You must always go through pull-requests to secure and generate traffic (see [procedure](#procedure-de-publication)).

## internal version published on our gitlab
### remote github branch
- this branch is a local copy of the github repository **forké**. It is only used to prepare and do publications (or more rarely to retrieve github code if it is ahead  on the gitlab master).
- for each new version to publish on the github :
	- you prepare it on this branch
	- you test it on this branch
	- you tag it on this branch
	- you push it on your forked github before doing a oull-request on the original repository (see [detailed procedure](#procedure-de-publication))
### master branch
- default branch to retrieve for all new user
- version the most up-to-date, it contains, more than the github functionnalities, all smart functions usable internally and with our partners
- regroup "regularly" the project novelties (except for porjet code which stay proprietary for given company)
- version tags : viX.Y.Z
### other branches
- one branch per project (industrial, thesis, internship)
- each branch comes from master
- all functionnalities or corrections mature enough are push "regularly" on the master (merge or cherry-pick depending on the case)
- at the end of the project, the branch is fused with the master
- version tags (if appropriate) : vipX.Y.Z or specific tag for the partner (eg. vipX.Y.Z_arcure, vipX.Y.Z_valeo, etc)

### schematically :
```
github                                      gitlab  
------                     ---------------------------------------  
                                                    <--merge--> p1  
master  <------push------  github <--merge-- master <--merge--> p2  
                                                    <--merge--> p2  
                                                    ...  
```

## particular case of a repository which must be in tuleap
- the developments linked to the project are done on the tuleap by both the cea and the partners
- push "regularly" novelties from tuleap to the project branch in gitlab
- push "regularly" novelties from the gitlab to the tuleap depending on the need, procedure :
	1. push tuleap to gitlab (project)
	2. merge gitlab master and project branches
	3. push gitlab (project) to tuleap

*We mean by "regularly" : every about 6 months, ideally in september and january. You are of course free to do these merges more often.*

---------------------

# Open-source publication procedure
## Prerequisite (only the first time)
#### have a github account and fork
- create a [github](https://github.com) $MYACCOUNT account 
- create a fork of the [original repository](https://github.com/pixano/pixano-app)
#### initialize the repository remote branch
	git remote add upstream git@github.com:$MYACCOUNT/pixano-app.git
	git fetch upstream
	git checkout -b github upstream/master


## Publication
### 0) prepare gitlab version
	LAST_VERSION=0.4.9
	VERSION=0.5.0
	git fetch
	git checkout master
	git pull origin master
	# update the publication version
	gedit package.json frontend/package.json
	## change version to $VERSION
	## in frontend : if necessary, change version of elements
	git add package.json frontend/package.json
	git commit -m "release $VERSION"
### 1) Prepate the publication
1. On github : Update your fork
	- on your fork github (on github.com), click on "Fetch upstream", then "Fetch and merge"
2. Locally:

	2.1 Merge with master
	
		# make sure the repositories are up-to-date
		git fetch upstream
		git checkout github
		git pull
		
		# integrate our modifications to the github branch
		# merge all commits without commit which lets you inspect (and modify) the result before committing
		# ensure that you `git rm --cached` every internal file/section
		git merge --no-commit master

	During the merge / before commiting, **do not include / delete files and internal/proprietary codes** :  

	- do not include the present file [README_INTERNAL.md](./README_INTERNAL.md) and [TODO_INTERNAL.md](./TODO_INTERNAL.md), nor the .gitlab-ci.yml
	- do not include the files with tag "proprietary"
	- do not include with code blocks surrounded by tag "proprietary"
	
	2.2 Commit blacked out merge
		
		git commit

### 2) Verify and validate code
#### clean and recompile "from scratch"
	# clean
	rm -rf node_modules frontend/node_modules
	rm package-lock.json frontend/package-lock.json
	# compilation
	npm run deps
	npm run build
#### verify "by hand"
	node server/server.js data-test/
	## you can create tasks for images using the folder "images/"
	## you can create tasks for sequences using the folder "video/"

### 3) Publish
#### 1. push
	git tag -m "v$VERSION" "v$VERSION"
	# push modifications on the fork
	git push upstream github:master --follow-tags

#### 2. pull-request
The rest is on [github](https://github.com) :

- on the fork $MYACCOUNT : onglet "Pull requests" => "New pull request" => "Create pull request"
- complete the merge request message with:
	- Tip: To easily list the commits and descriptions: ```git log v$LAST_VERSION..v$VERSION --oneline --pretty="format:%s"```
	- in Title: v$VERSION
	- in Comment: write something like:
```
## server
* file: modifications...
* file: modifications...
* ...
## frontend
* ...

Co-authored-by: Camille Dupont camille.dupont@cea.fr
Co-authored-by: Brice Burger brice.burger@cea.fr
Co-authored-by: ...
```
- click on "Create pull request" => automatic verifications are made by github
- at the bottom of the page: click on "Merge pull request" => "Confirm merge"


#### 3. release
Transform the tag in github release (makes the last tag more visible and detailed) :
<!--	DOES NOT WORK (yet)?) because tags are not exported in pull requests-->
<!--	- go to the page [tags](https://github.com/pixano/pixano-app/tags)-->
<!--	- select the last tag-->
<!--	- "Edit release"-->
<!--	- in "Release title", put the version vX.Y.Z-->
<!--	- "Update release"-->

	- go to the page in [release](https://github.com/pixano/pixano-app/releases)
	- button "Draft a new release"
	- click on "Tag version" button: vX.Y.Z => "create new tag"
	- in "Release title": vX.Y.Z
	- complete the comments with the same comment then the pull request
	- "Publish release"

#### 4. push on docker hub
	# login (if not already logged)
	sudo docker login --username pixano
	## enter password
	# build docker image
	sudo docker build -t  pixano/pixano-app:$VERSION .
	sudo docker tag pixano/pixano-app:$VERSION pixano/pixano-app:latest
	# make sure it built correctly
	cd data-test/
	sudo docker run -it --rm -v "$PWD":/data --network host pixano/pixano-app:$VERSION
	cd ../
	# push to docker hub
	sudo docker push pixano/pixano-app:$VERSION
	sudo docker push pixano/pixano-app:latest

#### 5. report all to master
	# tag report on master
	git checkout master
	#OR git checkout f5f56daf if the reference commit is not the last one
	
	# if some changes have to be reported back
	git cherry-pick last_github_commit_hash
	
	# push to origin
	git tag -m "vi$VERSION" "vi$VERSION"
	git push origin master --follow-tags


