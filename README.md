# <img src="images/pixano_logo.png" alt="Pixano" height="100"/>

Pixano App
===============
[![License](https://img.shields.io/badge/license-CeCILL--C-blue.svg)](LICENSE) [![Live Demo](https://img.shields.io/badge/demo-online-green.svg)](http://pixano.cea.fr/smart-annotation/)

Pixano App is a web-based annotation tool. It relies on web components dedicated to annotation [pixano-elements](https://github.com/pixano/pixano-elements). This document explains how to run it.

*NB: If you want to use custom pixano-elements instead of the npm hosted, you must have a compiled repository of pixano-elements next to `pixano-app` repository.*


## Dependencies

- NodeJS (>=10)
  To install on ubuntu:
  ```bash
  # Make sure you have curl installed
  sudo apt install curl
  # Then download and execute the Node.js 10.x installer
  curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash -
  # Once the installer is done doing its thing, you will need to install (or upgrade) Node.js
  sudo apt install nodejs
  # Make sure the version is now correct
  nodejs --version
  ```
  You can read this nice [introduction](https://codeburst.io/the-only-nodejs-introduction-youll-ever-need-d969a47ef219) to NodeJS in case you're curious on how it works:


## How to use

### 1) Install server and client dependencies

```bash
# Install application dependencies
npm i
```

Note: if you want to use custom pixano-element modules from local path instead of the NPM registry, link them as explained below:
NB: Make sure you have the git repository of pixano-elements next to the pixano-app folder and that you have followed the pixano-elements build instructions before running the following commands:
```bash
# Install application dependencies
npm i ../pixano-elements/packages/core ../pixano-elements/packages/ai ../pixano-elements/packages/graphics-2d ../pixano-elements/packages/graphics-3d
```
### 2) Build the application

```bash
# Bundle the application using Webpack
# This will create a build folder containing all the sources to be served
npm run build
```

### 3) Run the application

 In the command prompt, type in `node server/server.js /path/to/workspace/` and hit enter. You’ll see something similar to this.

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

E.g: `node server/server.js ./data-test/`.

Open your browser and hit `localhost:3000`. You should see the login page of the application. First authentification is: `username: admin` `password: admin`. You can then create your annotation project in the `Tasks` tab or update your login in the `Users` tab.


*NB: When creating an annotation task, you will refer to the folder containing the images you want to annotate by a relative path from the `workspace` folder. Make sure when typing `node server/server.js /path/to/workspace/` that it contains all of the data you want to use.*


## Run docker

To create a docker image of the application, build the application (step 1 and 2) and then run:
```bash
# You can change `pixano` by your choosen image name
sudo docker build -t pixano .
```

Then run:
```bash
# -p 3000:3000 exposes the 3000 port of the docker container to your host machine
# If the port 3000 is already taken on your machine, replace by your
# choosen port. E.g: -p 3001:3000
# -v "$PWD":/data mounts the folder from which the command is written
# to the /data folder in the docker container. If your workspace
# containing the data is located elsewhere, please change accordingly.
sudo docker run -it --rm -v "$PWD":/data -p 3000:3000 pixano
```

## Contributing

If you want to edit the application to your liking, fork this repository.

- To get familiar with how the app is buit from Web Components, read the [LitElement](https://lit-element.polymer-project.org/) documentation.
- To get familiar with how the data is managed in the client, read the [redux](https://redux.js.org/introduction/getting-started) documentation.
- To better understand the Pixano server API, read its [documentation](documentation/rest-api.md)

