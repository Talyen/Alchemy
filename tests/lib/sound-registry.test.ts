import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { cardLibrary, enemyBestiary } from "@/lib/game-data";
import { cardSounds, enemyAttackSounds, battleEventSounds, uiSounds, stingerSounds } from "@/lib/sound-registry";

const publicSoundsDir = path.resolve(process.cwd(), "public", "sounds");
const optimizeSoundsScript = path.resolve(process.cwd(), "scripts", "optimize-sounds.mjs");

const preservedPublicSounds = new Set([
  "click-double-off.ogg",
  "click-double-on.ogg",
  "coin-collect.ogg",
  "coin-jingle-small.ogg",
  "coins-gather-quick.ogg",
  "gurgling.ogg",
  "keys-jingling.ogg",
  "kick.ogg",
  "power-down.ogg",
  "punch-3.ogg",
  "sci-fi-confirm.ogg",
  "sci-fi-error.ogg",
  "splat-quick.ogg",
  "squelching-4.ogg",
  "swipe.ogg",
  "vibraphone-chime-quick.ogg",
  "whoosh-1.ogg",
  "whoosh-2.ogg",
]);

function registeredSounds() {
  return new Set([
    ...Object.values(cardSounds).flat(),
    ...Object.values(enemyAttackSounds).flat(),
    ...Object.values(battleEventSounds),
    ...Object.values(uiSounds),
    ...Object.values(stingerSounds),
  ]);
}

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

describe("sound asset files", () => {
  it("every registered sound exists in public/sounds", () => {
    const publicSounds = new Set(readdirSync(publicSoundsDir));
    for (const sound of registeredSounds()) {
      expect(publicSounds.has(sound), `${sound} is missing from public/sounds`).toBe(true);
    }
  });

  it("registered sounds are generated or explicitly preserved", () => {
    const script = readFileSync(optimizeSoundsScript, "utf8");
    const generatedSounds = new Set(Array.from(script.matchAll(/target:\s*"([^"]+\.ogg)"/g), (match) => match[1]));

    for (const sound of registeredSounds()) {
      const isGenerated = generatedSounds.has(sound);
      const isPreserved = preservedPublicSounds.has(sound) && existsSync(path.join(publicSoundsDir, sound));
      expect(isGenerated || isPreserved, `${sound} is neither optimized nor preserved`).toBe(true);
    }
  });
});
