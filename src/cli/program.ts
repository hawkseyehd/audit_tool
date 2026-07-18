import { Command, CommanderError, InvalidArgumentError, Option } from "commander";
import { ZodError } from "zod";

import { AUDIT_LIMITS, parseAuditConfig, type AuditConfig } from "../config/audit-config.js";
import type { AuditRunReceipt, AuditRunner } from "./runner.js";

const CLI_VERSION = "0.1.0";

interface AuditCliOptions {
  readonly desktop?: boolean;
  readonly json?: boolean;
  readonly markdown?: boolean;
  readonly maxPages: number;
  readonly mobile?: boolean;
  readonly output: string;
}

export interface CliLogger {
  info(bindings: Record<string, unknown>, message: string): void;
  warn(bindings: Record<string, unknown>, message: string): void;
  error(bindings: Record<string, unknown>, message: string): void;
}

export interface CliDependencies {
  readonly logger: CliLogger;
  readonly runAudit: AuditRunner;
  readonly writeError: (message: string) => void;
  readonly writeOut: (message: string) => void;
}

export async function executeCli(
  argv: readonly string[],
  dependencies: CliDependencies,
): Promise<number> {
  const program = createProgram(dependencies);

  try {
    await program.parseAsync([...argv]);
    return 0;
  } catch (error: unknown) {
    if (error instanceof CommanderError) {
      if (error.exitCode === 0) {
        return 0;
      }

      return error.code === "commander.invalidArgument" ? 2 : error.exitCode;
    }

    if (error instanceof ZodError) {
      const issues = error.issues.map((issue) => {
        const path = issue.path.length === 0 ? "configuration" : issue.path.join(".");
        return `- ${path}: ${issue.message}`;
      });

      dependencies.logger.warn({ issueCount: issues.length }, "CLI configuration rejected");
      dependencies.writeError(`Invalid audit configuration:\n${issues.join("\n")}`);
      return 2;
    }

    const message = error instanceof Error ? error.message : "Unknown runtime error";
    const errorType = error instanceof Error ? error.name : typeof error;

    dependencies.logger.error({ errorMessage: message, errorType }, "CLI audit failed");
    dependencies.writeError(`Audit failed: ${message}`);
    return 1;
  }
}

function createProgram(dependencies: CliDependencies): Command {
  const program = new Command()
    .name("website-audit")
    .description("Audit a public business website and generate actionable findings.")
    .version(CLI_VERSION)
    .showHelpAfterError()
    .exitOverride()
    .configureOutput({
      writeErr: (message) => {
        dependencies.writeError(message.trimEnd());
      },
      writeOut: (message) => {
        dependencies.writeOut(message.trimEnd());
      },
    });

  program
    .command("audit")
    .description("Initialize and run a website audit.")
    .argument("<url>", "Target website URL")
    .addOption(
      new Option("--max-pages <count>", "Maximum number of pages to crawl")
        .default(AUDIT_LIMITS.maxPages.default)
        .argParser(parseInteger),
    )
    .option("--output <directory>", "Directory for audit output", "./reports")
    .option("--mobile", "Enable the mobile viewport")
    .option("--desktop", "Enable the desktop viewport")
    .option("--json", "Write structured JSON output")
    .option("--markdown", "Write a Markdown report")
    .option("--no-submit-forms", "Explicitly keep form submission disabled")
    .action(async (targetUrl: string, options: AuditCliOptions) => {
      const config = buildAuditConfig(targetUrl, options);

      dependencies.writeOut(`Starting audit for ${config.targetUrl}`);
      dependencies.logger.info(
        {
          maxPages: config.maxPages,
          targetUrl: config.targetUrl,
          viewports: config.viewports,
        },
        "Audit command started",
      );

      const receipt = await dependencies.runAudit(config);
      writeReceipt(receipt, dependencies);

      dependencies.logger.info(
        {
          auditId: receipt.auditId,
          scannedPageCount: receipt.scannedPageCount,
          status: receipt.status,
        },
        "Audit command finished",
      );
    });

  return program;
}

function buildAuditConfig(targetUrl: string, options: AuditCliOptions): AuditConfig {
  const viewports = resolveViewports(options);
  const outputFormats = resolveOutputFormats(options);

  return parseAuditConfig({
    targetUrl,
    maxPages: options.maxPages,
    outputDir: options.output,
    viewports,
    writeJson: outputFormats.writeJson,
    writeMarkdown: outputFormats.writeMarkdown,
    submitForms: false,
  });
}

function resolveViewports(options: AuditCliOptions): ("desktop" | "mobile")[] {
  const viewports: ("desktop" | "mobile")[] = [];

  if (options.desktop === true) {
    viewports.push("desktop");
  }
  if (options.mobile === true) {
    viewports.push("mobile");
  }

  return viewports.length === 0 ? ["desktop"] : viewports;
}

function resolveOutputFormats(options: AuditCliOptions): {
  readonly writeJson: boolean;
  readonly writeMarkdown: boolean;
} {
  if (options.json !== true && options.markdown !== true) {
    return { writeJson: true, writeMarkdown: true };
  }

  return {
    writeJson: options.json === true,
    writeMarkdown: options.markdown === true,
  };
}

function parseInteger(value: string): number {
  const parsedValue = Number(value);

  if (!Number.isSafeInteger(parsedValue)) {
    throw new InvalidArgumentError("Expected a whole number.");
  }

  return parsedValue;
}

function writeReceipt(receipt: AuditRunReceipt, dependencies: CliDependencies): void {
  const lifecycle = receipt.status === "completed" ? "completed" : "initialized";
  dependencies.writeOut(`Audit ${lifecycle}: ${receipt.auditId}`);
  dependencies.writeOut(`Scanned pages: ${String(receipt.scannedPageCount)}`);
  dependencies.writeOut(`Output directory: ${receipt.outputDirectory}`);

  if (receipt.markdownReportPath !== undefined) {
    dependencies.writeOut(`Markdown report: ${receipt.markdownReportPath}`);
  }
  if (receipt.jsonReportPath !== undefined) {
    dependencies.writeOut(`JSON report: ${receipt.jsonReportPath}`);
  }
}
