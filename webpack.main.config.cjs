const path = require("node:path");

class MainProcessManifestPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap("MainProcessManifestPlugin", (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: "MainProcessManifestPlugin",
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
        },
        () => {
          compilation.emitAsset(
            "package.json",
            new compiler.webpack.sources.RawSource('{"main":"index.cjs","type":"commonjs"}\n'),
          );
        },
      );
    });
  }
}

module.exports = {
  entry: {
    index: "./src/desktop/main/index.ts",
    worker: "./src/desktop/worker/index.ts",
  },
  externals: {
    "@prisma/client": "commonjs2 @prisma/client",
  },
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
    ],
  },
  output: {
    filename: "[name].cjs",
  },
  plugins: [new MainProcessManifestPlugin()],
  resolve: {
    extensionAlias: {
      ".js": [".js", ".ts"],
    },
    extensions: [".ts", ".tsx", ".js"],
  },
  target: "electron-main",
};
