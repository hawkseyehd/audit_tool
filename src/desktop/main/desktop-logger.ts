import path from "node:path";

import pino, { type Logger } from "pino";

import { createLogger } from "../../infrastructure/logger.js";

export function createDesktopLogger(logDirectory: string): Logger {
  const destination = pino.destination({
    dest: path.join(logDirectory, "desktop.log"),
    mkdir: true,
    sync: false,
  });
  return createLogger({ destination });
}
