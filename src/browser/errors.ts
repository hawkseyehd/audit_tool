export type BrowserInspectionErrorCode =
  "blocked-navigation" | "browser-error" | "navigation-failed" | "navigation-timeout";

export class BrowserInspectionError extends Error {
  public readonly code: BrowserInspectionErrorCode;

  public constructor(
    code: BrowserInspectionErrorCode,
    message: string,
    options: ErrorOptions = {},
  ) {
    super(message, options);
    this.name = "BrowserInspectionError";
    this.code = code;
  }
}
