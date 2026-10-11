import blightTreant from "./lyrics/blight-treant.json";
import { MUSIC_KEYS } from "../game-constants";

export interface LyricWord {
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

// Store phrase text once and interleave start/end times to keep eager timing data compact.
const blightTreantLines: ReadonlyArray<readonly LyricWord[]> = blightTreant.lines.map(({ text, timings }) =>
  text.split(" ").map((word, index) => ({ text: word, start: timings[index * 2]!, end: timings[index * 2 + 1]! })),
);

export function getMusicLyrics(key: string): ReadonlyArray<readonly LyricWord[]> | undefined {
  return key === MUSIC_KEYS.BOSS_BLIGHT_TREANT ? blightTreantLines : undefined;
}

export interface LyricFrame {
  line: number;
  visible: number;
  active: number;
}

/** Derive from media time on every sample, including backwards seeks and loop restarts. */
export function getLyricFrame(lines: ReadonlyArray<readonly LyricWord[]>, time: number): LyricFrame | null {
  const line = lines.findIndex((words) => time >= words[0]!.start && time < words.at(-1)!.end);
  if (line < 0) return null;
  const words = lines[line]!;
  return {
    line,
    visible: words.filter((word) => word.start <= time).length,
    active: words.findIndex((word) => time >= word.start && time < word.end),
  };
}
