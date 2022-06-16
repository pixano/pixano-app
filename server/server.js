/**
 * @copyright CEA-LIST/DIASI/SIALV/LVA (2019)
 * @author CEA-LIST/DIASI/SIALV/LVA <pixano@cea.fr>
 * @license CECILL-C
*/

const express = require('express');
const app = express();
const serveStatic = require('serve-static');
const path = require('path');
const cookieParser = require('cookie-parser')
const { initLevel } = require(__dirname + '/config/db');
const dbkeys = require(__dirname + '/config/db-keys');
const os = require('os');
const interfaces = os.networkInterfaces();
const chalk = require('chalk');
const boxen = require('boxen');
const fs = require('fs');

const getNetworkAddress = () => {
	for (const name of Object.keys(interfaces)) {
		for (const i of interfaces[name]) {
			const { address, family, internal } = i;
			if (family === 'IPv4' && !internal) {
				return address;
			}
		}
	}
};

// implement a user friendly CLI
export function serve(workspace, port, cliOptions) {

	if (!fs.existsSync(workspace)) {
		console.error('Please enter a valid path for workspace (\"', workspace, '\" does not exist).');
		return;
	}

	// support json encoded bodies
	// and set maximal entity request size (default is 100Kb)
	app.use(express.json({ limit: '50mb', extended: true }));
	app.use(express.urlencoded({ limit: '50mb', extended: true }));
	app.use('/data/', express.static(workspace));
	app.use('/data/', express.static(path.resolve('server/'), { maxAge: '1d' }));
	app.use(cookieParser());

	// initialize database
	initLevel(workspace)
		.then(() => {
			// 1) store cli options
			const { db } = require(__dirname + '/config/db');
			db.put(dbkeys.keyForCliOptions, cliOptions);

			// 2) start server
			app.use(serveStatic(__dirname + '/../build/'));
			// must be imported after leveldb is initialized
			// otherwise imported db value is not consistent with
			// exported db value.
			const router = require(__dirname + '/router');

			// Mount the router at /api/v1 so all its routes start with /api/v1
			app.use('/api/v1', router);

			function displayNetworkInfo(server, protocol = "http") {
				const details = server.address();
				let localAddress = null;
				let networkAddress = null;

				if (typeof details === 'string') {
					localAddress = details;
				} else if (typeof details === 'object' && details.port) {
					const address = details.address === '::' ? 'localhost' : details.address;
					const ip = getNetworkAddress();

					localAddress = `${protocol}://${address}:${details.port}`;
					networkAddress = `${protocol}://${ip}:${details.port}`;

					let message = chalk.green('Serving', workspace);

					if (localAddress) {
						const prefix = networkAddress ? '- ' : '';
						const space = networkAddress ? '            ' : '  ';

						message += `\n\n${chalk.bold(`${prefix}Local:`)}${space}${localAddress}`;
					}

					if (networkAddress) {
						message += `\n${chalk.bold('- On Your Network:')}  ${networkAddress}`;
					}

					console.log(boxen(message, {
						padding: 1,
						borderColor: 'green',
						margin: 1
					}));
				}
			}

			// const makeCert = require('make-cert');
			// const {key, cert} = makeCert('localhost');
			// const server = https.createServer({ key, cert }, app).listen(44301, async () => displayNetworkInfo(server, "https"))
			const server = app.listen(port, async () => displayNetworkInfo(server));
		});
}
