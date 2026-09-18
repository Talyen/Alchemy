import { describe, expect, it } from "vitest";
import { cardLibrary, companionLibrary, enemyBestiary } from "@/lib/game-data";
import { COMPANION_SOUND_CARD_IDS, MUSIC_KEYS } from "@/lib/game-constants";
import { cardSounds, enemyAttackSounds, battleEventSounds, uiSounds, stingerSounds } from "@/lib/audio/sound-registry";

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

describe("intentional cross-table sound sharing", () => {
  // These cues are shared across tables on purpose (one file, two semantic
  // entries). The registry defines them via shared constants; this pin keeps
  // a rename on one side from silently forking the other.
  it("reuses the same file for battle and UI equivalents", () => {
    expect(battleEventSounds.gainGold).toBe(uiSounds.shopBuy);
    expect(battleEventSounds.endTurn).toBe(uiSounds.toggleOff);
    expect(battleEventSounds.consumeCard).toBe(uiSounds.shopRemove);
    expect(cardSounds["will-o-wisp-companion"]).toContain(uiSounds.musicBoxMystery);
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
  "astral-arrow",
  "avatar",
  "blizzard",
  "bounty-shot",
  "caustic-jab",
  "combustion",
  "concussive-shot",
  "crystal-bulwark",
  "dark-pact",
  "earthquake",
  "exorcism",
  "fire-arrow",
  "gamblers-shot",
  "glacial-ward",
  "golden-plate",
  "hemorrhage",
  "ice-shot",
  "kindling",
  "lightning-arrow",
  "lightning-bolt",
  "maul",
  "molten-bulwark",
  "phoenix-feather",
  "pixie-dust",
  "pounce",
  "predators-focus",
  "ray-of-frost",
  "rend",
  "roll-the-dice",
  "sanctified-plate",
  "sap-arrow",
  "serrated-arrowhead",
  "shadowstep",
  "sniff-out",
  "spiked-shield",
  "stargaze",
  "tithe",
  "venom-arrow",
  "wishing-well",
];

const SILENT_ENEMY_IDS: readonly string[] = [
  "bandit",
  "banshee",
  "blood-countess",
  "blood-cultist",
  "brawler",
  "cleric",
  "dire-wolf",
  "earth-elemental",
  "fire-imp",
  "giant-snake",
  "giant-spider",
  "hellhound",
  "ice-wraith",
  "inquisitor",
  "ogre",
  "paladin",
  "pyromancer",
  "seraph",
  "stone-golem",
  "stone-titan",
  "vampire",
  "will-o-wisp",
  "winter-wolf",
  "yeti",
  "zealot",
];

describe("silent-coverage pinning", () => {
  it("every companion has a card sound and a battle companion mapping", () => {
    for (const id of Object.keys(companionLibrary)) {
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
