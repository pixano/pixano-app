const args = require('args')
//import serve from '../server/server';
const { bidule, serve } = require('../server/server');

const logo =
`
                             ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒
                           ▒▓▒                                       ▓
              █▓          ▓▓                                         ▓
                        ▒▓▒   ▒▓▓▓▓▓ ▒▓   ▓▒▒▓▓▓▓▒     ▒▓▓▓▓▓▒       ▓
▓▓ ▓▓▓▓▓▓▒    ▓▒  ▒▓   ▓▒   ▒▓      ▓██   ██     ▓▒  ▒█▓     ▒█▓     ▓
███      ▓▓   █▒   ▓█      ▒█▒       ██   █▒     ▒█  ▓▒        █     ▓
██        █▒  █▒    ▒█▓     █▒       ██   █▒     ▒█  ▓▓        █     ▓
██        █▒  █▒    ▓█▓█     █▒     ▓██   █▒     ▒█   ██     ▓█▒     ▓
██▓▒    ▒▓▒   █▒   ▓▒  ▒█▓    ▒▓▓▓▓▓ ▒▓   ▓      ▒▓    ▒▓▓▓▓▓▒       ▓
██  ▒▓▓▒▒     ▒   ▒      ▒▓▒                                         ▓
██                         █▓                                        ▓
`

// implement a user friendly CLI
export function cli(argv) {
	
	// 1) define options and help messages
	//help and version are automatically generated
	args
//		.option('debug', 'Show debugging information')//TODO
		.option('port', 'The port on which the app will be running', process.env.PORT || 3000)
		.option('workspace', 'Your workspace: it must contain all of the data you want to use', '/data/')
//		.command('serve', 'Serve your static site', aCommand, [''])
		.example('pixano /path/to/workspace','The most common way to use Pixano:')
		.example('pixano --workspace /path/to/workspace --port 5001','Run on a specific port:')

	const flags = args.parse(argv);
	
	// exception : adding workspace without -w is allowed
	if (args.sub.length) {
		if (flags.workspace === '/data/') flags.workspace = args.sub[0];
		else {
			console.error("ERROR: Only one worspace can be specified.");
			args.showHelp();
		}
	}
	
	// 2) launch the server
	console.log(logo);
	serve(flags.workspace, flags.port);
}

//function aCommand (name, sub, options) {
//	console.log("ac",name); // The name of the command
//	console.log("ac",sub); // The output of .sub
//	console.log("ac",options); // An object containing the options that have been used
//}
