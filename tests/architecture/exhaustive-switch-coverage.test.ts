import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BATTLE_CARD_EFFECT_KINDS } from "@/lib/game-data/effects/registry";
import { DAMAGE_TYPES } from "@/lib/game-data/types";
import { ROUTE_SCREEN_VALUES } from "@/lib/routing/screens";

const ROOT = join(import.meta.dirname, "../..");

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

function assertContainsCases(filePath: string, kinds: readonly string[], options: { allowDefault?: boolean } = {}) {
  const source = readSource(filePath);
  if (!options.allowDefault) {
    const hasDefault = /default\s*:/u.test(source);
    expect(hasDefault, `${filePath} must not use default: — enumerate every kind`).toBe(false);
  }
  for (const kind of kinds) {
    expect(source.includes(`case "${kind}"`), `${filePath} missing case "${kind}"`).toBe(true);
  }
}

describe("exhaustive switch coverage", () => {
  it("card-builders effectDescriptionLine covers every BattleCardEffect kind", () => {
    assertContainsCases("src/lib/game-data/cards/card-builders.ts", BATTLE_CARD_EFFECT_KINDS);
  });

  it("companion-turn-description covers every BattleCardEffect kind", () => {
    assertContainsCases("src/lib/game-data/cards/companion-turn-description.ts", BATTLE_CARD_EFFECT_KINDS);
  });

  it("play-policy scoreEffect covers every BattleCardEffect kind", () => {
    assertContainsCases("src/lib/balance/play-policy.ts", BATTLE_CARD_EFFECT_KINDS);
  });

  it("damage-status-riders covers every DamageType", () => {
    assertContainsCases("src/lib/battle/damage-status-riders.ts", DAMAGE_TYPES);
  });

  it("mystery effect-order covers every MysteryEffect kind", () => {
    const mysteryKinds = [
      "addCard",
      "chooseCard",
      "healHealth",
      "damageHealth",
      "gainGold",
      "loseGold",
      "gainXP",
      "removeCard",
      "gainTrinket",
      "gainRandomTrinket",
      "gainGeneratedGear",
      "gainMaterial",
    ] as const;
    assertContainsCases("src/lib/mystery/effect-order.ts", mysteryKinds);
  });

  it("run-resume-codec covers every Screen", () => {
    assertContainsCases("src/features/alchemy/shared/stores/run-resume-codec.ts", ROUTE_SCREEN_VALUES, {
      allowDefault: true,
    });
    const source = readSource("src/features/alchemy/shared/stores/run-resume-codec.ts");
    expect(source.includes("case null"), "run-resume-codec missing case null").toBe(true);
    expect(source.includes("case undefined"), "run-resume-codec missing case undefined").toBe(true);
  });
});
