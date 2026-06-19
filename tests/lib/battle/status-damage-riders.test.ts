import { describe, expect, it } from "vitest";
import { applyDamageStatuses, applyPoisonTalentRiders } from "@/lib/battle/status-damage-riders";
import type { CombatTextEvent } from "@/lib/battle/types";
import { createTestBattleState, seededRng } from "./test-state";
import {
  defaultEnemyStatusValues,
  defaultEnemyMitigation,
  defaultTalentEffects,
  defaultTrinketManifest,
  defaultCcState,
  defaultCombatFlags,
} from "../../fixtures/default-battle-state";

function makeTexts(): CombatTextEvent[] {
  return [];
}
describe("applyDamageStatuses", () => {
  it("burn adds to enemy burn stack", () => {
    const state = createTestBattleState();
    const effect = { kind: "damage" as const, damageType: "burn" as const, amount: 5 };
    const result = applyDamageStatuses(state, effect, 7, []);
    expect(result.enemyStatuses.burn).toBe(7);
  });

  it("burn removes enemy armor with burnRemovesEnemyArmor", () => {
    const state = createTestBattleState({
      enemyMitigation: defaultEnemyMitigation({ armor: 5, forge: 0, freezeBonus: 0 }),
      talentEffects: { ...defaultTalentEffects, ...createTestBattleState().talentEffects, burnRemovesEnemyArmor: true },
    });
    const effect = { kind: "damage" as const, damageType: "burn" as const, amount: 5 };
    const result = applyDamageStatuses(state, effect, 3, []);
    expect(result.enemyMitigation.armor).toBe(2);
  });

  it("burn removes armor but not below 0", () => {
    const state = createTestBattleState({
      enemyMitigation: defaultEnemyMitigation({ armor: 2, forge: 0, freezeBonus: 0 }),
      talentEffects: { ...defaultTalentEffects, ...createTestBattleState().talentEffects, burnRemovesEnemyArmor: true },
    });
    const effect = { kind: "damage" as const, damageType: "burn" as const, amount: 5 };
    const result = applyDamageStatuses(state, effect, 5, []);
    expect(result.enemyMitigation.armor).toBe(0);
  });

  it("poison adds to enemy poison stack", () => {
    const state = createTestBattleState();
    const effect = { kind: "damage" as const, damageType: "poison" as const, amount: 3 };
    const result = applyDamageStatuses(state, effect, 4, []);
    expect(result.enemyStatuses.poison).toBe(4);
  });

  it("poison grants goldOnFirstPoison on first hit", () => {
    const state = createTestBattleState({
      talentEffects: { ...defaultTalentEffects, ...createTestBattleState().talentEffects, goldOnFirstPoison: 8 },
    });
    const effect = { kind: "damage" as const, damageType: "poison" as const, amount: 3 };
    const texts = makeTexts();
    const result = applyDamageStatuses(state, effect, 3, texts);
    expect(result.gold).toBe(8);
    expect(result.flags.goldOnFirstPoisonThisCombat).toBe(true);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "gold", amount: 8 });
  });

  it("poison grants goldOnFirstPoison only once", () => {
    const state = createTestBattleState({
      gold: 10,
      talentEffects: { ...defaultTalentEffects, ...createTestBattleState().talentEffects, goldOnFirstPoison: 8 },
      flags: defaultCombatFlags({ ...createTestBattleState().flags, goldOnFirstPoisonThisCombat: true }),
    });
    const effect = { kind: "damage" as const, damageType: "poison" as const, amount: 3 };
    const result = applyDamageStatuses(state, effect, 3, []);
    expect(result.gold).toBe(10);
  });

  it("bleed adds 2x status to bleed stack", () => {
    const state = createTestBattleState();
    const effect = { kind: "damage" as const, damageType: "bleed" as const, amount: 5 };
    const result = applyDamageStatuses(state, effect, 5, []);
    expect(result.enemyStatuses.bleed).toBe(10);
  });

  it("bleed with lifesteal adds pending bleed leech healing", () => {
    const state = createTestBattleState();
    const effect = { kind: "damage" as const, damageType: "bleed" as const, amount: 5, lifesteal: true };
    const result = applyDamageStatuses(state, effect, 5, []);
    expect(result.pendingBleedLeechHealing).toBe(10);
  });

  it("cutpurseGoldOnBleed grants gold on bleed", () => {
    const state = createTestBattleState({
      trinketEffects: defaultTrinketManifest({ ...createTestBattleState().trinketEffects, cutpurseGoldOnBleed: 2 }),
    });
    const effect = { kind: "damage" as const, damageType: "bleed" as const, amount: 5 };
    const texts = makeTexts();
    const result = applyDamageStatuses(state, effect, 5, texts);
    expect(result.gold).toBe(2);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "gold", amount: 2 });
  });

  it("stun adds to stun stack and triggers resolveStunTrigger", () => {
    const base = createTestBattleState();
    const state = {
      ...base,
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ stunSkipTurns: 0 }),
      enemyStatuses: defaultEnemyStatusValues({ ...base.enemyStatuses, stun: 15 }),
    };
    const effect = { kind: "damage" as const, damageType: "stun" as const, amount: 5 };
    const texts = makeTexts();
    const result = applyDamageStatuses(state, effect, 5, texts);
    expect(result.enemyStatuses.stun).toBe(0);
    expect(result.enemyCC.stunSkipTurns).toBe(1);
    expect(texts).toContainEqual({ target: "enemy", kind: "notice", stat: "stun", text: "Stunned" });
  });

  it("freeze adds to freeze stack", () => {
    const state = createTestBattleState();
    const effect = { kind: "damage" as const, damageType: "freeze" as const, amount: 3 };
    const result = applyDamageStatuses(state, effect, 3, []);
    expect(result.enemyStatuses.freeze).toBe(3);
  });

  it("freeze triggers skip when above threshold", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ ...createTestBattleState().enemyStatuses, freeze: 15 }),
    });
    const effect = { kind: "damage" as const, damageType: "freeze" as const, amount: 10 };
    const texts = makeTexts();
    const result = applyDamageStatuses(state, effect, 10, texts);
    expect(result.enemyStatuses.freeze).toBe(0);
    expect(result.enemyCC.freezeSkipTurns).toBe(1);
    expect(texts).toContainEqual({ target: "enemy", kind: "notice", stat: "freeze", text: "Frozen" });
  });

  it("freeze skip adds freezeDurationExtension", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ ...createTestBattleState().enemyStatuses, freeze: 15 }),
      trinketEffects: defaultTrinketManifest({ ...createTestBattleState().trinketEffects, freezeDurationExtension: 2 }),
    });
    const effect = { kind: "damage" as const, damageType: "freeze" as const, amount: 10 };
    const result = applyDamageStatuses(state, effect, 10, []);
    expect(result.enemyCC.freezeSkipTurns).toBe(3);
  });

  it("freeze triggers frozenHeartDamage on skip", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ ...createTestBattleState().enemyStatuses, freeze: 15 }),
      trinketEffects: defaultTrinketManifest({ ...createTestBattleState().trinketEffects, frozenHeartDamage: 6 }),
    });
    const effect = { kind: "damage" as const, damageType: "freeze" as const, amount: 10 };
    const texts = makeTexts();
    const result = applyDamageStatuses(state, effect, 10, texts);
    expect(result.enemyHealth).toBe(24);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "physical", amount: 6 });
  });

  it("freeze CC immunity suppresses second freeze trigger within cooldown", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ cooldown: 0 }),
      enemyStatuses: defaultEnemyStatusValues({ ...createTestBattleState().enemyStatuses, freeze: 15 }),
    });
    const effect = { kind: "damage" as const, damageType: "freeze" as const, amount: 10 };
    const texts = makeTexts();
    const result = applyDamageStatuses(state, effect, 10, texts);
    expect(result.enemyCC.freezeSkipTurns).toBe(1);
    expect(result.enemyCC.cooldown).toBe(2);

    // Second trigger with cooldown: clear freeze but no extra skip.
    const state2 = {
      ...result,
      enemyCC: defaultCcState({ ...result.enemyCC, cooldown: 1 }),
      enemyStatuses: defaultEnemyStatusValues({ ...result.enemyStatuses, freeze: 15 }),
    };
    const result2 = applyDamageStatuses(state2, effect, 10, []);
    expect(result2.enemyCC.freezeSkipTurns).toBe(1); // unchanged
    expect(result2.enemyStatuses.freeze).toBe(0);
  });

  it("freeze triggers on glacial-shell enemies when threshold is met", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ ...createTestBattleState().enemyStatuses, freeze: 15 }),
      currentEnemy: {
        id: "ice-golem",
        title: "Ice Golem",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "normal",
        traits: [{ id: "glacial-shell", title: "Glacial Shell", description: "Receives half Freeze damage" }],
        attackEffects: [],
      },
    });
    const effect = { kind: "damage" as const, damageType: "freeze" as const, amount: 10 };
    const result = applyDamageStatuses(state, effect, 10, []);
    expect(result.enemyStatuses.freeze).toBe(0); // cleared on trigger
    expect(result.enemyCC.freezeSkipTurns).toBeGreaterThanOrEqual(1); // freeze triggers
  });
});

describe("zero-duration status edge cases", () => {
  it("applying 0 burn to enemy leaves status unchanged", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ ...createTestBattleState().enemyStatuses, burn: 5 }),
    });
    const effect = { kind: "damage" as const, damageType: "burn" as const, amount: 0 };
    const result = applyDamageStatuses(state, effect, 0, []);
    expect(result.enemyStatuses.burn).toBe(5);
  });

  it("applying 0 stun to enemy leaves stun unchanged", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ ...createTestBattleState().enemyStatuses, stun: 5 }),
    });
    const effect = { kind: "damage" as const, damageType: "stun" as const, amount: 0 };
    const result = applyDamageStatuses(state, effect, 0, []);
    expect(result.enemyStatuses.stun).toBe(5);
    expect(result.enemyCC.stunSkipTurns).toBe(0);
  });

  it("applying 0 freeze to enemy leaves freeze unchanged", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ ...createTestBattleState().enemyStatuses, freeze: 5 }),
    });
    const effect = { kind: "damage" as const, damageType: "freeze" as const, amount: 0 };
    const result = applyDamageStatuses(state, effect, 0, []);
    expect(result.enemyStatuses.freeze).toBe(5);
    expect(result.enemyCC.freezeSkipTurns).toBe(0);
  });

  it("applying 0 poison leaves poison stack unchanged", () => {
    const state = createTestBattleState({
      enemyStatuses: defaultEnemyStatusValues({ ...createTestBattleState().enemyStatuses, poison: 4 }),
    });
    const effect = { kind: "damage" as const, damageType: "poison" as const, amount: 0 };
    const result = applyDamageStatuses(state, effect, 0, []);
    expect(result.enemyStatuses.poison).toBe(4);
  });
});

describe("applyPoisonTalentRiders", () => {
  it("stuns enemy when poisonStunChance procs", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ ...createTestBattleState().enemyStatuses, stun: 16 }),
      talentEffects: { ...defaultTalentEffects, ...createTestBattleState().talentEffects, poisonStunChance: 100 },
      rng: () => 0,
    });
    const texts = makeTexts();
    const result = applyPoisonTalentRiders(state, 4, texts);
    expect(result.enemyCC.stunSkipTurns).toBeGreaterThan(0);
  });

  it("leeches health when poisonLeechChance procs", () => {
    const state = createTestBattleState({
      playerHealth: 18,
      enemyHealth: 30,
      talentEffects: { ...defaultTalentEffects, ...createTestBattleState().talentEffects, poisonLeechChance: 100 },
      rng: () => 0,
    });
    const texts = makeTexts();
    const result = applyPoisonTalentRiders(state, 5, texts);
    expect(result.playerHealth).toBe(21);
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 3 });
  });

  it("strips one armor when poisonStripArmor is active", () => {
    const state = createTestBattleState({
      enemyMitigation: defaultEnemyMitigation({ armor: 3, forge: 0, freezeBonus: 0 }),
      talentEffects: { ...defaultTalentEffects, ...createTestBattleState().talentEffects, poisonStripArmor: true },
      rng: seededRng(42),
    });
    const result = applyPoisonTalentRiders(state, 4, []);
    expect(result.enemyMitigation.armor).toBe(2);
  });
});

describe("applyDamageStatuses ï¿½ physical riders", () => {
  it("detonates bleed when physicalDetonatesBleed is active", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ ...createTestBattleState().enemyStatuses, bleed: 8 }),
      talentEffects: {
        ...defaultTalentEffects,
        ...createTestBattleState().talentEffects,
        physicalDetonatesBleed: true,
      },
      rng: seededRng(42),
    });
    const effect = { kind: "damage" as const, damageType: "physical" as const, amount: 5 };
    const texts = makeTexts();
    const result = applyDamageStatuses(state, effect, 5, texts);
    expect(result.enemyStatuses.bleed).toBe(0);
    expect(result.enemyHealth).toBe(22);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "bleed", amount: 8 });
  });

  it("physical stun chance procs at 100%", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ ...createTestBattleState().enemyStatuses, stun: 16 }),
      talentEffects: { ...defaultTalentEffects, ...createTestBattleState().talentEffects, physicalStunChance: 100 },
      rng: () => 0,
    });
    const effect = { kind: "damage" as const, damageType: "physical" as const, amount: 4 };
    const result = applyDamageStatuses(state, effect, 4, []);
    expect(result.enemyCC.stunSkipTurns).toBeGreaterThan(0);
  });
});

describe("applyDamageStatuses ï¿½ freeze threshold uses pre-hit health", () => {
  it("does not freeze when stacks are below pre-hit threshold", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ ...createTestBattleState().enemyStatuses, freeze: 0 }),
      rng: seededRng(42),
    });
    const effect = { kind: "damage" as const, damageType: "freeze" as const, amount: 6 };
    const result = applyDamageStatuses(state, effect, 6, []);
    expect(result.enemyStatuses.freeze).toBe(6);
    expect(result.enemyCC.freezeSkipTurns).toBe(0);
  });
});
