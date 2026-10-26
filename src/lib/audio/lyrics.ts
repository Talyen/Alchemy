import blightTreant from "./lyrics/blight-treant.json";
import bloodCountess from "./lyrics/blood-countess.json";
import forgeGolem from "./lyrics/forge-golem.json";
import frostwarden from "./lyrics/frostwarden.json";
import ironBear from "./lyrics/iron-bear.json";
import seraph from "./lyrics/seraph.json";
import stoneTitan from "./lyrics/stone-titan.json";
import { MUSIC_KEYS } from "../game-constants";

export interface LyricWord {
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

// Store phrase text once and interleave start/end times to keep eager timing data compact.
const tracks = new Map<string, ReadonlyArray<readonly LyricWord[]>>(
  Object.entries({
    [MUSIC_KEYS.BOSS_BLIGHT_TREANT]: blightTreant,
    [MUSIC_KEYS.BOSS_BLOOD_COUNTESS]: bloodCountess,
    [MUSIC_KEYS.BOSS_FORGE_GOLEM]: forgeGolem,
    [MUSIC_KEYS.BOSS_FROSTWARDEN]: frostwarden,
    [MUSIC_KEYS.BOSS_IRON_BEAR]: ironBear,
    [MUSIC_KEYS.BOSS_SERAPH]: seraph,
    [MUSIC_KEYS.BOSS_STONE_TITAN]: stoneTitan,
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
  return tracks.get(key);
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
