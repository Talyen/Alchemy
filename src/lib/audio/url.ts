import { SOUNDS_BASE_PATH } from "../game-constants";

let cachedOggSupport: boolean | null = null;

export function resetSoundUrlCache(): void {
  cachedOggSupport = null;
}

function browserCanPlayOggVorbis(): boolean {
  if (cachedOggSupport !== null) return cachedOggSupport;
  if (typeof Audio === "undefined") {
    cachedOggSupport = true;
    return cachedOggSupport;
  }
  try {
    cachedOggSupport = new Audio().canPlayType('audio/ogg; codecs="vorbis"') !== "";
  } catch {
    cachedOggSupport = true;
  }
  return cachedOggSupport;
}

function playableSoundFileName(name: string): string {
  if (!name.endsWith(".ogg") || browserCanPlayOggVorbis()) return name;
  return `${name.slice(0, -4)}.mp3`;
}

export function audioUrl(path: string): string {
  const baseUrl = import.meta.env.BASE_URL ?? "/";
  const prefix = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${prefix}${path}`;
}

export function getSoundUrl(name: string): string {
  return audioUrl(`${SOUNDS_BASE_PATH}${playableSoundFileName(name)}`);
}
