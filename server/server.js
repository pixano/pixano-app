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
const { initDB } = require(__dirname + '/config/db');
const os = require( 'os' );
const interfaces = os.networkInterfaces();
const chalk = require('chalk');
const boxen = require('boxen');
const fs = require('fs');
const arg = require('arg');
const pkg = require('../package');

// TODO: port starting with 443 should have https
let port = process.env.PORT || 3000;

const getNetworkAddress = () => {
	for (const name of Object.keys(interfaces)) {
		for (const interface of interfaces[name]) {
			const {address, family, internal} = interface;
			if (family === 'IPv4' && !internal) {
				return address;
			}
		}
	}
};

const getHelp = () => chalk`
  {bold.cyan pixano} - Annotation Application server
  {bold USAGE}
      {bold $} {cyan pixano} --help
      {bold $} {cyan pixano} --version
      {bold $} {cyan pixano} --port 3001
      {bold $} {cyan pixano} workspace_path
  {bold OPTIONS}
      --help                              Shows this help message
      -v, --version                       Displays the current version of serve
      -d, --debug                         Show debugging information
`;

let args = null;
try {
  args = arg({
    '--help': Boolean,
    '--version': Boolean,
    '--debug': Boolean,
    '--port': Number,
    '-h': '--help',
    '-v': '--version',
    '-d': '--debug',
    '-p': '--port'
  });
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

if (args['--version']) {
  console.log(pkg.version);
  return;
}

if (args['--help']) {
  console.log(getHelp());
  return;
}

if (args['--port']) {
  port = args['--port'];
}


const entry = args._.length > 0 ? path.resolve(args._[0]) : '/data/';

// support json encoded bodies
// and set maximal entity request size (default is 100Kb)
app.use(express.json({limit: '50mb', extended: true}));
app.use(express.urlencoded({limit: '50mb', extended: true}));
app.use('/data/', express.static(entry));
app.use('/data/', express.static(path.resolve('server/'), { maxAge: '1d' }));
app.use(cookieParser());

if (!fs.existsSync(entry)) {
  console.error('Please enter a valid path for workspace:');
  console.log(getHelp());
  return;
}

// initialize database
initDB(entry).then(() => {
  app.use(serveStatic(__dirname + '/../build/'));
  // must be imported after leveldb is initialized
  // otherwise imported db value is not consistent with
  // exported db value.
  const router = require(__dirname + '/router');

  // Mount the router at /api/v1 so all its routes start with /api/v1
  app.use('/api/v1', router);

  function displayNetworkInfo(server, protocol="http") {
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
      
      let message = chalk.green('Serving', entry);

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

