const args = require('args')
const { serve } = require('../server/server');

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
//const logo =`
//_____________                            
//___  __ \\__(_)___  _______ _____________ 
//__  /_/ /_  /__  |/_/  __ \`/_  __ \\  __ \\ 
//_  ____/_  / __>  < / /_/ /_  / / / /_/ /
///_/     /_/  /_/|_| \\__,_/ /_/ /_/\\____/                                      
//`

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
			console.error("ERROR: Only one workspace can be specified.");
			args.showHelp();
		}
	}
	
	// 2) launch the server
	console.log(logo);
	serve(flags.workspace, flags.port, flags);
}

