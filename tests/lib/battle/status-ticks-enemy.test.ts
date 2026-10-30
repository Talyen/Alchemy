import { describe, expect, it } from "vitest";
import { detonateEnemyStatuses } from "@/lib/battle/dot-resolve";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { makeCombatTexts, patchBattleState, type BattleStatePatch } from "../../fixtures/battle";

function tick(patch: BattleStatePatch) {
  const texts = makeCombatTexts();
  return { next: tickEnemyStatuses(patchBattleState(patch), texts), texts };
}

describe("tickEnemyStatuses", () => {
  it.each([
    { burn: 0, healing: 2 },
    { burn: 4, healing: 0 },
  ])("caps Parasitic Bloom healing at Poison Health loss with $burn Burn", ({ burn, healing }) => {
    const { next } = tick({
      enemyHealth: 3,
      playerHealth: 20,
      enemyStatuses: { burn, poison: 8 },
      trinketEffects: { parasiticBloomLeechChance: 100 },
    });
    expect(next.enemyHealth).toBe(0);
    expect(next.playerHealth).toBe(20 + healing);
  });

  it.each([
    ["burn", 10, 5],
    ["burn", 1, 0],
    ["poison", 8, 6],
    ["bleed", 6, 0],
  ] as const)("deals %s %i damage and leaves %i stacks", (stat, amount, remaining) => {
    const { next, texts } = tick({ enemyStatuses: { [stat]: amount } });
    expect(next.enemyHealth).toBe(30 - amount);
    expect(next.enemyStatuses[stat]).toBe(remaining);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat, amount, periodic: true });
  });

  it.each([
    { name: "ordinary", enemyHealth: 30, pending: 3, bonus: 0, healing: 2 },
    { name: "Gear bonus", enemyHealth: 30, pending: 4, bonus: 50, healing: 3 },
    { name: "overkill cap", enemyHealth: 3, pending: 10, bonus: 0, healing: 2 },
  ])("settles deferred Bleed Leech with $name", ({ enemyHealth, pending, bonus, healing }) => {
    const { next, texts } = tick({
      enemyHealth,
      playerHealth: 20,
      enemyStatuses: { bleed: 6 },
      pendingBleedLeechHealing: pending,
      gearEffects: { leechHealBonusPercent: bonus },
    });
    expect(next.enemyHealth).toBe(Math.max(0, enemyHealth - 6));
    expect(next.playerHealth).toBe(20 + healing);
    expect(next.pendingBleedLeechHealing).toBe(0);
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: healing });
  });

  it("applies all DoTs in sequence", () => {
    const { next, texts } = tick({
      enemyHealth: 50,
      enemyMaxHealth: 50,
      enemyStatuses: { burn: 10, poison: 5, bleed: 8 },
      pendingBleedLeechHealing: 2,
    });
    expect(next.enemyHealth).toBe(18); // Burn 10, Poison 5, Bleed 8, Bloodboil 9.
    expect(next.enemyStatuses).toMatchObject({ burn: 5, poison: 4, bleed: 0 });
    expect(texts.filter((text) => text.target === "enemy" && text.kind === "damage").map((text) => text.stat)).toEqual([
      "burn",
      "poison",
      "bleed",
      "burn",
    ]);
  });

  it("prevents Burn decay when its talent roll succeeds", () => {
    const { next } = tick({
      enemyStatuses: { burn: 10 },
      talentEffects: { burnPreventDecayChance: 50 },
      rng: () => 0.01,
    });
    expect(next.enemyStatuses.burn).toBe(10);
  });

  it("increases Poison when its talent roll succeeds", () => {
    const { next } = tick({ enemyStatuses: { poison: 5 }, talentEffects: { poisonGainChance: 50 }, rng: () => 0.01 });
    expect(next.enemyStatuses.poison).toBe(6);
  });

  it("heals through Parasitic Bloom on a Poison tick", () => {
    const { next, texts } = tick({
      playerHealth: 20,
      enemyStatuses: { poison: 8 },
      trinketEffects: { parasiticBloomLeechChance: 50 },
      rng: () => 0.01,
    });
    expect(next.enemyHealth).toBe(22);
    expect(next.playerHealth).toBe(24);
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 4 });
  });

  it.each([
    { status: "burn", stacks: 40, trait: "burn-vulnerability", bonus: 25, frozen: 70, expected: 110 },
    { status: "bleed", stacks: 8, trait: "living-armor", bonus: 20, frozen: 50, expected: 18 },
  ] as const)(
    "uses the same rounded $status damage for ticks and detonations",
    ({ status, stacks, trait, bonus, frozen, expected }) => {
      const state = patchBattleState({
        playerHealth: 10,
        enemyHealth: 1000,
        enemyMaxHealth: 1000,
        enemyStatuses: { bleed: 1, [status]: stacks },
        enemyCC: { freezeSkipTurns: 1 },
        currentEnemy: { traits: [{ id: trait, title: trait, description: "" }] },
        gearEffects: {
          frozenEnemyDamageBonusPercent: frozen,
          burnDamageBonusToBleedingPercent: bonus,
          sharedBurnBleedBonuses: status === "bleed" ? 1 : 0,
        },
        talentEffects: { bleedDesperateMultiplier: 1.25 },
      });
      const tickTexts = makeCombatTexts();
      const detonationTexts = makeCombatTexts();
      tickEnemyStatuses(state, tickTexts);
      const detonated = detonateEnemyStatuses(state, [status], detonationTexts);
      expect(tickTexts).toContainEqual({
        target: "enemy",
        kind: "damage",
        stat: status,
        amount: expected,
        periodic: true,
      });
      expect(detonationTexts).toContainEqual({
        target: "enemy",
        kind: "damage",
        stat: status,
        amount: expected,
        detonation: true,
      });
      expect(detonated.enemyHealth).toBe(1000 - expected);
      expect(state.enemyStatuses[status]).toBe(stacks);
    },
  );
});

describe("DoT tick kills pay lethality payouts", () => {
  it.each(["burn", "poison", "bleed"] as const)("a lethal %s tick pays Bone Charm and Gear rewards once", (status) => {
    const { next } = tick({
      enemyHealth: 5,
      playerHealth: 20,
      enemyStatuses: { [status]: 8 },
      gearEffects: { healOnKill: 3, goldOnKill: 4 },
      trinketEffects: { boneCharmHealOnKill: 2 },
    });
    expect(next.enemyHealth).toBe(0);
    expect(next.playerHealth).toBe(25);
    expect(next.gold).toBe(4);
  });

  it("a lethal Burn tick still counts as defeated while burning", () => {
    const { next } = tick({
      enemyHealth: 1,
      playerHealth: 20,
      enemyStatuses: { burn: 1 },
      gearEffects: { healOnBurnEnemyDefeated: 6 },
    });
    expect(next.enemyHealth).toBe(0);
    expect(next.playerHealth).toBe(26);
  });

  it("does not double-pay when later DoTs tick an already-dead enemy", () => {
    const { next } = tick({
      enemyHealth: 5,
      playerHealth: 20,
      enemyStatuses: { burn: 10, poison: 8, bleed: 6 },
      gearEffects: { healOnKill: 3, goldOnKill: 4 },
      trinketEffects: { boneCharmHealOnKill: 2 },
    });
    expect(next.enemyHealth).toBe(0);
    expect(next.gold).toBe(4);
    expect(next.playerHealth).toBe(25);
  });
});
