const path = require('path');

module.exports = {
	mode: 'development',
	entry: path.resolve(__dirname, './dashboard-demo.js'),
	output: {
		path: path.resolve(__dirname),
		filename: 'dashboard-demo-bundle.js'
	},
	resolve: {
		extensions: ['.ts', '.tsx', '.js']
	},
	devtool: 'eval-source-map',
	module: {
		rules: [
			{
				test: /\.(js|mjs|jsx|ts|tsx)$/,
				use: ["source-map-loader"],
				enforce: "pre"
			}
		]
	}
};
