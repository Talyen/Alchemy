import { describe, expect, it } from "vitest";
import { applyDamageStatuses, applyPoisonTalentRiders } from "@/lib/battle/damage-status-riders";
import { resolvePlayerHit } from "@/lib/battle/hit-resolution";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { makeTestCard, patchBattleState, type BattleStatePatch } from "../../fixtures/battle";
import type { CombatTextEvent } from "@/lib/battle/types";

describe("damage status riders", () => {
  it.each([0, 3, 4, 6])("Freeze restores Mana only from zero when starting with %i Mana", (mana) => {
    const state = patchBattleState({ mana, maxMana: 4, enemyHealth: 30, gearEffects: { freezeGrantsBlockAndMana: 1 } });
    const texts: CombatTextEvent[] = [];
    const result = applyDamageStatuses(state, { kind: "damage", damageType: "freeze", amount: 20 }, 20, texts);
    expect(result.enemyCC.freezeSkipTurns).toBeGreaterThan(0);
    expect(result.mana).toBe(mana === 0 ? 4 : mana);
    expect(texts.filter((text) => text.stat === "mana")).toEqual(
      mana === 0 ? [{ target: "player", kind: "status", stat: "mana", amount: 4 }] : [],
    );
  });

  it.each([
    [5, 3, 2],
    [2, 5, 0],
  ])("Burn removes Armor without going negative (%i Armor, %i damage)", (armor, damage, remaining) => {
    const state = patchBattleState({ enemyMitigation: { armor }, talentEffects: { burnRemovesEnemyArmor: true } });
    const result = applyDamageStatuses(state, { kind: "damage", damageType: "burn", amount: 5 }, damage, []);
    expect(result.enemyMitigation.armor).toBe(remaining);
  });

  it.each([
    ["poison", 0, 8],
    ["poison", 50, 12],
    ["bleed", 0, 2],
    ["bleed", 50, 3],
  ] as const)("%s rewards Gold and matching feedback with %i%% Gear scaling", (damageType, goldGainPercent, gold) => {
    const state = patchBattleState({
      talentEffects: { goldOnFirstPoison: 8 },
      trinketEffects: { cutpurseGoldOnBleed: 2 },
      gearEffects: { goldGainPercent },
    });
    const texts: CombatTextEvent[] = [];
    const result = applyDamageStatuses(state, { kind: "damage", damageType, amount: 3 }, 3, texts, state.enemyHealth, {
      critical: true,
    });
    expect(result.gold).toBe(gold);
    expect(result.flags.goldOnFirstPoisonThisCombat).toBe(damageType === "poison");
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "gold", amount: gold });
  });

  it("pays first-Poison Gold only once", () => {
    const state = patchBattleState({
      gold: 10,
      talentEffects: { goldOnFirstPoison: 8 },
      flags: { goldOnFirstPoisonThisCombat: true },
    });
    expect(applyDamageStatuses(state, { kind: "damage", damageType: "poison", amount: 3 }, 3, []).gold).toBe(10);
  });

  it("queues Bleed Leech healing for later ticks", () => {
    const state = patchBattleState();
    const result = applyDamageStatuses(
      state,
      { kind: "damage", damageType: "bleed", amount: 5, lifesteal: true },
      5,
      [],
    );
    expect(result.pendingBleedLeechHealing).toBe(5);
  });

  it("resolves Stun buildup and reports the resulting skipped turn", () => {
    const state = patchBattleState({ enemyHealth: 30, enemyMaxHealth: 30, enemyStatuses: { stun: 15 } });
    const texts: CombatTextEvent[] = [];
    const result = applyDamageStatuses(state, { kind: "damage", damageType: "stun", amount: 5 }, 5, texts);
    expect(result.enemyStatuses.stun).toBe(0);
    expect(result.enemyCC.stunSkipTurns).toBe(1);
    expect(texts).toContainEqual({ target: "enemy", kind: "notice", stat: "stun", text: "Stunned" });
  });

  it.each([
    { extension: 0, damage: 0, turns: 1, health: 30 },
    { extension: 2, damage: 0, turns: 3, health: 30 },
    { extension: 0, damage: 6, turns: 1, health: 24 },
  ])(
    "settles Freeze with $extension extra turns and $damage Frozen Heart damage",
    ({ extension, damage, turns, health }) => {
      const state = patchBattleState({
        enemyHealth: 30,
        enemyMaxHealth: 30,
        enemyStatuses: { freeze: 15 },
        trinketEffects: { freezeDurationExtension: extension, frozenHeartDamage: damage },
      });
      const texts: CombatTextEvent[] = [];
      const result = applyDamageStatuses(state, { kind: "damage", damageType: "freeze", amount: 10 }, 10, texts);
      expect(result.enemyStatuses.freeze).toBe(0);
      expect(result.enemyCC.freezeSkipTurns).toBe(turns);
      expect(result.enemyCC.cooldown).toBe(0);
      expect(result.enemyHealth).toBe(health);
      expect(texts).toContainEqual({ target: "enemy", kind: "notice", stat: "freeze", text: "Frozen" });
      if (damage) expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "physical", amount: damage });
    },
  );

  it.each([1, 2])("CC immunity clears Freeze and withholds its rewards at cooldown %i", (cooldown) => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCC: { cooldown },
      enemyStatuses: { freeze: 15 },
      trinketEffects: { frozenHeartDamage: 6 },
    });
    const texts: CombatTextEvent[] = [];
    const result = applyDamageStatuses(state, { kind: "damage", damageType: "freeze", amount: 10 }, 10, texts);
    expect(result.enemyStatuses.freeze).toBe(0);
    expect(result.enemyCC.freezeSkipTurns).toBe(0);
    expect(result.enemyCC.cooldown).toBe(cooldown);
    expect(result.enemyHealth).toBe(30);
    expect(texts).not.toContainEqual({ target: "enemy", kind: "damage", stat: "physical", amount: 6 });
  });

  it("still Freezes a Glacial Body enemy when its threshold is met", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: { freeze: 15 },
      currentEnemy: {
        traits: [{ id: "glacial-body", title: "Glacial Body", description: "Receives half Freeze damage" }],
      },
    });
    const result = applyDamageStatuses(state, { kind: "damage", damageType: "freeze", amount: 10 }, 10, []);
    expect(result.enemyStatuses.freeze).toBe(0);
    expect(result.enemyCC.freezeSkipTurns).toBeGreaterThanOrEqual(1);
  });

  it.each([
    ["burn", 5],
    ["stun", 5],
    ["freeze", 5],
    ["poison", 4],
  ] as const)("zero %s damage preserves its existing stacks without triggering CC", (damageType, amount) => {
    const state = patchBattleState({ enemyHealth: 30, enemyMaxHealth: 30, enemyStatuses: { [damageType]: amount } });
    const result = applyDamageStatuses(state, { kind: "damage", damageType, amount: 0 }, 0, []);
    expect(result.enemyStatuses).toEqual(state.enemyStatuses);
    expect(result.enemyCC).toEqual(state.enemyCC);
  });

  it("Poison ticks can trigger Stun", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: { poison: 4, stun: 16 },
      talentEffects: { poisonStunChance: 100 },
      rng: () => 0,
    });
    expect(tickEnemyStatuses(state, []).enemyCC.stunSkipTurns).toBeGreaterThan(0);
  });

  it("Poison Leech restores Health and reports the actual healing", () => {
    const state = patchBattleState({
      playerHealth: 18,
      enemyHealth: 30,
      talentEffects: { poisonLeechChance: 100 },
      rng: () => 0,
    });
    const texts: CombatTextEvent[] = [];
    expect(applyPoisonTalentRiders(state, 5, texts).playerHealth).toBe(21);
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 3 });
  });

  it("Poison strips one Armor with its matching talent", () => {
    const state = patchBattleState({ enemyMitigation: { armor: 3 }, talentEffects: { poisonStripArmor: true } });
    expect(applyPoisonTalentRiders(state, 4, []).enemyMitigation.armor).toBe(2);
  });

  it.each<{ name: string; patch: BattleStatePatch; health: number; enemyHealth: number; gold: number }>([
    { name: "ordinary detonation", patch: {}, health: 20, enemyHealth: 22, gold: 0 },
    {
      name: "lethal kill rewards",
      patch: { enemyHealth: 5, gearEffects: { goldOnKill: 4 }, trinketEffects: { boneCharmHealOnKill: 2 } },
      health: 22,
      enemyHealth: 0,
      gold: 4,
    },
    { name: "queued Leech", patch: { pendingBleedLeechHealing: 16 }, health: 24, enemyHealth: 22, gold: 0 },
    {
      name: "overkill Leech cap",
      patch: { enemyHealth: 4, pendingBleedLeechHealing: 16 },
      health: 22,
      enemyHealth: 0,
      gold: 0,
    },
    {
      name: "Gear Leech bonus",
      patch: { playerMaxHealth: 40, pendingBleedLeechHealing: 4, gearEffects: { leechHealBonusPercent: 50 } },
      health: 23,
      enemyHealth: 22,
      gold: 0,
    },
  ])("Physical critical hits settle $name once", ({ patch, health, enemyHealth, gold }) => {
    const state = patchBattleState({
      playerHealth: 20,
      playerMaxHealth: 30,
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: { bleed: 8 },
      talentEffects: { physicalDetonatesBleed: true },
      rng: () => 0.99,
      ...patch,
    });
    const texts: CombatTextEvent[] = [];
    const effect = { kind: "damage", damageType: "physical", amount: 5 } as const;
    const result = applyDamageStatuses(state, effect, 5, texts, state.enemyHealth, { critical: true });
    expect(result.enemyStatuses.bleed).toBe(0);
    expect(result.pendingBleedLeechHealing).toBe(0);
    expect(result.enemyHealth).toBe(enemyHealth);
    expect(result.playerHealth).toBe(health);
    expect(result.gold).toBe(gold);
    expect(texts).toContainEqual({
      target: "enemy",
      kind: "damage",
      stat: "bleed",
      amount: 8,
    });
    const repeated = applyDamageStatuses(result, effect, 5, [], result.enemyHealth, { critical: true });
    expect(repeated.playerHealth).toBe(health);
    expect(repeated.gold).toBe(gold);
  });

  it("Physical hits apply the 100% Stun chance", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: { stun: 16 },
      talentEffects: { physicalStunChance: 100 },
      rng: () => 0,
    });
    const effect = { kind: "damage", damageType: "physical", amount: 4 } as const;
    const result = resolvePlayerHit(
      state,
      { source: "card-attack", card: makeTestCard({ effects: [effect] }), effect, resolvedDamage: 4 },
      [],
    );
    expect(result.enemyCC.stunSkipTurns).toBeGreaterThan(0);
  });

  it("checks Freeze against pre-hit Health", () => {
    const state = patchBattleState({ enemyHealth: 30, enemyMaxHealth: 30 });
    const result = applyDamageStatuses(state, { kind: "damage", damageType: "freeze", amount: 6 }, 6, []);
    expect(result.enemyStatuses.freeze).toBe(6);
    expect(result.enemyCC.freezeSkipTurns).toBe(0);
  });
});
