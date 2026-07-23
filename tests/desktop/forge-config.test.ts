import path from "node:path";
import { createRequire } from "node:module";

import { afterEach, describe, expect, it } from "vitest";

interface ForgeConfig {
  makers: {
    config: {
      certificateFile?: string;
      certificatePassword?: string;
      name: string;
      setupExe: string;
    };
    name: string;
  }[];
  packagerConfig: {
    asar: boolean;
    extraResource: string[];
    prune: boolean;
  };
}

const require = createRequire(import.meta.url);
const configPath = require.resolve("../../forge.config.cjs");
const originalCertificateFile = process.env.WINDOWS_CERTIFICATE_FILE;
const originalCertificatePassword = process.env.WINDOWS_CERTIFICATE_PASSWORD;

afterEach(() => {
  if (originalCertificateFile === undefined)
    Reflect.deleteProperty(process.env, "WINDOWS_CERTIFICATE_FILE");
  else process.env.WINDOWS_CERTIFICATE_FILE = originalCertificateFile;
  if (originalCertificatePassword === undefined)
    Reflect.deleteProperty(process.env, "WINDOWS_CERTIFICATE_PASSWORD");
  else process.env.WINDOWS_CERTIFICATE_PASSWORD = originalCertificatePassword;
  Reflect.deleteProperty(require.cache, configPath);
});

describe("Electron Forge release configuration", () => {
  it("packages the app in ASAR with a project-managed browser resource", () => {
    const config = loadConfig();
    expect(config.packagerConfig).toMatchObject({ asar: true, prune: true });
    expect(config.packagerConfig.extraResource).toEqual([path.resolve(".playwright-browsers")]);
  });

  it("keeps Squirrel signing environment-driven and out of source", () => {
    process.env.WINDOWS_CERTIFICATE_FILE = "C:\\release\\certificate.pfx";
    process.env.WINDOWS_CERTIFICATE_PASSWORD = "secret-from-release-environment";
    const config = loadConfig();
    expect(config.makers[0]).toMatchObject({
      config: {
        certificateFile: "C:\\release\\certificate.pfx",
        certificatePassword: "secret-from-release-environment",
        name: "website_audit_tool",
        setupExe: "WebsiteAuditToolSetup.exe",
      },
      name: "@electron-forge/maker-squirrel",
    });
  });
});

function loadConfig(): ForgeConfig {
  Reflect.deleteProperty(require.cache, configPath);
  return require(configPath) as ForgeConfig;
}
