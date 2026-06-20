/**
 * HLS proxy. Matches /api/public/v1/proxy/$token/* — the splat carries the
 * "kind" of resource ("index.m3u8", "playlist.m3u8", "segment.ts", "key", ...).
 * We don't need to interpret the suffix; we fetch upstream, sniff the
 * content-type, rewrite if it's a playlist, otherwise stream the body.
 */
import { createFileRoute } from "@tanstack/react-router";
import { handle, ApiError } from "@/lib/api/errors";
import { verifyProxyToken } from "@/lib/proxy/token.server";
import { rewritePlaylist } from "@/lib/proxy/rewrite.server";
import { getConfig } from "@/lib/config.server";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, HEAD, OPTIONS",
  "access-control-allow-headers": "Range, Content-Type",
  "access-control-expose-headers": "Content-Length, Content-Range, Accept-Ranges",
};

export const Route = createFileRoute("/api/public/v1/proxy/$token/$")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      HEAD: async ({ request, params }) => proxyRequest(request, params, true),
      GET: async ({ request, params }) => proxyRequest(request, params, false),
    },
  },
});

async function proxyRequest(
  request: Request,
  params: { token: string; _splat?: string },
  headOnly: boolean,
): Promise<Response> {
  const reqUrl = new URL(request.url);
  const instance = reqUrl.pathname;
  try {
    const claims = await verifyProxyToken(params.token);
    const upstream = claims.u;
    const range = request.headers.get("range");
    const cfg = getConfig();

    const upstreamHeaders: Record<string, string> = {
      "user-agent": cfg.source.userAgent,
      accept: "*/*",
    };
    if (range) upstreamHeaders.range = range;
    if (claims.r) {
      upstreamHeaders.referer = claims.r;
      upstreamHeaders.origin = new URL(claims.r).origin;
    }

    const res = await fetch(upstream, {
      method: headOnly ? "HEAD" : "GET",
      headers: upstreamHeaders,
      redirect: "follow",
    });

    const ct = res.headers.get("content-type") ?? "";
    if (!res.ok) {
      return new Response(`Upstream stream returned ${res.status}`, {
        status: 502,
        headers: {
          ...CORS,
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    const isPlaylist =
      /application\/vnd\.apple\.mpegurl|application\/x-mpegurl|audio\/mpegurl/i.test(ct) ||
      /\.m3u8(\?|$)/i.test(upstream);

    const proxyBase = `${reqUrl.origin}/api/public/v1/proxy`;

    if (isPlaylist && !headOnly) {
      const body = await res.text();
      if (!body.trimStart().startsWith("#EXTM3U")) {
        return new Response("Upstream did not return a valid HLS playlist", {
          status: 502,
          headers: {
            ...CORS,
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "no-store",
          },
        });
      }
      const rewritten = await rewritePlaylist(body, upstream, proxyBase, claims.r);
      return new Response(rewritten, {
        status: 200,
        headers: {
          ...CORS,
          "content-type": "application/vnd.apple.mpegurl",
          "cache-control": "no-store",
        },
      });
    }

    // Stream pass-through (segments, keys, init).
    const outHeaders = new Headers(CORS);
    for (const h of [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "cache-control",
      "etag",
      "last-modified",
    ]) {
      const v = res.headers.get(h);
      if (v) outHeaders.set(h, v);
    }
    if (!outHeaders.has("content-type")) outHeaders.set("content-type", "video/mp2t");

    return new Response(headOnly ? null : res.body, {
      status: res.status,
      headers: outHeaders,
    });
  } catch (e) {
    if (e instanceof ApiError) return handle(e, instance);
    return handle(new ApiError("STREAM_INVALID", String(e)), instance);
  }
}
