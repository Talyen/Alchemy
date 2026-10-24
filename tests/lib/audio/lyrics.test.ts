import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import lyrics from "@/lib/audio/lyrics/blight-treant.json";
import bloodCountess from "@/lib/audio/lyrics/blood-countess.json";
import forgeGolem from "@/lib/audio/lyrics/forge-golem.json";
import frostwarden from "@/lib/audio/lyrics/frostwarden.json";
import ironBear from "@/lib/audio/lyrics/iron-bear.json";
import seraph from "@/lib/audio/lyrics/seraph.json";
import stoneTitan from "@/lib/audio/lyrics/stone-titan.json";
import { getLyricFrame, getMusicLyrics } from "@/lib/audio/lyrics";
import { MUSIC_CATALOG } from "@/lib/audio/music-catalog";
import { MUSIC_KEYS } from "@/lib/game-constants";

it.each([
  [MUSIC_KEYS.BOSS_BLIGHT_TREANT, lyrics, 360],
  [MUSIC_KEYS.BOSS_BLOOD_COUNTESS, bloodCountess, bloodCountess.audioDuration],
  [MUSIC_KEYS.BOSS_FORGE_GOLEM, forgeGolem, forgeGolem.audioDuration],
  [MUSIC_KEYS.BOSS_FROSTWARDEN, frostwarden, frostwarden.audioDuration],
  [MUSIC_KEYS.BOSS_IRON_BEAR, ironBear, ironBear.audioDuration],
  [MUSIC_KEYS.BOSS_SERAPH, seraph, seraph.audioDuration],
  [MUSIC_KEYS.BOSS_STONE_TITAN, stoneTitan, stoneTitan.audioDuration],
] as const)("ties %s lyrics to their recording with positive, ordered word intervals", (key, snapshot, duration) => {
  const file = MUSIC_CATALOG[key]!.files[0]!;
  const hash = createHash("sha256")
    .update(readFileSync(`public/Music/${file}`))
    .digest("hex");
  expect(snapshot.audioSha256).toBe(hash);
  if ("lyricsSha256" in snapshot) {
    const sheet = `scripts/lyrics-trial/${MUSIC_CATALOG[key]!.bossId}.txt`;
    expect(snapshot.lyricsSha256).toBe(createHash("sha256").update(readFileSync(sheet)).digest("hex"));
  }
  const lines = getMusicLyrics(key)!;
  expect(lines.length).toBeGreaterThan(0);
  expect(lines).toHaveLength(snapshot.lines.length);
  let end = 0;
  for (const [index, line] of lines.entries()) {
    expect(snapshot.lines[index]!.timings).toHaveLength(line.length * 2);
    expect(line.length).toBeGreaterThan(0);
    for (const word of line) {
      expect(word.start).toBeGreaterThanOrEqual(end);
      expect(word.end).toBeGreaterThan(word.start);
      expect(word.end).toBeLessThanOrEqual(duration);
      end = word.end;
    }
  }
});

it("keeps the recovered chorus repeats and verse lines instead of dropping whole phrases", () => {
  const iron = getMusicLyrics(MUSIC_KEYS.BOSS_IRON_BEAR)!.map((line) => line.map((word) => word.text).join(" "));
  const frost = getMusicLyrics(MUSIC_KEYS.BOSS_FROSTWARDEN)!.map((line) => line.map((word) => word.text).join(" "));
  const stone = getMusicLyrics(MUSIC_KEYS.BOSS_STONE_TITAN)!.map((line) => line.map((word) => word.text).join(" "));
  const seraphLines = getMusicLyrics(MUSIC_KEYS.BOSS_SERAPH)!.map((line) => line.map((word) => word.text).join(" "));
  expect(iron.filter((line) => line === "Iron, forge, and flame I take")).toHaveLength(4);
  expect(iron.filter((line) => line === "singe through hide.")).toHaveLength(2);
  expect(frost.filter((line) => line === "What freezes you")).toHaveLength(6);
  expect(frost.filter((line) => line === "What burns me")).toHaveLength(6);
  expect(frost.filter((line) => line === "I walk through the long sleep")).toHaveLength(1);
  expect(stone.filter((line) => line === "Will fall the same.")).toHaveLength(4);
  expect(stone.filter((line) => line === "You tread on me.")).toHaveLength(3);
  expect(seraphLines.filter((line) => line === "Prayed with lowered heads.")).toHaveLength(1);
  expect(seraphLines.filter((line) => line === "Stand in the light.")).toHaveLength(2);
});

it("keeps Frostwarden's restored call separate from the following response", () => {
  const lines = getMusicLyrics(MUSIC_KEYS.BOSS_FROSTWARDEN)!;
  function visibleAt(time: number) {
    const frame = getLyricFrame(lines, time)!;
    return lines[frame.line]!.slice(0, frame.visible)
      .map((word) => word.text)
      .join(" ");
  }
  expect(visibleAt(218.5)).toBe("What burns");
  expect(visibleAt(220.5)).toBe("Melts");
});
