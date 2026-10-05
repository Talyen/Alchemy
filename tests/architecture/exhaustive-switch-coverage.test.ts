import { BATTLE_CARD_EFFECT_KINDS } from "@/lib/game-data/effects/registry";
import { DAMAGE_TYPES } from "@/lib/game-data/types";
import { describe, expect, it } from "vitest";
import { readText } from "./helpers";

function assertContainsCases(filePath: string, kinds: readonly string[], options: { allowDefault?: boolean } = {}) {
  const source = readText(filePath);
  if (!options.allowDefault) {
    const hasDefault = /default\s*:/u.test(source);
    expect(hasDefault, `${filePath} must not use default: — enumerate every kind`).toBe(false);
  }
  for (const kind of kinds) {
    expect(source.includes(`case "${kind}"`), `${filePath} missing case "${kind}"`).toBe(true);
  }
}

describe("exhaustive switch coverage", () => {
  // Card presentation is an exhaustive mapped type in effect-metadata.ts;
  // effect-kind-coverage and card-builders tests exercise its entries and wording.

  it("companion-turn-description covers every BattleCardEffect kind", () => {
    assertContainsCases("src/lib/game-data/cards/companion-turn-description.ts", BATTLE_CARD_EFFECT_KINDS);
  });

  it("autoplay scoreEffect covers every BattleCardEffect kind", () => {
    assertContainsCases("src/lib/battle/autoplay-policy.ts", BATTLE_CARD_EFFECT_KINDS);
  });

  it("damage-status-riders covers every DamageType", () => {
    assertContainsCases("src/lib/battle/damage-status-riders.ts", DAMAGE_TYPES);
  });
});
