const path = require("node:path");

module.exports = {
  devtool: "source-map",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: {
          loader: "ts-loader",
          options: {
            configFile: path.resolve(__dirname, "tsconfig.desktop.json"),
            transpileOnly: true,
          },
        },
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  resolve: {
    extensionAlias: {
      ".js": [".js", ".ts", ".tsx"],
    },
    extensions: [".ts", ".tsx", ".js"],
  },
};
