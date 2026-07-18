export type PageFetchErrorCode =
  | "blocked-redirect"
  | "invalid-redirect"
  | "redirect-limit"
  | "redirect-loop"
  | "response-too-large"
  | "timeout"
  | "network";

export class PageFetchError extends Error {
  public readonly code: PageFetchErrorCode;
  public readonly retryable: boolean;

  public constructor(
    code: PageFetchErrorCode,
    message: string,
    options: ErrorOptions & { readonly retryable?: boolean } = {},
  ) {
    super(message, options);
    this.name = "PageFetchError";
    this.code = code;
    this.retryable = options.retryable ?? false;
  }
}
