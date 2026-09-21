import { expect, it } from "vitest";
import { applyCardEffects, type CombatTextEvent } from "@/lib/battle";
import { resolveFollowUpHit } from "@/lib/battle/follow-up-hit-resolution";
import { applyBlockedAttackRetaliation } from "@/lib/battle/player-defensive-reactions";
import { makeTestCard, patchBattleState, seededRng } from "../../fixtures/battle";

it("finishes nested Archery hits before the parent payout without adding random draws", () => {
  const rng = seededRng(42);
  const state = patchBattleState({
    rng,
    enemyHealth: 24,
    enemyMaxHealth: 40,
    playerHealth: 10,
    playerMaxHealth: 30,
    playerStatuses: { forge: 2 },
    talentEffects: { archeryPlayTwiceChance: 100, physicalBleedDamageChance: 50, leechPoisonDamageChance: 50 },
    gearEffects: { goldOnKill: 2 },
  });
  const card = makeTestCard({
    tags: ["archery"],
    effects: [{ kind: "damage", damageType: "physical", amount: 6, lifesteal: true }],
  });
  const texts: CombatTextEvent[] = [];
  const result = applyCardEffects(state, card, texts, {
    manaAtStart: state.mana,
    enemyFreezeSkipTurnsAtStart: 0,
    origin: "played-card",
  });
  expect(result).toEqual({
    ...state,
    enemyHealth: 10,
    playerHealth: 16,
    playerStatuses: { ...state.playerStatuses, forge: 0 },
    enemyStatuses: { ...state.enemyStatuses, poison: 2 },
  });
  expect(texts).toEqual([
    { target: "player", kind: "heal", stat: "health", amount: 6 },
    { target: "enemy", kind: "damage", stat: "poison", amount: 2 },
    { target: "enemy", kind: "damage", stat: "physical", amount: 12 },
  ]);
  expect(rng()).toBe(0.3452291004359722);
});

it.each([0, 100])("preserves Holy retaliation reward timing for reflection percentage %s", (percentage) => {
  const rng = seededRng(42);
  const state = patchBattleState({
    rng,
    enemyHealth: 5,
    enemyMaxHealth: 20,
    playerHealth: 4,
    playerMaxHealth: 20,
    playerStatuses: { forge: 2 },
    talentEffects: {
      holyReflectionBlockLostPercent: percentage,
      holyOnAttackBlocked: 6,
      holyBurnChance: 100,
      forgeToHoly: true,
    },
    gearEffects: { healOnBurnEnemyDefeated: 3 },
    trinketEffects: { boneCharmHealOnKill: 2 },
  });
  const texts: CombatTextEvent[] = [];
  const result = applyBlockedAttackRetaliation(state, 6, texts, true);
  // Legacy retaliation sees the Burn it inflicts; reflection pays from pre-hit statuses.
  const reflected = percentage > 0;
  const damage = reflected ? 6 : 8;
  const healing = reflected ? 2 : 5;
  expect(result).toEqual({
    ...state,
    enemyHealth: 0,
    playerHealth: state.playerHealth + healing,
    playerStatuses: { ...state.playerStatuses, forge: reflected ? 2 : 1 },
    enemyStatuses: { ...state.enemyStatuses, burn: damage },
    flags: { ...state.flags, killRewardsPaid: true },
  });
  expect(texts).toEqual([
    { target: "enemy", kind: "damage", stat: "holy", amount: damage },
    { target: "player", kind: "heal", stat: "health", amount: healing },
  ]);
  expect(rng()).toBe(reflected ? 0.8677412511315197 : 0.25576734659262);
});

it("limits poisoned-target Armor piercing to a real card source", () => {
  const state = patchBattleState({
    rng: () => 0.99,
    enemyHealth: 20,
    enemyMaxHealth: 20,
    enemyMitigation: { armor: 4 },
    enemyStatuses: { poison: 1 },
    gearEffects: { poisonedAttacksPierce: 1 },
  });
  const card = makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 6 }] });
  expect(applyCardEffects(state, card, []).enemyHealth).toBe(14);
  expect(
    resolveFollowUpHit(state, { source: "player-follow-up", damageType: "physical", amount: 6 }, []).enemyHealth,
  ).toBe(18);
});
