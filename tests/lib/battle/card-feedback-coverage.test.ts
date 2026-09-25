import { applyCardHealing } from "@/lib/battle/status-player";
import { describe, expect, it } from "vitest";
import { cardById } from "@/lib/game-data";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { applyHealingWithCombatText } from "@/lib/battle/player-rewards";
import { shouldShowCombatText } from "@/lib/battle/combat-text-events";
import type { CombatTextEvent } from "@/lib/battle";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

const cards = Object.values(cardById).filter(
  (card) => card.effects.length > 0 && !["cleanse", "panacea-potion", "smelling-salts"].includes(card.id),
);
describe("card feedback coverage", () => {
  it.each(cards)("$id has visible feedback even with full Health and no ailments", (card) => {
    const texts: CombatTextEvent[] = [];
    applyCardEffects(
      patchBattleState({
        playerHealth: 100,
        playerMaxHealth: 100,
        enemyHealth: 1000,
        enemyMaxHealth: 1000,
        maxMana: 10,
        mana: 10,
        appliesFightPacing: false,
        rng: () => 0.99,
      }),
      card,
      texts,
    );
    expect(texts.filter(shouldShowCombatText).length).toBeGreaterThan(0);
  });
  it.each(["cleanse", "panacea-potion", "smelling-salts"])(
    "%s does not invent Cleanse feedback when no harmful status is removed",
    (cardId) => {
      const texts: CombatTextEvent[] = [];
      applyCardEffects(patchBattleState({ playerHealth: 100, playerMaxHealth: 100 }), cardById[cardId]!, texts);
      expect(
        texts.some((event) => event.stat === "cleanse" || (event.kind === "notice" && event.signal === "cleanse")),
      ).toBe(false);
    },
  );
  it("leaves the feedback queue empty for a Cleanse effect with no target", () => {
    const texts: CombatTextEvent[] = [];
    applyCardEffects(
      patchBattleState(),
      makeTestCard({ effects: [{ kind: "remove-harmful-status", amount: 1 }] }),
      texts,
    );
    expect(texts).toEqual([]);
  });
  it("Predator's Focus acknowledges every cast without accumulating its Leech flag", () => {
    const texts: CombatTextEvent[] = [];
    let state = patchBattleState();
    for (let i = 0; i < 2; i += 1) state = applyCardEffects(state, cardById["predators-focus"]!, texts);
    expect(state.flags.nextHitCrit).toBe(false);
    expect(state.flags.nextHitLeech).toBe(true);
    expect(texts.filter((event) => event.kind === "notice").map((event) => event.stat)).toEqual(["nextHitLeech"]);
  });
  it("uses the same modified healing amount for Clean Slate overflow", () => {
    const state = patchBattleState({
      playerHealth: 99,
      playerMaxHealth: 100,
      appliesFightPacing: false,
      playerStatuses: { poison: 3 },
      talentEffects: { homesteadHealing: 2, cleanseOnCardOverheal: true },
    });
    const next = applyCardHealing(state, 1, []);
    expect(next.playerStatuses.poison).toBe(0);
    expect(next.playerHealth).toBe(100);
  });
  it.each([90, 99, 100])("healing reports modified potency and keeps actual-healing rewards correct (%i)", (health) => {
    const texts: CombatTextEvent[] = [];
    const state = patchBattleState({
      playerHealth: health,
      playerMaxHealth: 100,
      appliesFightPacing: false,
      talentEffects: { homesteadHealing: 2, healMultiplier: 2, overhealToBlockRatio: 1 },
      trinketEffects: { grovesFavorThornsOnHealthRestore: 1 },
    });
    const next = applyHealingWithCombatText(state, 3, texts, { allowOverhealBlock: true });
    expect(next.playerHealth).toBe(100);
    expect(texts.find((event) => event.kind === "heal")).toMatchObject({ amount: 10 });
    expect(next.playerStatuses.block - state.playerStatuses.block).toBe(10 - (100 - health));
    expect(next.playerStatuses.thorns - state.playerStatuses.thorns).toBe(health < 100 ? 1 : 0);
  });
});
