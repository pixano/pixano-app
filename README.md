# <img src="frontend/images/pixano_logo.png" alt="Pixano" height="100"/>

Pixano App
===============
[![License](https://img.shields.io/badge/license-CeCILL--C-blue.svg)](LICENSE) [![Live Demo](https://img.shields.io/badge/demo-online-green.svg)](http://pixano.cea.fr/smart-annotation/) [![License](https://img.shields.io/docker/pulls/pixano/pixano-app.svg)](Docker)

## What is PIXANO ?
Pixano App is a web-based annotation tool. It relies on web components dedicated to annotation [pixano-elements](https://github.com/pixano/pixano-elements). This document explains how to run it.

**TODO :**
- description générale de pixano, lien vers le site et les démos
- description de la structure générale :
	- backend / server
	- frontend
	- elements
- les différentes manières de l'utiliser :
	- en standalone
	- en distribué
	- => donner plkus de détail dans les usage ?

## Table of Contents
* [Installation](#1-installation)
	- [Using Docker Image](#using-docker-image)
	- [From source](#install-from-source-for-developpers)
* [Usage](#2-usage)
	- => mettre tout çà dans un fichier séparé avec des images de chaque étape ? => eq. à Getting started blog post ?
	- [Login page](#login-page)
	- [Create a new task](#create-a-new-task)
	- [Start annotating](#start-annotating)
* [Contributing](#3-contributing)
	- [Getting started](#getting-started)
	- [Pull request](#pull-request)
	- [Build docker from sources](#build-docker-from-sources)
* [Documentation](#4-documentation)
	- [Import predictions](#import-predictions)
	- [Import/Export annotation format](#importexport-annotation-format)




## 1. Installation

### Using Docker Image

The easiest way to get up-and-running is to install [Docker](https://www.docker.com/). Then, you should be able to download and run the pre-built image using the docker command line tool. Find out more about the `pixano` image on its [Docker Hub](https://hub.docker.com/r/pixano/pixano-app/) page.

Here's the simplest way you can run the Pixano application using docker:

```bash
sudo docker run -it --rm -v "$PWD":/data -p 3000:3000 pixano/pixano-app
```

The path where you run this command must contain the data you want to annotate.

*NB: This path is defined as your workspace.*

#### Optional: create an alias
In practice, we suggest you setup an alias called `pixano` to automatically expose the folder containing your specified image, so the script can read it and store results where you can access them. This is how you can do it in your terminal console on OSX or Linux:

```bash
# Setup the alias. Put this in your .bashrc file so it's available at startup.
# Note that the --network host works only on Linux, use explicit port mapping for Windows and Mac
alias pixano='function ne() { if [ -d "$(pwd)/$1" ]; then DATA="$(pwd)/$1" && shift; else DATA="$(pwd)"; fi; sudo docker run --init -it --rm --network host -v "$DATA":/data pixano/pixano-app $@; }; ne'

# Now run pixano using alias with workspace as argument
pixano ./data-test --port 3001
# or omit workspace and use current directory by default
# pixano
```


### Install from source [for developpers]

#### Install global dependencies

- NodeJS (>=12)
	To install on ubuntu:

```bash
# Make sure you have curl installed
sudo apt install curl
# Then download and execute the Node.js 10.x installer
curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -
# Once the installer is done doing its thing, you will need to install (or upgrade) Node.js
sudo apt install nodejs
# Make sure the version is now correct
nodejs --version
npm install -g npm@6.10.0
```
	You can read this nice [introduction](https://codeburst.io/the-only-nodejs-introduction-youll-ever-need-d969a47ef219) to NodeJS in case you're curious on how it works.

#### Install application dependencies

```bash
npm run deps
```

##### Using a local pixano-element
If you want to use custom `pixano-element` modules from local path instead of the NPM registry, link them as explained below:

```bash
# Install application dependencies and local pixano-elements
cd frontend/ && npm run installLocalElements --path=../../pixano-elements && cd -
```
*NB: Make sure you have the git repository of pixano-elements next to the pixano-app folder and that you have followed the pixano-elements build instructions before running the above commands.*

#### Build the application

```bash
# Bundle the application using Webpack
# This will create a build folder containing all the sources to be served
npm run build
```

#### Run the application

In the command prompt, type in `node server/server.js /path/to/your/workspace` from the root folder and hit enter.

*NB: Make sure when typing this command that the workspace (`/path/to/your/workspace`) contains all of the data you want to use.*




## 2. Usage

After running Pixano-App, you’ll see something similar to this:

```bash
   ┌────────────────────────────────────────────────────────────────────────┐
   │                                                                        │
   │   Serving   /path/to/your/workspace                                    │
   │                                                                        │
   │   - Local:            http://localhost:3000                            │
   │   - On Your Network:  http://xxx.xxx.x.xx:3000                         │
   │                                                                        │
   └────────────────────────────────────────────────────────────────────────┘
```

Open your browser and hit `localhost:3000`. You should see the login page of the application.

### Login page

![pixano-elements](./frontend/images/login.png)

First authentification is: `username: admin` `password: admin`.

### Create a new task

You can then create your annotation project in the `Tasks` tab or update your login in the `Users` tab.

If your `data-test` folder has the following structure:
```
data-test   
│
└───images
    │   xxx.jpg
    │   yyy.jpg
    │
    │   ...
```
You can fill the task configuration as follows, which will create as many annotation jobs as there are images in your `image` folder:

*NB: Your `data-test` folder refers to the folder containing the images you want to annotate by a relative path to the `workspace` folder.*

![task-creation](./frontend/images/task-creation.png)

*Update 2020.12.04: Make sure your image extensions are either `png` or `jpg`.

*Update 2021.03.05: Videos are not directly handled: extract the video frames beforehand. For every plugin taking a sequence as input (e.g. `sequence-rectangle`, `sequence-polygon`, `tracking`, etc), each subfolder containing images will be considered as a sequence.

### Start annotating

**TODO**




## 3. Contributing

### Getting started

If you want to edit the application to your liking, fork this repository.

- To get familiar with how the app is built from Web Components, read the [LitElement](https://lit-element.polymer-project.org/) documentation.
- To get familiar with how the data is managed in the client, read the [redux](https://redux.js.org/introduction/getting-started) documentation.
- To better understand the Pixano server API, read its [documentation](documentation/rest-api.md)

### Pull request

**TODO**

### Build docker from sources

To create a docker image of the application, build the application (step 1.b) and then run:
```bash
# You can change `pixano` by your choosen image name
sudo docker build -t pixano/pixano-app:my-tag .
# You can use the local Dockerfile if the build folder already exists
sudo docker build -t pixano/pixano-app:my-tag -f Dockerfile-local .
```




## 4. Documentation

### Import predictions

**TODO**
explications sur l'utilité
=> Import predictions as existing annotations
=> follow [Import/Export annotation format](#importexport-annotation-format)

### Import/Export annotation format

```
data-test   
│
│───images
│   │    xxx.jpg
│   └─── yyy.jpg
│       
└───annotations
    │─── task1.json
    └─── task1
        │    xxx.json
        └─── yyy.json
```
The `task1.json` file contains global task settings (task type, task categories, image folder, etc) and its correspoding `task1` folder contains an annotation file for each image. To prepare those files check the [import documentation](documentation/import-annotations.md).



