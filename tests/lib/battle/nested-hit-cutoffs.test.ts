import { expect, it } from "vitest";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

it("stops a Physical hit's riders when its Bleed conversion draw suffers fatal retaliation", () => {
  const card = makeTestCard({ uid: 1, effects: [{ kind: "damage", damageType: "physical", amount: 5 }] });
  const state = patchBattleState({
    hand: [card],
    playerHealth: 1,
    deathsDoorUsed: true,
    enemyHealth: 30,
    enemyMaxHealth: 100,
    enemyStatuses: { bleed: 20 },
    currentEnemy: { traits: [{ id: "cinder-skin", title: "Cinder Skin", description: "" }] },
    flags: { nextHitCrit: true },
    talentEffects: { physicalBleedChance: 100, drawOnBleedDamageChance: 100 },
    gearEffects: { goldOnKill: 7 },
    rng: () => 0.99,
  });
  const resolution = playBattleCardResolved(
    { ...state, gearEffects: { ...state.gearEffects, physicalCritDetonatesBleed: 1 } },
    card.id,
    0,
  );
  const result = resolution.state;
  expect(result.playerHealth).toBe(0);
  expect(result.enemyHealth).toBe(17);
  expect(result.enemyStatuses.bleed).toBe(20);
  expect(result.gold).toBe(0);
  expect(resolution.combatTexts).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ target: "enemy", kind: "damage", stat: "physical", amount: 10 }),
    ]),
  );
  expect(state.enemyStatuses.bleed).toBe(20);
});
