const fs = require("node:fs/promises");
const path = require("node:path");

const { FusesPlugin } = require("@electron-forge/plugin-fuses");
const { AutoUnpackNativesPlugin } = require("@electron-forge/plugin-auto-unpack-natives");
const { WebpackPlugin } = require("@electron-forge/plugin-webpack");
const { FuseV1Options, FuseVersion } = require("@electron/fuses");

const certificateFile = process.env.WINDOWS_CERTIFICATE_FILE;
const certificatePassword = process.env.WINDOWS_CERTIFICATE_PASSWORD;
const squirrelSigning =
  certificateFile && certificatePassword ? { certificateFile, certificatePassword } : {};

module.exports = {
  hooks: {
    packageAfterPrune: async (_forgeConfig, buildPath) => {
      const packagePath = path.join(buildPath, "package.json");
      const packageJson = JSON.parse(await fs.readFile(packagePath, "utf8"));
      packageJson.main = ".webpack/main/index.cjs";
      await fs.writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
    },
  },
  packagerConfig: {
    asar: true,
    executableName: "website-audit-tool",
    extraResource: [path.resolve(__dirname, ".playwright-browsers")],
    ignore: (file) => {
      if (!file) return false;
      if (/^[/\\]node_modules[/\\]\.pnpm(?:$|[/\\])/.test(file)) return true;
      return !/^[/\\](?:\.webpack|node_modules)(?:$|[/\\])/.test(file);
    },
    name: "Website Audit Tool",
    prune: true,
  },
  rebuildConfig: {},
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "website_audit_tool",
        setupExe: "WebsiteAuditToolSetup.exe",
        ...squirrelSigning,
      },
    },
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new WebpackPlugin({
      mainConfig: "./webpack.main.config.cjs",
      renderer: {
        config: "./webpack.renderer.config.cjs",
        entryPoints: [
          {
            html: "./src/desktop/renderer/index.html",
            js: "./src/desktop/renderer/index.tsx",
            name: "main_window",
            preload: {
              js: "./src/desktop/preload/index.ts",
            },
          },
        ],
      },
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
