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

/** Lines and words are nonempty, ordered and nonoverlapping. Media time may seek or loop. */
export function getLyricFrame(
  lines: ReadonlyArray<readonly LyricWord[]>,
  time: number,
  previous: LyricFrame | null = null,
): LyricFrame | null {
  if (Number.isNaN(time)) return null;
  // Locate the last phrase that has started without rescanning the entire song
  // on every animation frame, including during instrumental gaps.
  let low = 0;
  let high = lines.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (lines[middle]![0]!.start <= time) low = middle + 1;
    else high = middle;
  }
  const line = low - 1;
  if (line < 0) return null;
  const words = lines[line]!;
  if (time >= words[words.length - 1]!.end) return null;
  let visible = 0;
  let active = -1;
  for (let index = 0; index < words.length; index++) {
    const word = words[index]!;
    if (word.start <= time) visible++;
    if (active < 0 && time >= word.start && time < word.end) active = index;
  }
  return previous?.line === line && previous.visible === visible && previous.active === active
    ? previous
    : { line, visible, active };
}
