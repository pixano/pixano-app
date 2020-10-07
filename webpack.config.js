const path = require('path');

module.exports = {
  mode: 'production',
  entry: path.resolve(__dirname, './src/app.js'),
  output: {
    path: path.resolve(__dirname, './build'),
    filename: 'app.js'
  },
  optimization: {
    usedExports: true
  },
  resolve: {
    alias: {
      '@material/mwc-slider': path.resolve(path.join(__dirname, 'node_modules', '@material/mwc-slider')),
      '@material/mwc-icon': path.resolve(path.join(__dirname, 'node_modules', '@material/mwc-icon')),
      '@material/mwc-button': path.resolve(path.join(__dirname, 'node_modules', '@material/mwc-button')),
      '@material/mwc-icon-button': path.resolve(path.join(__dirname, 'node_modules', '@material/mwc-icon-button')),
      '@material/mwc-notched-outline': path.resolve(path.join(__dirname, 'node_modules', '@material/mwc-notched-outline')),
      '@material/mwc-dialog': path.resolve(path.join(__dirname, 'node_modules', '@material/mwc-dialog')),
      '@material/mwc-list': path.resolve(path.join(__dirname, 'node_modules', '@material/mwc-list')),
      '@material/mwc-menu': path.resolve(path.join(__dirname, 'node_modules', '@material/mwc-menu')),
      '@material/mwc-select': path.resolve(path.join(__dirname, 'node_modules', '@material/mwc-select')),
      'lit-element': path.resolve(path.join(__dirname, 'node_modules', 'lit-element'))
     }
  },
  module: {
    rules: [
      {
        test: /\.(sa|sc|c)ss$/,
        use: [
          'style-loader',
          'css-loader',
          'sass-loader',
        ],
      },
      { test: /\.(png|woff|woff2|eot|ttf|svg)$/, use: ['url-loader?limit=100000'] },
      {
        test: /\.(js|mjs|jsx|ts|tsx)$/,
        use: ["source-map-loader"],
        enforce: "pre"
      }
    ]
  }
};
