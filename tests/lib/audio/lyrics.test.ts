import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import lyrics from "@/lib/audio/lyrics/blight-treant.json";
import { getMusicLyrics } from "@/lib/audio/lyrics";
import { MUSIC_KEYS } from "@/lib/game-constants";

it("keeps the shipped lyric timeline tied to its recording with positive, ordered word intervals", () => {
  const hash = createHash("sha256").update(readFileSync("public/music/The Blight Treant.mp3")).digest("hex");
  expect(lyrics.audioSha256).toBe(hash);
  expect(getMusicLyrics(MUSIC_KEYS.BOSS_BLIGHT_TREANT)).toBe(lyrics.lines);
  let end = 0;
  for (const line of lyrics.lines) {
    expect(line.length).toBeGreaterThan(0);
    for (const word of line) {
      expect(word.start).toBeGreaterThanOrEqual(end);
      expect(word.end).toBeGreaterThan(word.start);
      expect(word.end).toBeLessThanOrEqual(360);
      end = word.end;
    }
  }
});
