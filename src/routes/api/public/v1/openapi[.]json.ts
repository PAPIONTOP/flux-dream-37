import { createFileRoute } from "@tanstack/react-router";

const SPEC = {
  openapi: "3.1.0",
  info: {
    title: "Scraping & Streaming API",
    version: "1.0.0",
    description:
      "Private API that resolves TMDB ids to HLS streams scraped from a configured source site.",
  },
  servers: [{ url: "/api/public/v1" }],
  components: {
    securitySchemes: {
      ApiKey: { type: "apiKey", in: "header", name: "X-API-Key" },
      AdminKey: { type: "apiKey", in: "header", name: "X-Admin-Key" },
    },
  },
  security: [{ ApiKey: [] }],
  paths: {
    "/health": { get: { summary: "Health check", security: [] } },
    "/movie": {
      get: {
        summary: "Resolve a movie stream",
        parameters: [
          { name: "tmdb_id", in: "query", schema: { type: "integer" } },
          { name: "title", in: "query", schema: { type: "string" } },
          { name: "lang", in: "query", schema: { type: "string", enum: ["fr", "vf", "vostfr", "en"] } },
          { name: "mode", in: "query", schema: { type: "string", enum: ["url", "proxy"] } },
          { name: "force_refresh", in: "query", schema: { type: "boolean" } },
        ],
      },
    },
    "/movie/search": {
      get: {
        summary: "Search movies on TMDB",
        parameters: [
          { name: "q", in: "query", required: true, schema: { type: "string" } },
          { name: "year", in: "query", schema: { type: "integer" } },
          { name: "limit", in: "query", schema: { type: "integer", maximum: 20 } },
        ],
      },
    },
    "/tv": {
      get: {
        summary: "Resolve a series episode stream (or list seasons)",
        parameters: [
          { name: "tmdb_id", in: "query", schema: { type: "integer" } },
          { name: "title", in: "query", schema: { type: "string" } },
          { name: "season", in: "query", schema: { type: "integer" } },
          { name: "episode", in: "query", schema: { type: "integer" } },
          { name: "lang", in: "query", schema: { type: "string" } },
          { name: "mode", in: "query", schema: { type: "string", enum: ["url", "proxy"] } },
          { name: "force_refresh", in: "query", schema: { type: "boolean" } },
        ],
      },
    },
    "/tv/search": {
      get: { summary: "Search TV shows on TMDB" },
    },
    "/proxy/{token}/{path}": {
      get: { summary: "Proxy + rewrite HLS playlist / segment", security: [] },
    },
    "/admin/cache": { get: { summary: "List cache keys", security: [{ AdminKey: [] }] } },
    "/admin/cache/{tmdb_id}": {
      delete: { summary: "Invalidate cache for a TMDB id", security: [{ AdminKey: [] }] },
    },
    "/admin/source": { post: { summary: "Show source config", security: [{ AdminKey: [] }] } },
    "/admin/scraper/test": {
      get: { summary: "Test the scraper on an arbitrary URL", security: [{ AdminKey: [] }] },
    },
  },
};

export const Route = createFileRoute("/api/public/v1/openapi.json")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify(SPEC, null, 2), {
          headers: { "content-type": "application/json" },
        }),
    },
  },
});
