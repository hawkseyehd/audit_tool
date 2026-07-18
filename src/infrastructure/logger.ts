import pino, {
  type DestinationStream,
  type LevelWithSilent,
  type Logger,
  type LoggerOptions,
} from "pino";

const REDACTED_VALUE = "[REDACTED]";

export const REDACTED_LOG_PATHS = [
  "password",
  "token",
  "accessToken",
  "refreshToken",
  "apiKey",
  "authorization",
  "cookie",
  "cookies",
  "formValues",
  "submittedValues",
  "headers.authorization",
  "headers.cookie",
  "req.headers.authorization",
  "req.headers.cookie",
  "request.headers.authorization",
  "request.headers.cookie",
] as const;

export interface CreateLoggerOptions {
  readonly auditId?: string;
  readonly destination?: DestinationStream;
  readonly level?: LevelWithSilent;
}

export function createLogger(options: CreateLoggerOptions = {}): Logger {
  const base: Record<string, string> = {
    service: "website-audit-tool",
  };

  if (options.auditId !== undefined) {
    base.auditId = options.auditId;
  }

  const loggerOptions: LoggerOptions = {
    base,
    level: options.level ?? "info",
    redact: {
      censor: REDACTED_VALUE,
      paths: [...REDACTED_LOG_PATHS],
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  return options.destination === undefined
    ? pino(loggerOptions)
    : pino(loggerOptions, options.destination);
}
