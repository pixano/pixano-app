const path = require("path");

module.exports = {
  mode: "production",
  entry: path.resolve(__dirname, "./src/app.js"),
  output: {
    path: path.resolve(__dirname, "../build"),
    filename: "app.js",
  },
  optimization: {
    usedExports: true,
  },
  resolve: {
    alias: {
      "lit-html": path.resolve(
        path.join(__dirname, "node_modules", "lit-html")
      ),
      "lit-element": path.resolve(
        path.join(__dirname, "node_modules", "lit-element")
      ),
      "@material": path.resolve(
        path.join(__dirname, "node_modules", "@material")
      ),
    },
  },
  module: {
    rules: [
      {
        test: /\.(sa|sc|c)ss$/,
        use: ["style-loader", "css-loader", "sass-loader"],
      },
      {
        test: /\.(png|woff|woff2|eot|ttf|svg)$/,
        use: ["url-loader?limit=100000"],
      },
      {
        test: /\.(js|mjs|jsx|ts|tsx)$/,
        use: ["source-map-loader"],
        enforce: "pre",
      },
    ],
  },
};
