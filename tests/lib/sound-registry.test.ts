import { describe, expect, it } from "vitest";
import {
  cardSounds, enemyAttackSounds, battleEventSounds,
  uiSounds, stingerSounds,
} from "@/lib/sound-registry";

describe("cardSounds", () => {
  it("every entry maps to a non-empty array of .ogg filenames", () => {
    for (const sounds of Object.values(cardSounds)) {
      expect(sounds.length).toBeGreaterThan(0);
      for (const s of sounds) {
        expect(s).toBeTruthy();
        expect(s).toMatch(/\.ogg$/);
      }
    }
  });

  it("card IDs are unique", () => {
    const ids = Object.keys(cardSounds);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("enemyAttackSounds", () => {
  it("every entry maps to a non-empty array of .ogg filenames", () => {
    for (const sounds of Object.values(enemyAttackSounds)) {
      expect(sounds.length).toBeGreaterThan(0);
      for (const s of sounds) {
        expect(s).toBeTruthy();
        expect(s).toMatch(/\.ogg$/);
      }
    }
  });

  it("enemy IDs are unique", () => {
    const ids = Object.keys(enemyAttackSounds);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("battleEventSounds", () => {
  it("all values are non-empty .ogg filenames", () => {
    for (const name of Object.values(battleEventSounds)) {
      expect(name).toBeTruthy();
      expect(name).toMatch(/\.ogg$/);
    }
  });
});

describe("uiSounds", () => {
  it("all values are non-empty .ogg filenames", () => {
    for (const name of Object.values(uiSounds)) {
      expect(name).toBeTruthy();
      expect(name).toMatch(/\.ogg$/);
    }
  });

  it("all UI sound names are unique", () => {
    const values = Object.values(uiSounds);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("stingerSounds", () => {
  it("all values are non-empty .ogg filenames", () => {
    for (const name of Object.values(stingerSounds)) {
      expect(name).toBeTruthy();
      expect(name).toMatch(/\.ogg$/);
    }
  });

  it("all stinger names are unique", () => {
    const values = Object.values(stingerSounds);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("cross-registry key consistency", () => {
  it("every card with cardSounds is defined in cardLibrary", async () => {
    const { cardLibrary } = await import("@/lib/game-data/cards");
    const cardIds = new Set(cardLibrary.map((c: { id: string }) => c.id));
    for (const cardId of Object.keys(cardSounds)) {
      expect(cardIds.has(cardId)).toBe(true);
    }
  });

  it("every enemy with enemyAttackSounds is defined in enemyBestiary", async () => {
    const { enemyBestiary } = await import("@/lib/game-data/compendium");
    const enemyIds = new Set(enemyBestiary.map((e: { id: string }) => e.id));
    for (const enemyId of Object.keys(enemyAttackSounds)) {
      expect(enemyIds.has(enemyId)).toBe(true);
    }
  });
});
