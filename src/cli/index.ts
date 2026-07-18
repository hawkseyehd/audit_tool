#!/usr/bin/env node

import pino from "pino";

import { createLogger } from "../infrastructure/logger.js";
import { executeCli } from "./program.js";
import { runFoundationAudit } from "./runner.js";

const logger = createLogger({
  destination: pino.destination({ dest: 2, sync: true }),
});

const exitCode = await executeCli(process.argv, {
  logger,
  runAudit: runFoundationAudit,
  writeError: (message) => process.stderr.write(`${message}\n`),
  writeOut: (message) => process.stdout.write(`${message}\n`),
});

process.exitCode = exitCode;
