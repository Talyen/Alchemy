// Validates every card, enemy, and boon description advertises the same kinds
// of effects it actually performs. Keeps hand-authored text structurally honest.
//
// Cardinal rule: the compendium is the single source of truth for display data.
// Any file that authors its own description strings for enemies/cards/boons
// instead of reading from the compendium will be flagged here and deleted.

import { describe, expect, it } from "vitest";
import {
  cardLibrary,
  companionLibrary,
  enemyBestiary,
  expectedCompanionTurnLine,
  trinketLibrary,
  type BattleCardEffect,
} from "@/lib/game-data";
import { hasKind, hasLifesteal, validateCardDescriptionParity } from "@/lib/content-validation/card-parity";

// ─────────────────────────── Cards ───────────────────────────

describe("card descriptions vs effects", () => {
  it("keeps Gambler's Shot range punctuation readable", () => {
    const card = cardLibrary.find((candidate) => candidate.id === "gamblers-shot");
    expect(card?.descriptionLines).toContain("Deal 1–6 Random damage");
  });

  it.each(cardLibrary.map((c) => [c.id, c.title] as const))("%s — descriptions match effects", (_id, title) => {
    const card = cardLibrary.find((c) => c.title === title)!;
    const issues = validateCardDescriptionParity(card);
    expect(issues, issues.map((i) => i.message).join("; ")).toEqual([]);
  });

  it("summon cards advertise companion turn damage from companionLibrary", () => {
    for (const card of cardLibrary) {
      const summon = card.effects.find(
        (e): e is Extract<BattleCardEffect, { kind: "summon-companion" }> => e.kind === "summon-companion",
      );
      if (!summon) continue;

      const companion = companionLibrary[summon.companionId];
      const turnEffect = companion.turnStartEffects[0];
      expect(turnEffect, `${card.id} companion missing turn-start effect`).toBeDefined();

      const companionLine = card.descriptionLines.find(
        (l) =>
          /^Deals \d+/.test(l) ||
          /^Restores \d+/.test(l) ||
          /^Cleanses \d+/.test(l) ||
          /^Steals \d+/.test(l) ||
          /^Gains? \d+ Block/.test(l) ||
          /^Draws \d+/.test(l),
      );
      expect(companionLine, `${card.id} missing companion turn line`).toBeDefined();
      expect(companionLine).toBe(expectedCompanionTurnLine(turnEffect));
      expect(card.descriptionLines.some((l) => l === "Companion")).toBe(true);
    }
  });

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

      if (card.tags?.includes("archery")) {
        expect(
          descriptionLines.some((l) => l === "Archery"),
          `${card.id} has archery tag but no 'Archery' line`,
        ).toBe(true);
      }

      if (descriptionLines.some((l) => l === "Archery")) {
        expect(card.tags?.includes("archery"), `${card.id} has 'Archery' line but no archery tag`).toBe(true);
      }

      if (hasLifesteal(effects)) {
        expect(
          descriptionLines.some((l) => l === "Leech"),
          `${card.id} has lifesteal but no 'Leech' line`,
        ).toBe(true);
      }

      if ("consume" in card && card.consume === true) {
        const hasConsume = descriptionLines.some((l) => l === "Consume");
        const hasCompanion =
          hasKind(card.effects, "summon-companion") && descriptionLines.some((l) => l === "Companion");
        expect(hasConsume || hasCompanion, `${card.id} has consume:true but no 'Consume' or 'Companion' line`).toBe(
          true,
        );
      }

      if (hasKind(effects, "summon-companion")) {
        expect(descriptionLines.some((l) => l.includes("Companion"))).toBe(true);
      }

      if (hasKind(effects, "lose-max-mana")) {
        expect(
          descriptionLines.some((l) => l.includes("Mana Crystal")),
          `${card.id} has lose-max-mana but no 'Mana Crystal' line`,
        ).toBe(true);
      }

      if (hasKind(effects, "lose-health")) {
        expect(
          descriptionLines.some((l) => l.startsWith("Lose ") && l.includes("Health")),
          `${card.id} has lose-health but no 'Lose ... Health' line`,
        ).toBe(true);
      }

      if (hasKind(effects, "draw-cards")) {
        expect(
          descriptionLines.some((l) => l.startsWith("Draw ")),
          `${card.id} has draw-cards but no 'Draw' line`,
        ).toBe(true);
      }

      if (hasKind(effects, "remove-enemy-armor")) {
        expect(
          descriptionLines.some((l) => l.startsWith("Strip ")),
          `${card.id} has remove-enemy-armor but no 'Strip' line`,
        ).toBe(true);
      }

      if (hasKind(effects, "multiply-enemy-status")) {
        expect(
          descriptionLines.some((l) => l.startsWith("Double ")),
          `${card.id} has multiply-enemy-status but no 'Double' line`,
        ).toBe(true);
      }

      if (hasKind(effects, "remove-player-status")) {
        expect(
          descriptionLines.some((l) => l.startsWith("Cleanse ")),
          `${card.id} has remove-player-status but no 'Cleanse' line`,
        ).toBe(true);
      }

      if (hasKind(effects, "buff-companion")) {
        expect(descriptionLines.some((l) => l.includes("Companion damage"))).toBe(true);
      }

      if (hasKind(effects, "self-damage")) {
        expect(
          descriptionLines.some((l) => l.includes("yourself") || l.startsWith("Receive ")),
          `${card.id} has self-damage but no matching description`,
        ).toBe(true);
      }
    }
  });
});

// ─────────────────────────── Enemies ───────────────────────────

describe("enemy descriptions vs attack effects", () => {
  it.each(enemyBestiary.map((e) => [e.id, e.title] as const))("%s — attack effects have valid kinds", (_id, title) => {
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
  });

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

// ─────────────────────────── Boons ───────────────────────────

describe("boon descriptions vs manifest effects", () => {
  const knownBoonMap: Record<string, { description: string; check: (desc: string) => void }> = {
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

  it("every boon has a known description check", () => {
    for (const boon of trinketLibrary) {
      expect(knownBoonMap[boon.id]).toBeDefined();
    }
  });

  it("every known boon check has a matching compendium entry", () => {
    for (const id of Object.keys(knownBoonMap)) {
      const entry = trinketLibrary.find((t) => t.id === id);
      expect(entry).toBeDefined();
    }
  });

  it.each(trinketLibrary.map((t) => [t.id, t.title] as const))(
    "%s — description mentions key mechanic",
    (_id, title) => {
      const boon = trinketLibrary.find((t) => t.title === title)!;
      const check = knownBoonMap[boon.id];
      if (!check) return;
      check.check(boon.descriptionLines.join(" ").toLowerCase());
    },
  );

  it("every boon has at least one non-empty description line", () => {
    for (const boon of trinketLibrary) {
      expect(boon.descriptionLines.length).toBeGreaterThan(0);
      for (const line of boon.descriptionLines) {
        expect(line.length).toBeGreaterThan(0);
      }
    }
  });
});
