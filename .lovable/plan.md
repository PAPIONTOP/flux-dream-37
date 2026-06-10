
# API Scraping & Streaming HLS — version Lovable

## Ce qui change vs ta spec (contraintes runtime)

Le runtime ici est **Cloudflare Workers** (edge serverless). Donc :

| Spec d'origine | Adapté en | Pourquoi |
|---|---|---|
| Fastify + Node.js 20 | TanStack server routes (`src/routes/api/...`) | Pas de serveur long-running |
| Playwright headless | **Supprimé** — fetch + Cheerio uniquement | Pas de child_process, pas de Chromium |
| Redis (ioredis) | Table Postgres `cache_kv` avec TTL | Pas de Redis dans le Worker |
| SQLite (better-sqlite3) | Postgres (Lovable Cloud) | Pas d'addon natif, pas de FS persistant |
| BullMQ queue | Exécution inline + verrou Postgres | Pas de worker process |
| Docker / docker-compose | Déploiement Lovable | Géré par la plateforme |
| Swagger auto | OpenAPI JSON servi statiquement (route `/api/openapi.json`) | Pas de `@fastify/swagger` |
| Jest + nock | (skip) | Pas de runner de tests pertinent ici |

**Impact fonctionnel** : tous les providers qui nécessitent un navigateur (exécution JS, tokens dynamiques générés côté client : voe, doodstream, vidmoly lourd, jwplayer post-render) seront **best-effort regex/HTML statique**. Les pages source qui chargent leur player en JS pur ne pourront pas être scrapées. Provider `direct` (m3u8 dans le HTML) + extraction iframe + regex sur uqload/streamtape/vidmoly/voe statique = ce qui marchera.

Si plus tard tu veux Playwright, il faudra héberger un worker externe (Fly/Railway) appelé depuis l'API — pas dans ce projet.

## Stack finale

- TanStack Start (déjà en place) + server routes
- Lovable Cloud (Postgres + Auth ; on n'utilise pas Auth, juste la DB et les secrets)
- `cheerio` pour le parsing HTML
- `jose` pour les JWT proxy (compatible Worker ; jsonwebtoken ne l'est pas)
- `zod` pour la validation d'input
- Pas de package SDK Supabase côté server route : on tape la DB via le client admin chargé dynamiquement dans le handler (pattern Lovable)

## Endpoints (1:1 avec ta spec, préfixe `/api/v1`)

```
GET    /api/v1/health
GET    /api/v1/movie?tmdb_id|title&lang&mode&force_refresh
GET    /api/v1/movie/search?q&year&limit
GET    /api/v1/tv?tmdb_id|title&season&episode&lang&mode&force_refresh
GET    /api/v1/tv/search?q&year&limit
GET    /api/v1/proxy/$token/index.m3u8
GET    /api/v1/proxy/$token/$quality/index.m3u8
GET    /api/v1/proxy/$token/$quality/$segment
GET    /api/v1/admin/cache
DELETE /api/v1/admin/cache/$tmdb_id
POST   /api/v1/admin/source
GET    /api/v1/admin/scraper/test?url=
GET    /api/v1/openapi.json
```

Auth : header `X-API-Key` (vérif vs secret `API_KEY`). Routes admin : header `X-Admin-Key` vs `ADMIN_KEY`. Pour passer Lovable auth bypass, je place tout sous `/api/public/v1/...` en interne (URL publique inchangée côté doc, je documenterai). Sécurité = la clé API.

## Schéma DB

```sql
CREATE TABLE public.tmdb_mapping (
  tmdb_id BIGINT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('movie','tv')),
  source_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (tmdb_id, media_type)
);

CREATE TABLE public.cache_kv (
  k TEXT PRIMARY KEY,
  v JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX ON public.cache_kv (expires_at);

CREATE TABLE public.scraper_lock (
  k TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL
);
```

Grants : aucun grant `anon`/`authenticated` (toutes les écritures passent par `supabaseAdmin` côté serveur via service role). RLS activée + zéro policy = lock-down total.

## Arborescence

```
src/
  routes/api/public/v1/
    health.ts
    movie.index.ts                      // /api/public/v1/movie
    movie.search.ts
    tv.index.ts
    tv.search.ts
    proxy.$token.index[.]m3u8.ts
    proxy.$token.$quality.index[.]m3u8.ts
    proxy.$token.$quality.$segment.ts
    admin.cache.ts
    admin.cache.$tmdb_id.ts
    admin.source.ts
    admin.scraper.test.ts
    openapi[.]json.ts
  lib/
    api/
      auth.ts                           // vérif X-API-Key / X-Admin-Key
      errors.ts                         // RFC 7807
      schema.ts                         // zod schemas par route
    tmdb/
      client.ts                         // fetch TMDB
      slug.ts
    cache/
      kv.server.ts                      // get/set/del/exists sur cache_kv
      keys.ts                           // constantes
    db/
      mapping.server.ts                 // CRUD tmdb_mapping
      lock.server.ts                    // verrou scraper
    scraper/
      index.server.ts                   // orchestrateur
      fetch.server.ts                   // fetch HTML + Cheerio
      resolver.server.ts
      providers/
        direct.server.ts
        vidmoly.server.ts
        uqload.server.ts
        streamtape.server.ts
        doodstream.server.ts
        voe.server.ts
    proxy/
      token.server.ts                   // jose : sign/verify JWT
      rewrite.server.ts                 // réécriture m3u8
    config.server.ts                    // lecture env + validation
    logger.ts                           // wrapper console.log structuré
supabase/migrations/<ts>_init_api.sql
```

Note : suffixe `.server.ts` partout où on touche `process.env`, DB admin, ou code non-isomorphe.

## Secrets à fournir (je te demanderai une fois Cloud activée)

| Secret | Rôle |
|---|---|
| `TMDB_API_KEY` | Clé v3 TMDB |
| `API_KEY` | Clé d'accès `X-API-Key` |
| `ADMIN_KEY` | Clé admin `X-Admin-Key` |
| `JWT_SECRET` | Signature des tokens proxy (>= 32 chars) |
| `SOURCE_BASE_URL` | URL du site source |
| `SOURCE_MOVIE_PATH` | ex: `/film/{slug}` |
| `SOURCE_SERIES_PATH` | ex: `/serie/{slug}/saison-{season}/episode-{episode}` |
| `SOURCE_USER_AGENT` | UA pour les requêtes |
| `SOURCE_COOKIES` | Cookies optionnels |

Pas de `SOURCE_USE_HEADLESS` (toujours false ici). Pas de `REDIS_URL`. `STREAM_CACHE_TTL` / `PROXY_TOKEN_TTL` / `SCRAPER_CONCURRENCY` = constantes en code (modifiables via `/admin/source`).

## Format d'erreur RFC 7807 (inchangé)

Codes implémentés : `TMDB_NOT_FOUND`, `TMDB_API_ERROR`, `SOURCE_NOT_FOUND`, `SCRAPE_FAILED`, `STREAM_INVALID`, `PROXY_TOKEN_EXPIRED`, `PROXY_TOKEN_INVALID`, `SCRAPER_BUSY`, `NO_STREAM_FOUND`, `PROVIDER_UNSUPPORTED`, `UNAUTHORIZED`, `BAD_REQUEST`.

## Ordre d'implémentation (livré en une passe, pas étape par étape)

1. Activer Lovable Cloud
2. Migration SQL (tables + RLS)
3. `config.server.ts`, `logger.ts`, `errors.ts`, `auth.ts`
4. `tmdb/client.ts`, `tmdb/slug.ts`
5. `cache/kv.server.ts`, `db/mapping.server.ts`, `db/lock.server.ts`
6. Providers (direct, vidmoly, uqload, streamtape, doodstream, voe) — regex statique
7. `scraper/fetch.server.ts`, `scraper/resolver.server.ts`, `scraper/index.server.ts`
8. Routes movie + search
9. Routes tv + search
10. `proxy/token.server.ts`, `proxy/rewrite.server.ts`, routes proxy
11. Routes admin + health + openapi
12. README avec exemples curl

Je livre tout en un seul jet, puis je te demanderai les secrets à fournir.

## Confirmation demandée

Tu valides cette adaptation (notamment **scraping sans headless** = providers obfusqués JS non garantis) ? Si oui, je lance.
