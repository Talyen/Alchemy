import blightTreant from "./lyrics/blight-treant.json";
import bloodCountess from "./lyrics/blood-countess.json";
import forgeGolem from "./lyrics/forge-golem.json";
import frostwarden from "./lyrics/frostwarden.json";
import ironBear from "./lyrics/iron-bear.json";
import seraph from "./lyrics/seraph.json";
import stoneTitan from "./lyrics/stone-titan.json";
import { MUSIC_CATALOG } from "./music-catalog";

export interface LyricWord {
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

// Store phrase text once and interleave start/end times to keep eager timing data compact.
const tracks = new Map<string, ReadonlyArray<readonly LyricWord[]>>(
  Object.entries({
    "blight-treant": blightTreant,
    "blood-countess": bloodCountess,
    "forge-golem": forgeGolem,
    frostwarden: frostwarden,
    "iron-bear": ironBear,
    seraph: seraph,
    "stone-titan": stoneTitan,
  }).map(([key, { lines }]) => [
    key,
    lines.map(({ text, timings }) =>
      text
        .split(" ")
        .map((word, index) => ({ text: word, start: timings[index * 2] ?? 0, end: timings[index * 2 + 1] ?? 0 })),
    ),
  ]),
);

export function getMusicLyrics(key: string): ReadonlyArray<readonly LyricWord[]> | undefined {
  const bossId = Object.hasOwn(MUSIC_CATALOG, key) ? MUSIC_CATALOG[key]?.bossId : undefined;
  return bossId ? tracks.get(bossId) : undefined;
}

export interface LyricFrame {
  line: number;
  visible: number;
  active: number;
}

/** Derive from media time on every sample, including backwards seeks and loop restarts. */
export function getLyricFrame(lines: ReadonlyArray<readonly LyricWord[]>, time: number): LyricFrame | null {
  const line = lines.findIndex((words) => {
    const first = words[0];
    const last = words[words.length - 1];
    return first && last && time >= first.start && time < last.end;
  });
  if (line < 0) return null;
  const words = lines[line];
  if (!words) return null;
  return {
    line,
    visible: words.filter((word) => word.start <= time).length,
    active: words.findIndex((word) => time >= word.start && time < word.end),
  };
}
