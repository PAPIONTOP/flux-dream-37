/** Provider registry + resolver. */
import type { Provider } from "./providers/_common";
import { direct } from "./providers/direct.server";
import { vidmoly } from "./providers/vidmoly.server";
import { uqload } from "./providers/uqload.server";
import { streamtape } from "./providers/streamtape.server";
import { doodstream } from "./providers/doodstream.server";
import { voe } from "./providers/voe.server";
import { vidzy } from "./providers/vidzy.server";
import { luluvid } from "./providers/luluvid.server";

export const PROVIDERS: Provider[] = [vidzy, luluvid, vidmoly, uqload, streamtape, doodstream, voe];
export const FALLBACK_PROVIDER: Provider = direct;

export function pickProvider(url: string): Provider {
  return PROVIDERS.find((p) => p.matches(url)) ?? FALLBACK_PROVIDER;
}
