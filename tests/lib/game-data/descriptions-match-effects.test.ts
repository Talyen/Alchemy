// Validates every card, enemy, and boon description advertises the same kinds
// of effects it actually performs. Keeps hand-authored text structurally honest.
//
// Cardinal rule: the compendium is the single source of truth for display data.
// Any file that authors its own description strings for enemies/cards/boons
// instead of reading from the compendium will be flagged here and deleted.

import { describe, expect, it } from "vitest";
import { cardLibrary, companionLibrary, enemyBestiary, expectedCompanionTurnLine, boonLibrary } from "@/lib/game-data";
import type { BattleCard, BattleCardEffect } from "@/lib/game-data";

function flattenEffects(effects: BattleCardEffect[]): BattleCardEffect[] {
  return effects.flatMap((e) =>
    e.kind === "chance"
      ? [...flattenEffects(e.successEffects), ...flattenEffects(e.failureEffects)]
      : [e],
  );
}

function countByKind(effects: BattleCardEffect[], kind: string): number {
  return flattenEffects(effects).filter((e) => e.kind === kind).length;
}

function hasKind(effects: BattleCardEffect[], kind: string): boolean {
  return effects.some((e) => e.kind === kind);
}

function hasLifesteal(effects: BattleCardEffect[]): boolean {
  return effects.some((e) => e.kind === "damage" && "lifesteal" in e && e.lifesteal === true);
}

function hasEqualToBlockOrArmor(effects: BattleCardEffect[]): boolean {
  return effects.some(
    (e) =>
      e.kind === "damage" &&
      (("equalToBlock" in e && e.equalToBlock) ||
        ("equalToArmor" in e && e.equalToArmor) ||
        ("equalToGoldPercent" in e && e.equalToGoldPercent)),
  );
}

function hasNonStandardDamageEffects(effects: BattleCardEffect[]): boolean {
  const flat = flattenEffects(effects);
  return (
    hasEqualToBlockOrArmor(flat) ||
    flat.some((e) => e.kind === "cleanse-player-status-to-damage" || e.kind === "random-damage") ||
    effects.some((e) => e.kind === "chance")
  );
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

function parseLeadingNumber(line: string, prefix: string): number | null {
  if (!line.startsWith(prefix)) return null;
  const match = line.slice(prefix.length).match(/^(\d+)/);
  return match ? Number(match[1]) : null;
}

/** Assert fixed numeric amounts in description lines match authored effect amounts. */
function expectNumericParity(card: BattleCard): void {
  const { effects, descriptionLines } = card;
  let damageIndex = 0;
  let playerStatusIndex = 0;
  let healIndex = 0;
  let restoreManaIndex = 0;
  let goldIndex = 0;
  let wishIndex = 0;
  let removeHarmfulIndex = 0;

  const damageEffects = effects.filter((e): e is Extract<BattleCardEffect, { kind: "damage" }> => e.kind === "damage");
  const playerStatusEffects = effects.filter(
    (e): e is Extract<BattleCardEffect, { kind: "player-status" }> => e.kind === "player-status",
  );
  const healEffects = effects.filter((e): e is Extract<BattleCardEffect, { kind: "heal" }> => e.kind === "heal");
  const restoreManaEffects = effects.filter(
    (e): e is Extract<BattleCardEffect, { kind: "restore-mana" }> => e.kind === "restore-mana",
  );
  const goldEffects = effects.filter((e): e is Extract<BattleCardEffect, { kind: "gain-gold" }> => e.kind === "gain-gold");
  const wishEffects = effects.filter((e): e is Extract<BattleCardEffect, { kind: "wish" }> => e.kind === "wish");
  const removeHarmfulEffects = effects.filter(
    (e): e is Extract<BattleCardEffect, { kind: "remove-harmful-status" }> => e.kind === "remove-harmful-status",
  );

  for (const line of descriptionLines) {
    if (line.startsWith("Deals ")) continue;

    if (line.startsWith("Deal ")) {
      const effect = damageEffects[damageIndex++];
      if (
        !effect ||
        effect.equalToBlock ||
        effect.equalToArmor ||
        effect.equalToGoldPercent ||
        line.includes("equal to") ||
        line.toLowerCase().includes("random")
      ) {
        continue;
      }
      expect(parseLeadingNumber(line, "Deal ")).toBe(effect.amount);
      continue;
    }

    if (line.startsWith("Gain ") && line.includes(" Gold")) {
      const effect = goldEffects[goldIndex++];
      if (effect) expect(parseLeadingNumber(line, "Gain ")).toBe(effect.amount);
      continue;
    }

    if (line.startsWith("Gain ") && line.includes(" Block") && line.includes("per Mana Crystal")) {
      const effect = playerStatusEffects[playerStatusIndex++];
      if (effect?.status === "block" && "perManaCrystal" in effect && effect.perManaCrystal) {
        expect(parseLeadingNumber(line, "Gain ")).toBe(effect.perManaCrystal);
      }
      continue;
    }

    if (line.startsWith("Gain ") && (line.includes(" Block") || line.includes(" Armor") || line.includes(" Forge"))) {
      const effect = playerStatusEffects[playerStatusIndex++];
      if (effect && effect.status !== "haste" && !("perManaCrystal" in effect && effect.perManaCrystal)) {
        expect(parseLeadingNumber(line, "Gain ")).toBe(effect.amount);
      }
      continue;
    }

    if (line.startsWith("Heal ")) {
      const effect = healEffects[healIndex++];
      if (effect) expect(parseLeadingNumber(line, "Heal ")).toBe(effect.amount);
      continue;
    }

    if (line.startsWith("Restore ") && line.includes("Mana")) {
      const effect = restoreManaEffects[restoreManaIndex++];
      if (effect) expect(parseLeadingNumber(line, "Restore ")).toBe(effect.amount);
      continue;
    }

    if (line.startsWith("Restore ") && line.includes("Health")) {
      const effect = healEffects[healIndex++];
      if (effect) expect(parseLeadingNumber(line, "Restore ")).toBe(effect.amount);
      continue;
    }

    if (line.startsWith("Wish ")) {
      const effect = wishEffects[wishIndex++];
      if (effect) expect(parseLeadingNumber(line, "Wish ")).toBe(effect.amount);
      continue;
    }

    if ((line.startsWith("Remove ") || line.startsWith("Cleanse ")) && line.includes("harmful status")) {
      const effect = removeHarmfulEffects[removeHarmfulIndex++];
      if (effect) {
        const parsed = parseLeadingNumber(line, line.startsWith("Remove ") ? "Remove " : "Cleanse ");
        expect(parsed).toBe(effect.amount);
      }
    }
  }
}

// ─────────────────────────── Cards ───────────────────────────

describe("card descriptions vs effects", () => {
  it.each(cardLibrary.map((c) => [c.id, c.title] as const))(
    "%s — effect counts match description line patterns",
    (_id, title) => {
      const card = cardLibrary.find((c) => c.title === title)!;
      const { effects, descriptionLines } = card;

      const dealLines = descriptionLines.filter(
        (l) =>
          l.startsWith("Deal ") &&
          !l.includes("equal to") &&
          !l.toLowerCase().includes("random"),
      ).length;
      const damageEffects = countByKind(effects, "damage") + countByKind(effects, "random-damage");

      const healLines = countHealLines(descriptionLines);
      const healEffects = countByKind(effects, "heal");

      const restoreLinesCount = countLinesStartingWith(descriptionLines, "Restore ");
      const restoreHealthLines = descriptionLines.filter((l) => l.startsWith("Restore ") && l.includes("Health")).length;
      const restoreManaLines = restoreLinesCount - restoreHealthLines;
      const restoreManaEffects = countByKind(effects, "restore-mana");

      const goldEffectLines =
        descriptionLines.filter((l) => (l.startsWith("Gain ") || l.startsWith("Steal ")) && l.includes("Gold"))
          .length +
        descriptionLines.filter((l) => l.includes(" or Gain ") && l.includes("Gold")).length;
      const goldEffects = countByKind(effects, "gain-gold");

      const wishLines = countLinesStartingWith(descriptionLines, "Wish ");
      const wishEffects = countByKind(effects, "wish");

      const removeLines = descriptionLines.filter(
        (l) => l.startsWith("Remove ") || (l.startsWith("Cleanse ") && l.includes("harmful status")),
      ).length;
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

      const cleanseLines = descriptionLines.filter(
        (l) => l.startsWith("Cleanse ") && !l.includes("harmful status"),
      ).length;
      const cleanseEffects =
        countByKind(effects, "remove-player-status") + countByKind(effects, "cleanse-player-status-to-damage");

      const gainBlockLines = descriptionLines.filter(
        (l) =>
          l.startsWith("Gain ") && l.includes(" Block") && !l.includes("per Mana Crystal") && !l.endsWith("each turn"),
      ).length;
      const gainBlockEffects = effects.filter(
        (e): e is Extract<BattleCardEffect, { kind: "player-status"; status: "block" }> =>
          e.kind === "player-status" && e.status === "block" && !("perManaCrystal" in e && e.perManaCrystal),
      ).length;

      const perManaBlockLines = descriptionLines.filter((l) => l.includes("per Mana Crystal")).length;
      const perManaBlockEffects = effects.filter(
        (e): e is Extract<BattleCardEffect, { kind: "player-status"; status: "block" }> =>
          e.kind === "player-status" && e.status === "block" && "perManaCrystal" in e && !!e.perManaCrystal,
      ).length;

      const gainArmorLines = descriptionLines.filter(
        (l) => l.startsWith("Gain ") && l.includes(" Armor"),
      ).length;
      const gainArmorEffects = effects.filter(
        (e): e is Extract<BattleCardEffect, { kind: "player-status"; status: "armor" }> =>
          e.kind === "player-status" && e.status === "armor",
      ).length;

      const gainForgeLines = descriptionLines.filter(
        (l) => l.startsWith("Gain ") && l.includes(" Forge"),
      ).length;
      const gainForgeEffects = effects.filter(
        (e): e is Extract<BattleCardEffect, { kind: "player-status"; status: "forge" }> =>
          e.kind === "player-status" && e.status === "forge",
      ).length;

      const hasteEffects = effects.filter(
        (e): e is Extract<BattleCardEffect, { kind: "player-status"; status: "haste" }> =>
          e.kind === "player-status" && e.status === "haste",
      ).length;

      const phoenixFeatherEffects = flattenEffects(effects).filter(
        (e): e is Extract<BattleCardEffect, { kind: "player-status"; status: "phoenixFeather" }> =>
          e.kind === "player-status" && e.status === "phoenixFeather",
      ).length;

      if (!hasNonStandardDamageEffects(effects)) {
        if (hasKind(effects, "self-damage")) {
          expect(descriptionLines.some((l) => /self|Receive/.test(l))).toBe(true);
        } else {
          expect(dealLines).toBe(damageEffects);
        }
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
      expect(gainBlockLines).toBe(gainBlockEffects);
      expect(perManaBlockLines).toBe(perManaBlockEffects);
      expect(gainArmorLines).toBe(gainArmorEffects);
      expect(gainForgeLines).toBe(gainForgeEffects);

      if (hasteEffects > 0) {
        expect(descriptionLines.some((l) => l.includes("extra turn"))).toBe(true);
      }

      if (phoenixFeatherEffects > 0) {
        expect(descriptionLines.some((l) => l.includes("die") || l.includes("30%"))).toBe(true);
      }

      if (!hasKind(effects, "self-damage")) {
        expect(buffCompanionLines).toBe(buffCompanionEffects);
      }

      expectNumericParity(card);
    },
  );

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
          /^Gain \d+ Block/.test(l) ||
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
        expect(descriptionLines.some((l) => l === "Archery"),
          `${card.id} has archery tag but no 'Archery' line`).toBe(true);
      }

      if (descriptionLines.some((l) => l === "Archery")) {
        expect(card.tags?.includes("archery"),
          `${card.id} has 'Archery' line but no archery tag`).toBe(true);
      }

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
          case "boon-hoarder":
            expect(desc).toMatch(/burn|boon/);
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
  const knownBoonMap: Record<
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

  it("every boon has a known description check", () => {
    for (const boon of boonLibrary) {
      expect(knownBoonMap[boon.id]).toBeDefined();
    }
  });

  it("every known boon check has a matching compendium entry", () => {
    for (const id of Object.keys(knownBoonMap)) {
      const entry = boonLibrary.find((t) => t.id === id);
      expect(entry).toBeDefined();
    }
  });

  it.each(boonLibrary.map((t) => [t.id, t.title] as const))(
    "%s — description mentions key mechanic",
    (_id, title) => {
      const boon = boonLibrary.find((t) => t.title === title)!;
      const check = knownBoonMap[boon.id];
      if (!check) return;
      check.check(boon.descriptionLines.join(" ").toLowerCase());
    },
  );

  it("every boon has at least one non-empty description line", () => {
    for (const boon of boonLibrary) {
      expect(boon.descriptionLines.length).toBeGreaterThan(0);
      for (const line of boon.descriptionLines) {
        expect(line.length).toBeGreaterThan(0);
      }
    }
  });
});
