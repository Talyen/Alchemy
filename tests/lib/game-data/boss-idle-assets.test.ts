import { expect, it } from "vitest";
import { WILDWOOD_BOSS_IDS } from "@/lib/content-systems/wildwood/bosses";
import { bossIdleClips } from "@/lib/game-data/boss-idle-assets";

it("registers idle clips at every supported resolution for every boss", () => {
  for (const id of WILDWOOD_BOSS_IDS) {
    const clips = bossIdleClips[id];
    expect(clips?.length, id).toBeGreaterThanOrEqual(3);
    for (const clip of clips ?? []) {
      expect(
        clip.variants.map(({ width }) => width),
        id,
      ).toEqual([640, 1280, 1920]);
      expect(
        clip.variants.every(({ src }) => Boolean(src)),
        id,
      ).toBe(true);
    }
  }
});
