import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import lyrics from "@/lib/audio/lyrics/blight-treant.json";
import { getMusicLyrics } from "@/lib/audio/lyrics";
import { MUSIC_KEYS } from "@/lib/game-constants";

it("keeps the shipped lyric timeline tied to its recording with positive, ordered word intervals", () => {
  const hash = createHash("sha256").update(readFileSync("public/Music/The Blight Treant.mp3")).digest("hex");
  expect(lyrics.audioSha256).toBe(hash);
  const lines = getMusicLyrics(MUSIC_KEYS.BOSS_BLIGHT_TREANT)!;
  expect(lines).toHaveLength(lyrics.lines.length);
  let end = 0;
  for (const [index, line] of lines.entries()) {
    expect(lyrics.lines[index]!.timings).toHaveLength(line.length * 2);
    expect(line.length).toBeGreaterThan(0);
    for (const word of line) {
      expect(word.start).toBeGreaterThanOrEqual(end);
      expect(word.end).toBeGreaterThan(word.start);
      expect(word.end).toBeLessThanOrEqual(360);
      end = word.end;
    }
  }
});
