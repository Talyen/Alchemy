import { describe, expect, it } from "vitest";
import { BATTLE_CARD_EFFECT_KINDS } from "@/lib/game-data/effects/registry";
import { DAMAGE_TYPES } from "@/lib/game-data/types";
import { ROUTE_SCREEN_VALUES, isRunResumeScreen } from "@/lib/routing";
import { runActivityScreen, transitionRunActivity } from "@/lib/active-run-session";
import { MYSTERY_EFFECT_KINDS } from "@/lib/mystery";
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
  it("card-builders effectDescriptionLine covers every BattleCardEffect kind", () => {
    assertContainsCases("src/lib/game-data/cards/card-builders.ts", BATTLE_CARD_EFFECT_KINDS);
  });

  it("companion-turn-description covers every BattleCardEffect kind", () => {
    assertContainsCases("src/lib/game-data/cards/companion-turn-description.ts", BATTLE_CARD_EFFECT_KINDS);
  });

  it("autoplay scoreEffect covers every BattleCardEffect kind", () => {
    assertContainsCases("src/lib/battle/autoplay-policy.ts", BATTLE_CARD_EFFECT_KINDS);
  });

  it("damage-status-riders covers every DamageType", () => {
    assertContainsCases("src/lib/battle/damage-status-riders.ts", DAMAGE_TYPES);
  });

  it("mystery effect-order covers every MysteryEffect kind", () => {
    assertContainsCases("src/lib/mystery/effect-order.ts", MYSTERY_EFFECT_KINDS);
  });

  it("maps every gameplay screen to an activity and preserves it across menu navigation", () => {
    for (const screen of ROUTE_SCREEN_VALUES) {
      const next = transitionRunActivity({ kind: "campfire" }, screen);
      expect(runActivityScreen(next), screen).toBe(isRunResumeScreen(screen) ? screen : "campfire");
    }
  });
});
