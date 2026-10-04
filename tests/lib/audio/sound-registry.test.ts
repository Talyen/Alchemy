import { describe, expect, it } from "vitest";
import { cardLibrary, companionLibrary, enemyBestiary } from "@/lib/game-data";
import { COMPANION_SOUND_CARD_IDS, MUSIC_KEYS } from "@/lib/game-constants";
import { cardSounds, enemyAttackSounds, battleEventSounds, uiSounds } from "@/lib/audio/sound-registry";

describe("complete focal sound coverage", () => {
  it("every card and enemy has a nonempty cue registration, without stale content keys", () => {
    expect(Object.keys(cardSounds).sort()).toEqual(cardLibrary.map((card) => card.id).sort());
    expect(Object.keys(enemyAttackSounds).sort()).toEqual(enemyBestiary.map((enemy) => enemy.id).sort());
    expect(Object.values(cardSounds).every((sounds) => sounds.length > 0)).toBe(true);
    expect(Object.values(enemyAttackSounds).every((sounds) => sounds.length > 0)).toBe(true);
  });

  it("maps every companion to its summoning cue and shares the enemy Will-o'-Wisp choice", () => {
    for (const id of Object.keys(companionLibrary)) {
      expect(COMPANION_SOUND_CARD_IDS[id]).toBe(`${id}-companion`);
      expect(cardSounds[COMPANION_SOUND_CARD_IDS[id]!]?.length).toBeGreaterThan(0);
    }
    expect(cardSounds["will-o-wisp-companion"]).toEqual(enemyAttackSounds["will-o-wisp"]);
  });
});

describe("approved separation of formerly shared cues", () => {
  // Battle additions preserve the selected Gold roles and service silence.
  it("keeps selected event roles distinct and respects explicit silence", () => {
    expect(battleEventSounds.gainGold).not.toBe(uiSounds.shopBuy);
    expect(battleEventSounds.endTurn).not.toBe(uiSounds.toggleOff);
    expect(uiSounds.shopRemove).toBeNull();
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
