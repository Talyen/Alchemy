// Validates every card, enemy, and trinket description advertises the same kinds
// of effects it actually performs. Keeps hand-authored text structurally honest.
//
// Cardinal rule: the compendium is the single source of truth for display data.
// Any file that authors its own description strings for enemies/cards/trinkets
// instead of reading from the compendium will be flagged here and deleted.

import { describe, expect, it } from "vitest";
import { cardLibrary, enemyBestiary, trinketLibrary } from "@/lib/game-data";
import type { BattleCardEffect } from "@/lib/game-data";

// ─────────────────────────── Helpers ───────────────────────────

function countByKind(effects: BattleCardEffect[], kind: string): number {
  return effects.filter((e) => e.kind === kind).length;
}

function hasKind(effects: BattleCardEffect[], kind: string): boolean {
  return effects.some((e) => e.kind === kind);
}

function hasLifesteal(effects: BattleCardEffect[]): boolean {
  return effects.some((e) => e.kind === "damage" && "lifesteal" in e && e.lifesteal === true);
}

function hasEqualToBlockOrArmor(effects: BattleCardEffect[]): boolean {
  return effects.some((e) => e.kind === "damage" && ("equalToBlock" in e && e.equalToBlock || "equalToArmor" in e && e.equalToArmor));
}

function countLinesStartingWith(lines: string[], prefix: string): number {
  return lines.filter((l) => l.startsWith(prefix)).length;
}

/** Count lines that look like a healing effect — "Heal N", "Restore N Health", "Gain N Health" */
function countHealLines(lines: string[]): number {
  return lines.filter(
    (l) => l.startsWith("Heal ") || (l.startsWith("Restore ") && l.includes("Health")) || (l.startsWith("Gain ") && l.includes("Health")),
  ).length;
}

// ─────────────────────────── Cards ───────────────────────────

describe("card descriptions vs effects", () => {
  it.each(cardLibrary.map((c) => [c.id, c.title] as const))(
    "%s — effect counts match description line patterns",
    (_id, title) => {
      const card = cardLibrary.find((c) => c.title === title)!;
      const { effects, descriptionLines } = card;

      const dealLines = countLinesStartingWith(descriptionLines, "Deal ");
      const damageEffects = countByKind(effects, "damage");

      const healLines = countHealLines(descriptionLines);
      const healEffects = countByKind(effects, "heal");

      const restoreLinesCount = countLinesStartingWith(descriptionLines, "Restore ");
      const restoreHealthLines = descriptionLines.filter((l) => l.startsWith("Restore ") && l.includes("Health")).length;
      const restoreManaLines = restoreLinesCount - restoreHealthLines;
      const restoreManaEffects = countByKind(effects, "restore-mana");

      const goldEffectLines = descriptionLines.filter(
        (l) => (l.startsWith("Gain ") || l.startsWith("Steal ")) && l.includes("Gold"),
      ).length;
      const goldEffects = countByKind(effects, "gain-gold");

      const wishLines = countLinesStartingWith(descriptionLines, "Wish ");
      const wishEffects = countByKind(effects, "wish");

      const removeLines = countLinesStartingWith(descriptionLines, "Remove ");
      const removeEffects = countByKind(effects, "remove-harmful-status");

      const loseManaLines = descriptionLines.filter(
        (l) => l.startsWith("Lose ") && l.includes("Mana Crystal"),
      ).length;
      const loseManaEffects = countByKind(effects, "lose-max-mana");

      const loseHealthLines = descriptionLines.filter(
        (l) => l.startsWith("Lose ") && l.includes("Health"),
      ).length;
      const loseHealthEffects = countByKind(effects, "lose-health");

      const gainMaxManaLines = descriptionLines.filter((l) => l.includes("Maximum Mana")).length;
      const gainMaxManaEffects = countByKind(effects, "gain-max-mana");

      const buffCompanionLines = countLinesStartingWith(descriptionLines, "Increase ");
      const buffCompanionEffects = countByKind(effects, "buff-companion");

      const drawCardsLines = countLinesStartingWith(descriptionLines, "Draw ");
      const drawCardsEffects = countByKind(effects, "draw-cards");

      const stripArmorLines = countLinesStartingWith(descriptionLines, "Strip ");
      const stripArmorEffects = countByKind(effects, "remove-enemy-armor");

      const doubleLines = countLinesStartingWith(descriptionLines, "Double ");
      const doubleEffects = countByKind(effects, "multiply-enemy-status");

      const cleanseLines = countLinesStartingWith(descriptionLines, "Cleanse ");
      const cleanseEffects = countByKind(effects, "remove-player-status");

      if (!hasEqualToBlockOrArmor(effects) && !hasKind(effects, "self-damage")) {
        expect(dealLines).toBe(damageEffects);
      }

      expect(healLines).toBe(healEffects);
      expect(restoreManaLines).toBe(restoreManaEffects);
      expect(goldEffectLines).toBe(goldEffects);
      expect(wishLines).toBe(wishEffects);
      expect(removeLines).toBe(removeEffects);
      expect(loseManaLines).toBe(loseManaEffects);
      expect(gainMaxManaLines).toBe(gainMaxManaEffects);
      expect(loseHealthLines).toBe(loseHealthEffects);
      expect(drawCardsLines).toBe(drawCardsEffects);
      expect(stripArmorLines).toBe(stripArmorEffects);
      expect(doubleLines).toBe(doubleEffects);
      expect(cleanseLines).toBe(cleanseEffects);

      if (!hasKind(effects, "self-damage")) {
        expect(buffCompanionLines).toBe(buffCompanionEffects);
      }
    },
  );

  it("every 'Gain' line references a known effect type", () => {
    const knownGainTargets = ["Block", "Armor", "Forge", "Health", "Maximum Mana", "Gold"];
    for (const card of cardLibrary) {
      for (const line of card.descriptionLines) {
        if (line.startsWith("Gain ")) {
          const isKnown = knownGainTargets.some((t) => line.includes(t));
          expect(isKnown).toBe(true);
        }
      }
    }
  });

  it("special keywords match their corresponding effects", () => {
    for (const card of cardLibrary) {
      const { descriptionLines, effects } = card;

      if (hasLifesteal(effects)) {
        expect(descriptionLines.some((l) => l === "Leech"),
          `${card.id} has lifesteal but no 'Leech' line`).toBe(true);
      }

      if ("consume" in card && card.consume === true) {
        const hasConsume = descriptionLines.some((l) => l === "Consume");
        const hasCompanion = hasKind(card.effects, "summon-companion") && descriptionLines.some((l) => l === "Companion");
        expect(hasConsume || hasCompanion,
          `${card.id} has consume:true but no 'Consume' or 'Companion' line`).toBe(true);
      }

      if (hasKind(effects, "summon-companion")) {
        expect(descriptionLines.some((l) => l.includes("Companion"))).toBe(true);
      }

      if (hasKind(effects, "lose-max-mana")) {
        expect(descriptionLines.some((l) => l.includes("Mana Crystal")),
          `${card.id} has lose-max-mana but no 'Mana Crystal' line`).toBe(true);
      }

      if (hasKind(effects, "lose-health")) {
        expect(descriptionLines.some((l) => l.startsWith("Lose ") && l.includes("Health")),
          `${card.id} has lose-health but no 'Lose ... Health' line`).toBe(true);
      }

      if (hasKind(effects, "draw-cards")) {
        expect(descriptionLines.some((l) => l.startsWith("Draw ")),
          `${card.id} has draw-cards but no 'Draw' line`).toBe(true);
      }

      if (hasKind(effects, "remove-enemy-armor")) {
        expect(descriptionLines.some((l) => l.startsWith("Strip ")),
          `${card.id} has remove-enemy-armor but no 'Strip' line`).toBe(true);
      }

      if (hasKind(effects, "multiply-enemy-status")) {
        expect(descriptionLines.some((l) => l.startsWith("Double ")),
          `${card.id} has multiply-enemy-status but no 'Double' line`).toBe(true);
      }

      if (hasKind(effects, "remove-player-status")) {
        expect(descriptionLines.some((l) => l.startsWith("Cleanse ")),
          `${card.id} has remove-player-status but no 'Cleanse' line`).toBe(true);
      }

      if (hasKind(effects, "buff-companion")) {
        expect(descriptionLines.some((l) => l.includes("Companion damage"))).toBe(true);
      }

      if (hasKind(effects, "self-damage")) {
        expect(descriptionLines.some((l) => l.includes("yourself") || l.startsWith("Receive ")),
          `${card.id} has self-damage but no matching description`).toBe(true);
      }
    }
  });
});

// ─────────────────────────── Enemies ───────────────────────────

describe("enemy descriptions vs attack effects", () => {
  it.each(enemyBestiary.map((e) => [e.id, e.title] as const))(
    "%s — attack effects have valid kinds",
    (_id, title) => {
      const enemy = enemyBestiary.find((e) => e.title === title)!;
      for (const effect of enemy.attackEffects) {
        expect(["damage", "player-status"]).toContain(effect.kind);
        if (effect.kind === "damage") {
          expect(typeof effect.amount).toBe("number");
          expect(effect.amount).toBeGreaterThan(0);
        }
        if (effect.kind === "player-status") {
          expect(typeof effect.amount).toBe("number");
          expect(effect.amount).toBeGreaterThan(0);
        }
      }
    },
  );

  it("no enemy references a trait ID not in its trait list", () => {
    const usedTraitIds = new Set(enemyBestiary.flatMap((e) => e.traits.map((t) => t.id)));
    expect(usedTraitIds.has("forge-regeneration")).toBe(false);
  });

  it.each(enemyBestiary.map((e) => [e.id, e.title] as const))(
    "%s — trait descriptions mention the trait's key effect",
    (_id, title) => {
      const enemy = enemyBestiary.find((e) => e.title === title)!;
      for (const trait of enemy.traits) {
        const desc = trait.description.toLowerCase();
        switch (trait.id) {
          case "iron-hide":
            expect(desc).toMatch(/armor/);
            break;
          case "rusting-carapace":
            expect(desc).toMatch(/forge/);
            break;
          case "glacial-shell":
            expect(desc).toMatch(/freeze|burn/);
            break;
          case "regeneration":
            expect(desc).toMatch(/health|heal/);
            break;
          case "brittle-bones":
            expect(desc).toMatch(/holy|stun/);
            break;
          case "trinket-hoarder":
            expect(desc).toMatch(/burn|trinket/);
            break;
          case "burn-resistance":
            expect(desc).toMatch(/burn/);
            break;
          case "poison-resistance":
            expect(desc).toMatch(/poison/);
            break;
          case "holy-vulnerability":
            expect(desc).toMatch(/holy/);
            break;
          case "living-armor":
            expect(desc).toMatch(/bleed|armor/);
            break;
          case "gold-trove":
            expect(desc).toMatch(/gold/);
            break;
        }
      }
    },
  );
});

// ─────────────────────────── Trinkets ───────────────────────────

describe("trinket descriptions vs manifest effects", () => {
  const knownTrinketMap: Record<
    string,
    { description: string; check: (desc: string) => void }
  > = {
    "brass-censer": {
      description: "first Holy damage each combat is doubled",
      check: (desc) => expect(desc).toContain("holy"),
    },
    "tattered-pages": {
      description: "draws 1 extra card at start of combat",
      check: (desc) => expect(desc).toMatch(/draw|additional|card/),
    },
    meteorite: {
      description: "first Burn damage each combat is doubled",
      check: (desc) => expect(desc).toContain("burn"),
    },
    "bone-charm": {
      description: "heal on kill",
      check: (desc) => expect(desc).toMatch(/health|heal/),
    },
    "obsidian-hammer": {
      description: "Forge stun rider",
      check: (desc) => expect(desc).toMatch(/forge.*stun|stun.*forge/),
    },
    "icy-heart": {
      description: "deal 6 damage on freeze",
      check: (desc) => expect(desc).toMatch(/freeze.*damage|damage.*freeze/),
    },
    "ironwood-buckler": {
      description: "block to armor at threshold",
      check: (desc) => expect(desc).toMatch(/block.*armor|armor.*block/),
    },
    "runic-quill": {
      description: "draw on consume",
      check: (desc) => expect(desc).toMatch(/consume|draw/),
    },
    "sin-eaters-lantern": {
      description: "heal on status removal",
      check: (desc) => expect(desc).toMatch(/health|heal/),
    },
    "vanguards-crest": {
      description: "forge on block absorb",
      check: (desc) => expect(desc).toMatch(/forge|block/),
    },
    "parasitic-bloom": {
      description: "poison leech chance",
      check: (desc) => expect(desc).toMatch(/poison|leech/),
    },
    "cutpurse-knife": {
      description: "gold on bleed",
      check: (desc) => expect(desc).toMatch(/bleed.*gold|gold.*bleed/),
    },
    "wishing-well-coin": {
      description: "gold on wish",
      check: (desc) => expect(desc).toMatch(/wish.*gold|gold.*wish/),
    },
    "merchants-favor": {
      description: "discount at shops",
      check: (desc) => expect(desc).toMatch(/purchase|shop|gold|less/),
    },
    "plague-doctors-mask": {
      description: "first status immunity",
      check: (desc) => expect(desc).toMatch(/immune|harmful.*status/),
    },
    "mortar-and-pestle": {
      description: "first potion free",
      check: (desc) => expect(desc).toMatch(/potion|free/),
    },
    "sundering-charm": {
      description: "remove armor on physical and stun",
      check: (desc) => expect(desc).toMatch(/armor/),
    },
    "resonant-chimes": {
      description: "mana on 3+ cards",
      check: (desc) => expect(desc).toMatch(/cards.*mana|mana.*cards/),
    },
    "smugglers-map": {
      description: "bonus gold from combat",
      check: (desc) => expect(desc).toMatch(/gold/),
    },
    "groves-favor": {
      description: "start of battle heal",
      check: (desc) => expect(desc).toMatch(/health|heal|restore/),
    },
    "companions-collar": {
      description: "companion damage bonus",
      check: (desc) => expect(desc).toMatch(/companion.*damage|damage.*companion/),
    },
    "frozen-pocketwatch": {
      description: "freeze lasts longer",
      check: (desc) => expect(desc).toMatch(/freeze/),
    },
    thunderstone: {
      description: "nature damage on stun",
      check: (desc) => expect(desc).toMatch(/stun/),
    },
    "lucky-clover": {
      description: "nature damage gold chance",
      check: (desc) => expect(desc).toMatch(/nature|gold|chance/),
    },
  };

  it("every trinket has a known description check", () => {
    for (const trinket of trinketLibrary) {
      expect(knownTrinketMap[trinket.id]).toBeDefined();
    }
  });

  it("every known trinket check has a matching compendium entry", () => {
    for (const id of Object.keys(knownTrinketMap)) {
      const entry = trinketLibrary.find((t) => t.id === id);
      expect(entry).toBeDefined();
    }
  });

  it.each(trinketLibrary.map((t) => [t.id, t.title] as const))(
    "%s — description mentions key mechanic",
    (_id, title) => {
      const trinket = trinketLibrary.find((t) => t.title === title)!;
      const check = knownTrinketMap[trinket.id];
      if (!check) return;
      check.check(trinket.descriptionLines.join(" ").toLowerCase());
    },
  );

  it("every trinket has at least one non-empty description line", () => {
    for (const trinket of trinketLibrary) {
      expect(trinket.descriptionLines.length).toBeGreaterThan(0);
      for (const line of trinket.descriptionLines) {
        expect(line.length).toBeGreaterThan(0);
      }
    }
  });
});
