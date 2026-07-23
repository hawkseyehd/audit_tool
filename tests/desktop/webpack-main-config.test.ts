import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

import { afterEach, describe, expect, it } from "vitest";

interface MainConfig {
  plugins: { apply(compiler: unknown): void }[];
}

type AfterEmit = (compilation: { outputOptions: { path?: string } }) => Promise<void>;

const require = createRequire(import.meta.url);
const mainConfig = require("../../webpack.main.config.cjs") as MainConfig;
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("desktop webpack main configuration", () => {
  it("writes the Electron development entry bridge beside the main bundle directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "website-audit-webpack-main-"));
    temporaryDirectories.push(root);
    const outputPath = join(root, "main");
    await mkdir(outputPath, { recursive: true });

    let afterEmit: AfterEmit | undefined;
    const compiler = {
      hooks: {
        afterEmit: {
          tapPromise: (_name: string, callback: AfterEmit) => {
            afterEmit = callback;
          },
        },
        thisCompilation: {
          tap: (_name: string, callback: (compilation: unknown) => void) => {
            callback({ hooks: { processAssets: { tap: () => undefined } } });
          },
        },
      },
      webpack: {
        Compilation: { PROCESS_ASSETS_STAGE_ADDITIONAL: 0 },
        sources: {},
      },
    };

    mainConfig.plugins[0]?.apply(compiler);
    if (afterEmit === undefined) throw new Error("Webpack afterEmit hook was not registered");
    await afterEmit({ outputOptions: { path: outputPath } });

    const bridgePath = join(dirname(outputPath), "main.js");
    await expect(readFile(bridgePath, "utf8")).resolves.toBe('import "./main/index.cjs";\n');
  });
});
