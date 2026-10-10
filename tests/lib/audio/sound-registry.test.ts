import { describe, expect, it } from "vitest";
import { cardLibrary, companionLibrary } from "@/lib/game-data";
import { COMPANION_SOUND_CARD_IDS } from "@/lib/game-constants";
import { cardSounds, battleEventSounds, uiSounds } from "@/lib/audio/sound-registry";

describe("complete focal sound coverage", () => {
  it("every card has a nonempty cue registration, without stale content keys", () => {
    expect(Object.keys(cardSounds).sort()).toEqual(cardLibrary.map((card) => card.id).sort());
    expect(Object.values(cardSounds).every((sounds) => sounds.length > 0)).toBe(true);
  });

  it("maps every companion to its summoning cue", () => {
    for (const id of Object.keys(companionLibrary)) {
      expect(COMPANION_SOUND_CARD_IDS[id]).toBe(`${id}-companion`);
      expect(cardSounds[COMPANION_SOUND_CARD_IDS[id]!]?.length).toBeGreaterThan(0);
    }
  });
});

describe("approved separation of formerly shared cues", () => {
  it("keeps selected event roles distinct and respects explicit silence", () => {
    expect(battleEventSounds.endTurn).not.toBe(uiSounds.toggleOff);
    expect(uiSounds.shopRemove).toBeNull();
  });
});
