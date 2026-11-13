import { makeDamageCard } from "../../fixtures/cards";
import { describe, expect, it } from "vitest";
import { resolveBattleStart } from "@/lib/battle/battle-start";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { applyEmergencyWishForEmptyDraw } from "@/lib/battle/wish";
import { resolvePendingBattleReactions } from "@/lib/battle/enemy-attack-damage";
import { makeTestCard, regressionBattle } from "../../fixtures/battle";

const cinder = { id: "cinder-skin", title: "Cinder Skin", description: "" };
const onEmptyDraw = (
  state: Parameters<typeof applyEmergencyWishForEmptyDraw>[0],
  amount: number,
  texts: Parameters<typeof applyEmergencyWishForEmptyDraw>[2],
) => resolvePendingBattleReactions(applyEmergencyWishForEmptyDraw(state, amount, texts), texts);

describe("nested combat boundaries", () => {
  it("does not grant Icebreaker Forge after a fatal Bleed detonation", () => {
    const card = makeDamageCard("physical", 1, { cost: 0, tags: ["archery"] });
    const state = regressionBattle({
      playerHealth: 1,
      deathsDoorUsed: true,
      enemyHealth: 20,
      enemyMaxHealth: 100,
      currentEnemy: { traits: [cinder] },
      enemyStatuses: { bleed: 2 },
      enemyCC: { freezeSkipTurns: 1 },
      hand: [card],
      deck: [],
      discard: [],
      flags: { nextHitCrit: true },
      talentEffects: { drawOnBleedDamageChance: 100, forgeOnPhysicalVsFrozen: 1, forgeOnPhysicalVsFrozenChance: 100 },
      gearEffects: { archeryDetonateBleedPoison: 1 },
      onEmptyDraw,
      rng: () => 0.99,
    });
    const next = playBattleCardResolved(state, card.id, 0).state;
    expect(next.playerHealth).toBe(0);
    expect(next.playerStatuses.forge).toBe(0);
  });
  it("tracks enemy reactions triggered by opening gear", () => {
    const base = regressionBattle({ gearEffects: { startFreeze: 1 } });
    const opening = resolveBattleStart(
      {
        runDeck: [makeTestCard()],
        currentEnemy: { ...base.currentEnemy, traits: [cinder] },
        gearEffects: base.gearEffects,
        trackMetrics: true,
      },
      { rng: () => 0.99 },
    );
    expect(opening.startingTexts).toContainEqual(
      expect.objectContaining({ target: "player", kind: "damage", stat: "burn" }),
    );
    expect(opening.state.battleMetrics?.enemyAbilityActivations["cinder-skin"]).toBe(1);
  });

  it("retains opening healing and Freeze feedback", () => {
    const base = regressionBattle({ gearEffects: { startHeal: 3, startFreeze: 2 } });
    const opening = resolveBattleStart(
      {
        runDeck: [makeTestCard()],
        currentEnemy: { ...base.currentEnemy, traits: [] },
        playerHealth: 10,
        maxHealth: 30,
        gearEffects: base.gearEffects,
      },
      { rng: () => 0.99 },
    );
    expect(opening.startingTexts).toContainEqual(
      expect.objectContaining({ target: "player", kind: "heal", stat: "health" }),
    );
    expect(opening.startingTexts).toContainEqual(
      expect.objectContaining({ target: "enemy", kind: "damage", stat: "freeze" }),
    );
  });

  it("retains feedback from the opening empty-deck Wish", () => {
    const base = regressionBattle({ gearEffects: { goldOnWish: 2 } });
    const opening = resolveBattleStart(
      { runDeck: [], currentEnemy: { ...base.currentEnemy, traits: [] }, gearEffects: base.gearEffects },
      { rng: () => 0 },
    );
    expect(opening.state.gold).toBeGreaterThan(0);
    expect(opening.openingDrawTexts).toContainEqual(expect.objectContaining({ target: "player", stat: "gold" }));
  });
});
