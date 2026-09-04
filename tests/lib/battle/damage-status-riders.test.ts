import { describe, expect, it } from "vitest";
import { applyDamageStatuses, applyPoisonTalentRiders } from "@/lib/battle/damage-status-riders";
import { applyDamageRiders } from "@/lib/battle/damage-riders";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { makeCombatTexts as makeTexts, makeTestBattleState, makeTestCard, seededRng } from "../../fixtures/battle";
import {
  defaultEnemyStatusValues,
  defaultEnemyMitigation,
  defaultTalentEffects,
  defaultTrinketManifest,
  defaultCcState,
  defaultCombatFlags,
} from "../../fixtures/default-battle-state";

describe("applyDamageStatuses", () => {
  it("burn adds to enemy burn stack", () => {
    const state = makeTestBattleState();
    const effect = { kind: "damage" as const, damageType: "burn" as const, amount: 5 };
    const result = applyDamageStatuses(state, effect, 7, []);
    expect(result.enemyStatuses.burn).toBe(7);
  });

  it("burn removes enemy armor with burnRemovesEnemyArmor", () => {
    const state = makeTestBattleState({
      enemyMitigation: defaultEnemyMitigation({ armor: 5, forge: 0 }),
      talentEffects: { ...defaultTalentEffects, ...makeTestBattleState().talentEffects, burnRemovesEnemyArmor: true },
    });
    const effect = { kind: "damage" as const, damageType: "burn" as const, amount: 5 };
    const result = applyDamageStatuses(state, effect, 3, []);
    expect(result.enemyMitigation.armor).toBe(2);
  });

  it("burn removes armor but not below 0", () => {
    const state = makeTestBattleState({
      enemyMitigation: defaultEnemyMitigation({ armor: 2, forge: 0 }),
      talentEffects: { ...defaultTalentEffects, ...makeTestBattleState().talentEffects, burnRemovesEnemyArmor: true },
    });
    const effect = { kind: "damage" as const, damageType: "burn" as const, amount: 5 };
    const result = applyDamageStatuses(state, effect, 5, []);
    expect(result.enemyMitigation.armor).toBe(0);
  });

  it("poison adds to enemy poison stack", () => {
    const state = makeTestBattleState();
    const effect = { kind: "damage" as const, damageType: "poison" as const, amount: 3 };
    const result = applyDamageStatuses(state, effect, 4, []);
    expect(result.enemyStatuses.poison).toBe(4);
  });

  it("poison grants goldOnFirstPoison on first hit", () => {
    const state = makeTestBattleState({
      talentEffects: { ...defaultTalentEffects, ...makeTestBattleState().talentEffects, goldOnFirstPoison: 8 },
    });
    const effect = { kind: "damage" as const, damageType: "poison" as const, amount: 3 };
    const texts = makeTexts();
    const result = applyDamageStatuses(state, effect, 3, texts);
    expect(result.gold).toBe(8);
    expect(result.flags.goldOnFirstPoisonThisCombat).toBe(true);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "gold", amount: 8 });
  });

  it("scales goldOnFirstPoison combat text with goldGainPercent", () => {
    const state = makeTestBattleState({
      talentEffects: { ...defaultTalentEffects, ...makeTestBattleState().talentEffects, goldOnFirstPoison: 8 },
      gearEffects: { ...makeTestBattleState().gearEffects, goldGainPercent: 50 },
    });
    const effect = { kind: "damage" as const, damageType: "poison" as const, amount: 3 };
    const texts = makeTexts();
    const result = applyDamageStatuses(state, effect, 3, texts);
    expect(result.gold).toBe(12);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "gold", amount: 12 });
  });

  it("poison grants goldOnFirstPoison only once", () => {
    const state = makeTestBattleState({
      gold: 10,
      talentEffects: { ...defaultTalentEffects, ...makeTestBattleState().talentEffects, goldOnFirstPoison: 8 },
      flags: defaultCombatFlags({ ...makeTestBattleState().flags, goldOnFirstPoisonThisCombat: true }),
    });
    const effect = { kind: "damage" as const, damageType: "poison" as const, amount: 3 };
    const result = applyDamageStatuses(state, effect, 3, []);
    expect(result.gold).toBe(10);
  });

  it("bleed adds status to bleed stack", () => {
    const state = makeTestBattleState();
    const effect = { kind: "damage" as const, damageType: "bleed" as const, amount: 5 };
    const result = applyDamageStatuses(state, effect, 5, []);
    expect(result.enemyStatuses.bleed).toBe(5);
  });

  it("bleed with lifesteal adds pending bleed leech healing", () => {
    const state = makeTestBattleState();
    const effect = { kind: "damage" as const, damageType: "bleed" as const, amount: 5, lifesteal: true };
    const result = applyDamageStatuses(state, effect, 5, []);
    expect(result.pendingBleedLeechHealing).toBe(5);
  });

  it("cutpurseGoldOnBleed grants gold on bleed", () => {
    const state = makeTestBattleState({
      trinketEffects: defaultTrinketManifest({ ...makeTestBattleState().trinketEffects, cutpurseGoldOnBleed: 2 }),
    });
    const effect = { kind: "damage" as const, damageType: "bleed" as const, amount: 5 };
    const texts = makeTexts();
    const result = applyDamageStatuses(state, effect, 5, texts);
    expect(result.gold).toBe(2);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "gold", amount: 2 });
  });

  it("scales cutpurseGoldOnBleed combat text with goldGainPercent", () => {
    const state = makeTestBattleState({
      trinketEffects: defaultTrinketManifest({ ...makeTestBattleState().trinketEffects, cutpurseGoldOnBleed: 2 }),
      gearEffects: { ...makeTestBattleState().gearEffects, goldGainPercent: 50 },
    });
    const effect = { kind: "damage" as const, damageType: "bleed" as const, amount: 5 };
    const texts = makeTexts();
    const result = applyDamageStatuses(state, effect, 5, texts);
    expect(result.gold).toBe(3);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "gold", amount: 3 });
  });

  it("stun adds to stun stack and triggers resolveStunTrigger", () => {
    const base = makeTestBattleState();
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
    const state = makeTestBattleState();
    const effect = { kind: "damage" as const, damageType: "freeze" as const, amount: 3 };
    const result = applyDamageStatuses(state, effect, 3, []);
    expect(result.enemyStatuses.freeze).toBe(3);
  });

  it("freeze triggers skip when above threshold", () => {
    const state = makeTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ ...makeTestBattleState().enemyStatuses, freeze: 15 }),
    });
    const effect = { kind: "damage" as const, damageType: "freeze" as const, amount: 10 };
    const texts = makeTexts();
    const result = applyDamageStatuses(state, effect, 10, texts);
    expect(result.enemyStatuses.freeze).toBe(0);
    expect(result.enemyCC.freezeSkipTurns).toBe(1);
    expect(texts).toContainEqual({ target: "enemy", kind: "notice", stat: "freeze", text: "Frozen" });
  });

  it("freeze skip adds freezeDurationExtension", () => {
    const state = makeTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ ...makeTestBattleState().enemyStatuses, freeze: 15 }),
      trinketEffects: defaultTrinketManifest({ ...makeTestBattleState().trinketEffects, freezeDurationExtension: 2 }),
    });
    const effect = { kind: "damage" as const, damageType: "freeze" as const, amount: 10 };
    const result = applyDamageStatuses(state, effect, 10, []);
    expect(result.enemyCC.freezeSkipTurns).toBe(3);
  });

  it("freeze triggers frozenHeartDamage on skip", () => {
    const state = makeTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ ...makeTestBattleState().enemyStatuses, freeze: 15 }),
      trinketEffects: defaultTrinketManifest({ ...makeTestBattleState().trinketEffects, frozenHeartDamage: 6 }),
    });
    const effect = { kind: "damage" as const, damageType: "freeze" as const, amount: 10 };
    const texts = makeTexts();
    const result = applyDamageStatuses(state, effect, 10, texts);
    expect(result.enemyHealth).toBe(24);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "physical", amount: 6 });
  });

  it("freeze CC immunity suppresses second freeze trigger within cooldown", () => {
    const state = makeTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ cooldown: 0 }),
      enemyStatuses: defaultEnemyStatusValues({ ...makeTestBattleState().enemyStatuses, freeze: 15 }),
    });
    const effect = { kind: "damage" as const, damageType: "freeze" as const, amount: 10 };
    const texts = makeTexts();
    const result = applyDamageStatuses(state, effect, 10, texts);
    expect(result.enemyCC.freezeSkipTurns).toBe(1);
    expect(result.enemyCC.cooldown).toBe(0);

    const state2 = {
      ...result,
      enemyCC: defaultCcState({ ...result.enemyCC, stunSkipTurns: 0, freezeSkipTurns: 0, cooldown: 2 }),
      enemyStatuses: defaultEnemyStatusValues({ ...result.enemyStatuses, freeze: 15 }),
    };
    const result2 = applyDamageStatuses(state2, effect, 10, []);
    expect(result2.enemyCC.freezeSkipTurns).toBe(0);
    expect(result2.enemyStatuses.freeze).toBe(0);
  });

  it("withholds freeze rewards when CC immunity clears the stack", () => {
    const state = makeTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ cooldown: 1 }),
      enemyStatuses: defaultEnemyStatusValues({ ...makeTestBattleState().enemyStatuses, freeze: 15 }),
      trinketEffects: defaultTrinketManifest({ ...makeTestBattleState().trinketEffects, frozenHeartDamage: 6 }),
    });
    const effect = { kind: "damage" as const, damageType: "freeze" as const, amount: 10 };
    const texts = makeTexts();
    const result = applyDamageStatuses(state, effect, 10, texts);
    expect(result.enemyStatuses.freeze).toBe(0);
    expect(result.enemyCC.freezeSkipTurns).toBe(0);
    expect(result.enemyHealth).toBe(30);
    expect(texts).not.toContainEqual({ target: "enemy", kind: "damage", stat: "physical", amount: 6 });
  });

  it("freeze triggers on glacial-shell enemies when threshold is met", () => {
    const state = makeTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ ...makeTestBattleState().enemyStatuses, freeze: 15 }),
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
    expect(result.enemyStatuses.freeze).toBe(0);
    expect(result.enemyCC.freezeSkipTurns).toBeGreaterThanOrEqual(1);
  });
});

describe("zero-duration status edge cases", () => {
  it("applying 0 burn to enemy leaves status unchanged", () => {
    const state = makeTestBattleState({
      enemyHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ ...makeTestBattleState().enemyStatuses, burn: 5 }),
    });
    const effect = { kind: "damage" as const, damageType: "burn" as const, amount: 0 };
    const result = applyDamageStatuses(state, effect, 0, []);
    expect(result.enemyStatuses.burn).toBe(5);
  });

  it("applying 0 stun to enemy leaves stun unchanged", () => {
    const state = makeTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ ...makeTestBattleState().enemyStatuses, stun: 5 }),
    });
    const effect = { kind: "damage" as const, damageType: "stun" as const, amount: 0 };
    const result = applyDamageStatuses(state, effect, 0, []);
    expect(result.enemyStatuses.stun).toBe(5);
    expect(result.enemyCC.stunSkipTurns).toBe(0);
  });

  it("applying 0 freeze to enemy leaves freeze unchanged", () => {
    const state = makeTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ ...makeTestBattleState().enemyStatuses, freeze: 5 }),
    });
    const effect = { kind: "damage" as const, damageType: "freeze" as const, amount: 0 };
    const result = applyDamageStatuses(state, effect, 0, []);
    expect(result.enemyStatuses.freeze).toBe(5);
    expect(result.enemyCC.freezeSkipTurns).toBe(0);
  });

  it("applying 0 poison leaves poison stack unchanged", () => {
    const state = makeTestBattleState({
      enemyStatuses: defaultEnemyStatusValues({ ...makeTestBattleState().enemyStatuses, poison: 4 }),
    });
    const effect = { kind: "damage" as const, damageType: "poison" as const, amount: 0 };
    const result = applyDamageStatuses(state, effect, 0, []);
    expect(result.enemyStatuses.poison).toBe(4);
  });
});

describe("poison and physical stun chance", () => {
  it("stuns enemy when poisonStunChance procs on a poison tick", () => {
    const state = makeTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({
        ...makeTestBattleState().enemyStatuses,
        poison: 4,
        stun: 16,
      }),
      talentEffects: { ...defaultTalentEffects, ...makeTestBattleState().talentEffects, poisonStunChance: 100 },
      rng: () => 0,
    });
    const texts = makeTexts();
    const result = tickEnemyStatuses(state, texts);
    expect(result.enemyCC.stunSkipTurns).toBeGreaterThan(0);
  });

  it("leeches health when poisonLeechChance procs", () => {
    const state = makeTestBattleState({
      playerHealth: 18,
      enemyHealth: 30,
      talentEffects: { ...defaultTalentEffects, ...makeTestBattleState().talentEffects, poisonLeechChance: 100 },
      rng: () => 0,
    });
    const texts = makeTexts();
    const result = applyPoisonTalentRiders(state, 5, texts);
    expect(result.playerHealth).toBe(21);
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 3 });
  });

  it("strips one armor when poisonStripArmor is active", () => {
    const state = makeTestBattleState({
      enemyMitigation: defaultEnemyMitigation({ armor: 3, forge: 0 }),
      talentEffects: { ...defaultTalentEffects, ...makeTestBattleState().talentEffects, poisonStripArmor: true },
      rng: seededRng(42),
    });
    const result = applyPoisonTalentRiders(state, 4, []);
    expect(result.enemyMitigation.armor).toBe(2);
  });
});

describe("applyDamageStatuses — physical riders", () => {
  it("detonates bleed when physicalDetonatesBleed is active", () => {
    const state = makeTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ ...makeTestBattleState().enemyStatuses, bleed: 8 }),
      talentEffects: {
        ...defaultTalentEffects,
        ...makeTestBattleState().talentEffects,
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

  it("a lethal detonation pays Bone Charm and gear kill rewards", () => {
    const state = makeTestBattleState({
      playerHealth: 20,
      playerMaxHealth: 30,
      enemyHealth: 5,
      enemyMaxHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ ...makeTestBattleState().enemyStatuses, bleed: 8 }),
      talentEffects: {
        ...defaultTalentEffects,
        ...makeTestBattleState().talentEffects,
        physicalDetonatesBleed: true,
      },
      gearEffects: { ...makeTestBattleState().gearEffects, goldOnKill: 4 },
      trinketEffects: defaultTrinketManifest({ boneCharmHealOnKill: 2 }),
      rng: seededRng(42),
    });
    const effect = { kind: "damage" as const, damageType: "physical" as const, amount: 5 };
    const result = applyDamageStatuses(state, effect, 5, makeTexts());
    expect(result.enemyHealth).toBe(0);
    expect(result.playerHealth).toBe(22);
    expect(result.gold).toBe(4);
  });

  it("detonation pays out queued bleed leech healing immediately", () => {
    const state = makeTestBattleState({
      playerHealth: 20,
      playerMaxHealth: 30,
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ ...makeTestBattleState().enemyStatuses, bleed: 8 }),
      pendingBleedLeechHealing: 16,
      talentEffects: {
        ...defaultTalentEffects,
        ...makeTestBattleState().talentEffects,
        physicalDetonatesBleed: true,
      },
      rng: seededRng(42),
    });
    const effect = { kind: "damage" as const, damageType: "physical" as const, amount: 5, lifesteal: true };
    const result = applyDamageStatuses(state, effect, 5, []);
    expect(result.enemyStatuses.bleed).toBe(0);

    expect(result.pendingBleedLeechHealing).toBe(0);

    expect(result.playerHealth).toBe(24);
  });

  it("caps detonation leech payout at the health actually lost", () => {
    const state = makeTestBattleState({
      playerHealth: 20,
      playerMaxHealth: 30,
      enemyHealth: 4,
      enemyMaxHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ ...makeTestBattleState().enemyStatuses, bleed: 8 }),
      pendingBleedLeechHealing: 16,
      talentEffects: {
        ...defaultTalentEffects,
        ...makeTestBattleState().talentEffects,
        physicalDetonatesBleed: true,
      },
      rng: seededRng(42),
    });
    const effect = { kind: "damage" as const, damageType: "physical" as const, amount: 5 };
    const result = applyDamageStatuses(state, effect, 5, []);
    expect(result.enemyHealth).toBe(0);

    expect(result.playerHealth).toBe(22);
  });

  it("detonation leech payout scales with leechHealBonusPercent", () => {
    const state = makeTestBattleState({
      playerHealth: 20,
      playerMaxHealth: 40,
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ ...makeTestBattleState().enemyStatuses, bleed: 8 }),
      pendingBleedLeechHealing: 4,
      gearEffects: { ...makeTestBattleState().gearEffects, leechHealBonusPercent: 50 },
      talentEffects: {
        ...defaultTalentEffects,
        ...makeTestBattleState().talentEffects,
        physicalDetonatesBleed: true,
      },
      rng: seededRng(42),
    });
    const effect = { kind: "damage" as const, damageType: "physical" as const, amount: 5 };
    const result = applyDamageStatuses(state, effect, 5, []);

    expect(result.playerHealth).toBe(23);
  });

  it("physical stun chance procs at 100%", () => {
    const state = makeTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ ...makeTestBattleState().enemyStatuses, stun: 16 }),
      talentEffects: { ...defaultTalentEffects, ...makeTestBattleState().talentEffects, physicalStunChance: 100 },
      rng: () => 0,
    });
    const effect = { kind: "damage" as const, damageType: "physical" as const, amount: 4 };
    const card = makeTestCard({ effects: [effect] });
    const result = applyDamageRiders(state, card, effect, 4, []);
    expect(result.enemyCC.stunSkipTurns).toBeGreaterThan(0);
  });
});

describe("applyDamageStatuses — freeze threshold uses pre-hit health", () => {
  it("does not freeze when stacks are below pre-hit threshold", () => {
    const state = makeTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ ...makeTestBattleState().enemyStatuses, freeze: 0 }),
      rng: seededRng(42),
    });
    const effect = { kind: "damage" as const, damageType: "freeze" as const, amount: 6 };
    const result = applyDamageStatuses(state, effect, 6, []);
    expect(result.enemyStatuses.freeze).toBe(6);
    expect(result.enemyCC.freezeSkipTurns).toBe(0);
  });
});
