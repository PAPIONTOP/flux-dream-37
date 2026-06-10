# Scraping & Streaming API

Private API that resolves TMDB ids to HLS streams scraped from a configured source site.
Runs on TanStack Start + Cloudflare Workers (Lovable Cloud).

## Notable deviations from the original spec

The original spec assumed a long-running Node.js server (Fastify + Playwright + Redis + SQLite + Docker).
This project runs in an **edge serverless Worker**, so:

- **No Playwright / headless browser.** Scraping is `fetch` + `cheerio` only. Providers that require JS
  execution or dynamic tokens (voe, doodstream, jwplayer-late-loaded vidmoly, …) are best-effort.
- **Redis → Postgres** (`cache_kv` table with `expires_at`).
- **SQLite → Postgres** (`tmdb_mapping` table).
- **BullMQ → inline** (single in-process work + Postgres-backed lock).
- **Fastify → TanStack server routes** under `src/routes/api/public/v1/`.
- **JWT → `jose`** (Worker-compatible) instead of `jsonwebtoken`.
- **Docker → managed by Lovable.**

All routes live under `/api/public/v1/*` because that prefix bypasses Lovable's published-site
auth wall (necessary for an API). Endpoint security is enforced in code via `X-API-Key` and
`X-Admin-Key`.

## Required secrets

Set these in Lovable Cloud → Secrets:

| Secret | Purpose |
| --- | --- |
| `TMDB_API_KEY` | TMDB v3 key |
| `API_KEY` | Value clients must send in `X-API-Key` |
| `ADMIN_KEY` | Value admin clients must send in `X-Admin-Key` |
| `JWT_SECRET` | HMAC secret for proxy tokens (≥ 32 chars) |
| `SOURCE_BASE_URL` | Source site origin, e.g. `https://example.com` |
| `SOURCE_MOVIE_PATH` | URL template, e.g. `/film/{slug}` |
| `SOURCE_SERIES_PATH` | URL template, e.g. `/serie/{slug}/saison-{season}/episode-{episode}` |
| `SOURCE_USER_AGENT` | UA used for source requests |
| `SOURCE_COOKIES` | Optional cookies sent to the source |

Optional tuning:

| Secret | Default |
| --- | --- |
| `STREAM_CACHE_TTL` | `7200` (seconds) |
| `PROXY_TOKEN_TTL` | `14400` |
| `SCRAPER_CONCURRENCY` | `3` |

## Endpoints

```
GET    /api/public/v1/health
GET    /api/public/v1/openapi.json
GET    /api/public/v1/movie               ?tmdb_id|title&lang&mode&force_refresh
GET    /api/public/v1/movie/search        ?q&year&limit
GET    /api/public/v1/tv                  ?tmdb_id|title&season&episode&lang&mode&force_refresh
GET    /api/public/v1/tv/search           ?q&limit
GET    /api/public/v1/proxy/:token/*      (HLS proxy + rewrite, CORS *)
GET    /api/public/v1/admin/cache         ?prefix=
DELETE /api/public/v1/admin/cache/:tmdb_id
POST   /api/public/v1/admin/source
GET    /api/public/v1/admin/scraper/test  ?url=
```

## Errors

RFC 7807 (`application/problem+json`):

```json
{
  "type": "/errors/NO_STREAM_FOUND",
  "title": "No stream detected on the page",
  "status": 404,
  "detail": "No stream detected at https://...",
  "instance": "/api/public/v1/movie?tmdb_id=550"
}
```

Codes: `TMDB_NOT_FOUND`, `TMDB_API_ERROR`, `SOURCE_NOT_FOUND`, `SCRAPE_FAILED`, `STREAM_INVALID`,
`PROXY_TOKEN_EXPIRED`, `PROXY_TOKEN_INVALID`, `SCRAPER_BUSY`, `NO_STREAM_FOUND`,
`PROVIDER_UNSUPPORTED`, `UNAUTHORIZED`, `BAD_REQUEST`, `INTERNAL`.

## Curl examples

```bash
# Health
curl https://<host>/api/public/v1/health

# Resolve a movie, return the raw m3u8
curl -H "X-API-Key: $API_KEY" \
  "https://<host>/api/public/v1/movie?tmdb_id=550&lang=vf&mode=url"

# Same but returns a proxied (signed) playlist URL
curl -H "X-API-Key: $API_KEY" \
  "https://<host>/api/public/v1/movie?tmdb_id=550&lang=vf&mode=proxy"

# Search
curl -H "X-API-Key: $API_KEY" \
  "https://<host>/api/public/v1/movie/search?q=fight+club&year=1999"

# TV episode
curl -H "X-API-Key: $API_KEY" \
  "https://<host>/api/public/v1/tv?tmdb_id=1399&season=1&episode=1&lang=vostfr&mode=proxy"

# Admin: invalidate cache for a TMDB id
curl -X DELETE -H "X-Admin-Key: $ADMIN_KEY" \
  "https://<host>/api/public/v1/admin/cache/550"

# Admin: test the scraper on an arbitrary source URL
curl -H "X-Admin-Key: $ADMIN_KEY" \
  "https://<host>/api/public/v1/admin/scraper/test?url=https://source.example/film/fight-club"
```

## Files

```
src/lib/
  config.server.ts         env validation
  logger.ts                JSON-lines logger
  api/{errors,auth}.ts     RFC 7807 + key checks
  tmdb/{client,slug}.ts    TMDB v3 client + slug helper
  cache/{keys,kv.server}   key constants + Postgres KV
  db/{mapping,lock}.server Postgres mapping + scraper lock
  scraper/
    fetch.server.ts        page fetch + iframe discovery
    resolver.server.ts     provider picker
    index.server.ts        orchestrator (cache + lock + cascade + verify)
    providers/
      _common.ts           shared interface + helpers
      direct.server.ts     m3u8 anywhere in the HTML
      vidmoly.server.ts
      uqload.server.ts
      streamtape.server.ts
      doodstream.server.ts
      voe.server.ts
  proxy/
    token.server.ts        JWT sign/verify (jose, HS256)
    rewrite.server.ts      m3u8 URL rewriting
src/routes/api/public/v1/
  health.ts
  movie.index.ts
  movie.search.ts
  tv.index.ts
  tv.search.ts
  proxy.$token.$.ts
  admin.cache.ts
  admin.cache.$tmdb_id.ts
  admin.source.ts
  admin.scraper.test.ts
  openapi[.]json.ts
```
