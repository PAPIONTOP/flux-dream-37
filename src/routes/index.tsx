import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { scrapeStream } from "@/lib/scraper/test.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Play, AlertCircle, CheckCircle2 } from "lucide-react";

type Result = Awaited<ReturnType<typeof scrapeStream>>;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Scraper Console — TMDB Stream Resolver" },
      {
        name: "description",
        content:
          "Internal console: enter a TMDB id, pick language, and resolve an HLS stream from cinepulse.live.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const scrape = useServerFn(scrapeStream);
  const [mediaType, setMediaType] = useState<"movie" | "tv">("movie");
  const [tmdbId, setTmdbId] = useState("550");
  const [season, setSeason] = useState("1");
  const [episode, setEpisode] = useState("1");
  const [lang, setLang] = useState<"vf" | "fr" | "vostfr" | "en">("vf");
  const [forceRefresh, setForceRefresh] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setResult(null);
    const id = Number(tmdbId);
    if (!Number.isInteger(id) || id <= 0) {
      setErr("TMDB id must be a positive integer");
      return;
    }
    setLoading(true);
    try {
      const r = await scrape({
        data: {
          tmdbId: id,
          mediaType,
          season: mediaType === "tv" ? Number(season) || 1 : undefined,
          episode: mediaType === "tv" ? Number(episode) || 1 : undefined,
          lang,
          forceRefresh,
        },
      });
      setResult(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-3xl px-6 py-12">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Scraper Console</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter a TMDB id to resolve an HLS stream from the configured source.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resolve stream</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={mediaType}
                    onValueChange={(v) => setMediaType(v as "movie" | "tv")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="movie">Movie</SelectItem>
                      <SelectItem value="tv">TV episode</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="tmdb">TMDB id</Label>
                  <Input
                    id="tmdb"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="e.g. 550"
                    value={tmdbId}
                    onChange={(e) => setTmdbId(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
              </div>

              {mediaType === "tv" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="s">Season</Label>
                    <Input
                      id="s"
                      inputMode="numeric"
                      value={season}
                      onChange={(e) => setSeason(e.target.value.replace(/\D/g, ""))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="e">Episode</Label>
                    <Input
                      id="e"
                      inputMode="numeric"
                      value={episode}
                      onChange={(e) => setEpisode(e.target.value.replace(/\D/g, ""))}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select value={lang} onValueChange={(v) => setLang(v as typeof lang)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vf">VF</SelectItem>
                      <SelectItem value="fr">FR (FRENCH/TRUEFRENCH)</SelectItem>
                      <SelectItem value="vostfr">VOSTFR</SelectItem>
                      <SelectItem value="en">EN</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={forceRefresh}
                      onChange={(e) => setForceRefresh(e.target.checked)}
                      className="h-4 w-4 rounded border-input"
                    />
                    Force refresh (bypass cache)
                  </label>
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resolving…
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Resolve stream
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {err && (
          <Card className="mt-6 border-destructive/50">
            <CardContent className="flex items-start gap-3 py-4 text-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
              <div>
                <div className="font-medium">Request failed</div>
                <div className="mt-1 text-muted-foreground">{err}</div>
              </div>
            </CardContent>
          </Card>
        )}

        {result && <ResultView result={result} />}
      </main>
    </div>
  );
}

function ResultView({ result }: { result: Result }) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-base">
          {result.ok ? (
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Stream resolved
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              {result.error.code}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4">
          {result.poster && (
            <img
              src={result.poster}
              alt={result.title || "poster"}
              className="h-36 w-24 rounded-md object-cover"
            />
          )}
          <div className="min-w-0 flex-1 space-y-2 text-sm">
            {result.title && <div className="font-medium">{result.title}</div>}
            {result.ok ? (
              <>
                <Field label="Provider" value={result.stream.provider} />
                <Field label="Quality" value={result.stream.quality} />
                <Field label="Lang" value={result.stream.lang} />
                <Field label="Type" value={result.stream.type} />
                <div className="space-y-1">
                  <div className="text-xs uppercase text-muted-foreground">Stream URL</div>
                  <a
                    href={result.stream.streamUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block break-all rounded-md bg-muted px-2 py-1.5 text-xs text-primary underline"
                  >
                    {result.stream.streamUrl}
                  </a>
                </div>
              </>
            ) : (
              <div className="text-muted-foreground">{result.error.message}</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-20 text-xs uppercase text-muted-foreground">{label}</span>
      <span className="font-mono text-xs">{value}</span>
    </div>
  );
}
