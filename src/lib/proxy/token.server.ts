/**
 * JWT proxy tokens. Signs the upstream m3u8 URL so the proxy can fetch it
 * later without needing a separate session store.
 */
import { SignJWT, jwtVerify } from "jose";
import { ApiError } from "../api/errors";
import { getConfig } from "../config.server";

export interface ProxyClaims {
  /** Upstream playlist URL the proxy is allowed to fetch. */
  u: string;
  /** Optional Referer to forward upstream. */
  r?: string;
  /** Provider name (logging). */
  p?: string;
}

function secretBytes(): Uint8Array {
  return new TextEncoder().encode(getConfig().jwtSecret);
}

export async function signProxyToken(claims: ProxyClaims): Promise<{ token: string; expiresAt: string }> {
  const cfg = getConfig();
  const exp = Math.floor(Date.now() / 1000) + cfg.proxyTokenTtl;
  const token = await new SignJWT(claims as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(secretBytes());
  return { token, expiresAt: new Date(exp * 1000).toISOString() };
}

export async function verifyProxyToken(token: string): Promise<ProxyClaims> {
  try {
    const { payload } = await jwtVerify(token, secretBytes(), { algorithms: ["HS256"] });
    if (!payload || typeof (payload as { u?: unknown }).u !== "string") {
      throw new ApiError("PROXY_TOKEN_INVALID", "Malformed proxy token payload");
    }
    return payload as unknown as ProxyClaims;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/exp/i.test(msg) || /expired/i.test(msg)) {
      throw new ApiError("PROXY_TOKEN_EXPIRED", msg);
    }
    throw new ApiError("PROXY_TOKEN_INVALID", msg);
  }
}
