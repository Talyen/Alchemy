import { expect, it } from "vitest";
import { WILDWOOD_BOSS_IDS } from "@/lib/content-systems/wildwood/bosses";
import { bossIdleClips } from "@/lib/game-data/boss-idle-assets";
import { bossIdleAssets } from "../../../scripts/assets/boss-idle-assets.mjs";

it("keeps the selected clip and resolution order aligned with the prepared inventory", () => {
  const counts: Record<string, number> = {
    "forge-golem": 3,
    frostwarden: 3,
    "iron-bear": 3,
    "blight-treant": 3,
    "blood-countess": 5,
    seraph: 3,
    "stone-titan": 3,
  };
  expect(Object.keys(bossIdleClips)).toEqual(Object.keys(counts));
  const selected: string[] = [];
  for (const [id, count] of Object.entries(counts)) {
    const clips = bossIdleClips[id]!;
    expect(clips).toHaveLength(count);
    clips.forEach((clip, index) => {
      const base = `${id}-idle-${index + 1}`;
      expect(clip.variants.map(({ src }) => src.split("/").at(-1))).toEqual([
        `${base}-640.mp4`,
        `${base}-1280.mp4`,
        `${base}.mp4`,
      ]);
      selected.push(...clip.variants.map(({ src }) => src.split("/").at(-1)!));
    });
  }
  expect(selected.sort()).toEqual(bossIdleAssets.map(({ target }) => target).sort());
});

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
