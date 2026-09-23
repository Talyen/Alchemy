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

it("preserves Holy reflection reward timing and does not spend Forge", () => {
  const state = patchBattleState({
    enemyHealth: 5,
    enemyMaxHealth: 20,
    playerHealth: 4,
    playerMaxHealth: 20,
    playerStatuses: { forge: 2 },
    enemyStatuses: { burn: 1 },
    talentEffects: { holyReflectionBlockLostPercent: 100 },
    gearEffects: { healOnBurnEnemyDefeated: 3 },
    trinketEffects: { boneCharmHealOnKill: 2 },
  });
  const texts: CombatTextEvent[] = [];
  const result = applyBlockedAttackRetaliation(state, 6, texts, true);
  expect(result).toEqual({
    ...state,
    enemyHealth: 0,
    playerHealth: 9,
    flags: { ...state.flags, killRewardsPaid: true },
  });
  expect(texts).toEqual([
    { target: "enemy", kind: "damage", stat: "holy", amount: 6 },
    { target: "player", kind: "heal", stat: "health", amount: 5 },
  ]);
});

it("does not retaliate without Holy reflection", () => {
  const state = patchBattleState({ playerStatuses: { block: 6 } });
  const texts: CombatTextEvent[] = [];
  expect(applyBlockedAttackRetaliation(state, 6, texts, true)).toBe(state);
  expect(texts).toEqual([]);
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
