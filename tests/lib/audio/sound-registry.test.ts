import { describe, expect, it } from "vitest";
import { cardLibrary, companionLibrary, enemyBestiary } from "@/lib/game-data";
import { COMPANION_SOUND_CARD_IDS, MUSIC_KEYS } from "@/lib/game-constants";
import { cardSounds, enemyAttackSounds, battleEventSounds, uiSounds } from "@/lib/audio/sound-registry";

describe("cross-registry key consistency", () => {
  it("every card with cardSounds is defined in cardLibrary", () => {
    const cardIds = new Set(cardLibrary.map((c: { id: string }) => c.id));
    for (const cardId of Object.keys(cardSounds)) {
      expect(cardIds.has(cardId)).toBe(true);
    }
  });

  it("every enemy with enemyAttackSounds is defined in enemyBestiary", () => {
    const enemyIds = new Set(enemyBestiary.map((e: { id: string }) => e.id));
    for (const enemyId of Object.keys(enemyAttackSounds)) {
      expect(enemyIds.has(enemyId)).toBe(true);
    }
  });
});

describe("approved separation of formerly shared cues", () => {
  // Approved choices distinguish spending from gaining Gold and keep the
  // selected removal and companion actions silent.
  it("keeps selected event roles distinct and respects explicit silence", () => {
    expect(battleEventSounds.gainGold).not.toBe(uiSounds.shopBuy);
    expect(battleEventSounds.endTurn).not.toBe(uiSounds.toggleOff);
    expect(uiSounds.shopRemove).toBeNull();
    expect(cardSounds["will-o-wisp-companion"]).toBeUndefined();
  });

  it("covers every music boss with an attack cue and pins attack-only bosses", () => {
    const musicBossIds = Object.values(MUSIC_KEYS)
      .filter((key) => key.startsWith("boss-"))
      .map((key) => key.replace(/^boss-/, ""));
    for (const id of musicBossIds) {
      expect(enemyAttackSounds[id]).toBeDefined();
    }
    // living-armor hits with the shared boss cue but has no theme: adding a
    // theme means adding a MUSIC_KEYS entry plus a catalog file.
    expect(enemyAttackSounds["living-armor"]).toBeDefined();
  });
});

// Content added without a registered sound stays silent. These lists are
// exact: adding a sound (or content) must update them, so new cards and
// enemies get a conscious sound decision instead of silent drift.
const SILENT_CARD_IDS: readonly string[] = [
  "avatar",
  "caustic-jab",
  "exorcism",
  "library-owl-companion",
  "mana-moth-companion",
  "pixie-dust",
  "prayer",
  "predators-focus",
  "rend",
  "sanctified-plate",
  "sniff-out",
  "tithe",
  "will-o-wisp-companion",
  "wishing-well",
];

const SILENT_ENEMY_IDS: readonly string[] = [
  "banshee",
  "cleric",
  "giant-snake",
  "giant-spider",
  "inquisitor",
  "paladin",
  "seraph",
  "will-o-wisp",
  "winter-wolf",
  "yeti",
  "zealot",
];

describe("silent-coverage pinning", () => {
  it("every companion has a mapping and the approved silent companions stay quiet", () => {
    for (const id of Object.keys(companionLibrary)) {
      if (!["mana-moth", "will-o-wisp", "library-owl"].includes(id))
        expect(cardSounds[`${id}-companion`]).toBeDefined();
      expect(COMPANION_SOUND_CARD_IDS[id]).toBe(`${id}-companion`);
    }
  });

  it("every non-silent card has a registered sound", () => {
    const silent = new Set(SILENT_CARD_IDS);
    const cardIds = cardLibrary.map((c: { id: string }) => c.id);
    expect(cardIds.filter((id) => !(id in cardSounds) && !silent.has(id))).toEqual([]);
    expect([...silent].filter((id) => id in cardSounds)).toEqual([]);
  });

  it("every non-silent enemy has a registered attack sound", () => {
    const silent = new Set(SILENT_ENEMY_IDS);
    const enemyIds = enemyBestiary.map((e: { id: string }) => e.id);
    expect(enemyIds.filter((id) => !(id in enemyAttackSounds) && !silent.has(id))).toEqual([]);
    expect([...silent].filter((id) => id in enemyAttackSounds)).toEqual([]);
  });
});
