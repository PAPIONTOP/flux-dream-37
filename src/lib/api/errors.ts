/**
 * RFC 7807 problem+json errors.
 */
export type ErrorCode =
  | "TMDB_NOT_FOUND"
  | "TMDB_API_ERROR"
  | "SOURCE_NOT_FOUND"
  | "SCRAPE_FAILED"
  | "STREAM_INVALID"
  | "PROXY_TOKEN_EXPIRED"
  | "PROXY_TOKEN_INVALID"
  | "SCRAPER_BUSY"
  | "NO_STREAM_FOUND"
  | "PROVIDER_UNSUPPORTED"
  | "UNAUTHORIZED"
  | "BAD_REQUEST"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  TMDB_NOT_FOUND: 404,
  TMDB_API_ERROR: 502,
  SOURCE_NOT_FOUND: 404,
  SCRAPE_FAILED: 502,
  STREAM_INVALID: 502,
  PROXY_TOKEN_EXPIRED: 401,
  PROXY_TOKEN_INVALID: 401,
  SCRAPER_BUSY: 503,
  NO_STREAM_FOUND: 404,
  PROVIDER_UNSUPPORTED: 501,
  UNAUTHORIZED: 401,
  BAD_REQUEST: 400,
  INTERNAL: 500,
};

const TITLE: Record<ErrorCode, string> = {
  TMDB_NOT_FOUND: "TMDB id not found",
  TMDB_API_ERROR: "TMDB API error",
  SOURCE_NOT_FOUND: "Content not found on source site",
  SCRAPE_FAILED: "Extraction failed",
  STREAM_INVALID: "Extracted stream URL is not reachable",
  PROXY_TOKEN_EXPIRED: "Proxy token expired",
  PROXY_TOKEN_INVALID: "Proxy token invalid",
  SCRAPER_BUSY: "Scraper concurrency limit reached",
  NO_STREAM_FOUND: "No stream detected on the page",
  PROVIDER_UNSUPPORTED: "Provider not implemented",
  UNAUTHORIZED: "Unauthorized",
  BAD_REQUEST: "Bad request",
  INTERNAL: "Internal server error",
};

export class ApiError extends Error {
  code: ErrorCode;
  detail: string;
  extra?: Record<string, unknown>;
  constructor(code: ErrorCode, detail: string, extra?: Record<string, unknown>) {
    super(`${code}: ${detail}`);
    this.code = code;
    this.detail = detail;
    this.extra = extra;
  }
}

export function problemResponse(
  err: ApiError,
  instance: string,
  extraHeaders: Record<string, string> = {},
): Response {
  const status = STATUS[err.code];
  const body = {
    type: `/errors/${err.code}`,
    title: TITLE[err.code],
    status,
    detail: err.detail,
    instance,
    ...(err.extra ?? {}),
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/problem+json",
      ...extraHeaders,
    },
  });
}

export function toApiError(e: unknown, fallback: ErrorCode = "INTERNAL"): ApiError {
  if (e instanceof ApiError) return e;
  const msg = e instanceof Error ? e.message : String(e);
  return new ApiError(fallback, msg);
}

export function handle(e: unknown, instance: string): Response {
  const err = toApiError(e);
  const headers: Record<string, string> = {};
  if (err.code === "SCRAPER_BUSY") headers["retry-after"] = "5";
  return problemResponse(err, instance, headers);
}
