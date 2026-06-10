
CREATE TABLE public.tmdb_mapping (
  tmdb_id BIGINT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('movie','tv')),
  source_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tmdb_id, media_type)
);
GRANT ALL ON public.tmdb_mapping TO service_role;
ALTER TABLE public.tmdb_mapping ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.cache_kv (
  k TEXT PRIMARY KEY,
  v JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX cache_kv_expires_at_idx ON public.cache_kv (expires_at);
GRANT ALL ON public.cache_kv TO service_role;
ALTER TABLE public.cache_kv ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.scraper_lock (
  k TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX scraper_lock_expires_at_idx ON public.scraper_lock (expires_at);
GRANT ALL ON public.scraper_lock TO service_role;
ALTER TABLE public.scraper_lock ENABLE ROW LEVEL SECURITY;
