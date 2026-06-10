import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Scraping & Streaming API" },
      { name: "description", content: "Private scraping API exposing HLS streams resolved from TMDB ids." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Scraping & Streaming API</h1>
        <p className="mt-3 text-muted-foreground">
          Private API. All endpoints live under{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">/api/public/v1/*</code> and
          require an{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">X-API-Key</code> header.
        </p>

        <section className="mt-8 space-y-2 text-sm">
          <h2 className="text-base font-medium">Quick links</h2>
          <ul className="list-inside list-disc text-muted-foreground">
            <li>
              <a className="text-primary underline" href="/api/public/v1/health">
                /api/public/v1/health
              </a>
            </li>
            <li>
              <a className="text-primary underline" href="/api/public/v1/openapi.json">
                /api/public/v1/openapi.json
              </a>
            </li>
          </ul>
        </section>

        <section className="mt-8 text-sm">
          <h2 className="text-base font-medium">Example</h2>
          <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs">
{`curl -H "X-API-Key: $API_KEY" \\
  "https://<host>/api/public/v1/movie?tmdb_id=550&lang=vf&mode=proxy"`}
          </pre>
        </section>

        <p className="mt-10 text-xs text-muted-foreground">
          See <code>README.md</code> for the full spec.
        </p>
      </main>
    </div>
  );
}
