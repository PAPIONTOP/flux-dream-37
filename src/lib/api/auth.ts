import { ApiError } from "./errors";
import { getConfig } from "../config.server";

/** Throws UNAUTHORIZED if the X-API-Key header is missing/wrong. */
export function requireApiKey(request: Request): void {
  const cfg = getConfig();
  const provided = request.headers.get("x-api-key");
  if (!provided || provided !== cfg.apiKey) {
    throw new ApiError("UNAUTHORIZED", "Invalid or missing X-API-Key");
  }
}

/** Throws UNAUTHORIZED if the X-Admin-Key header is missing/wrong. */
export function requireAdminKey(request: Request): void {
  const cfg = getConfig();
  const provided = request.headers.get("x-admin-key");
  if (!provided || provided !== cfg.adminKey) {
    throw new ApiError("UNAUTHORIZED", "Invalid or missing X-Admin-Key");
  }
}
