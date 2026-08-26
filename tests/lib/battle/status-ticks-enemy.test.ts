import { describe, expect, it } from "vitest";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import {
  defaultEnemyStatusValues,
  defaultTalentEffects,
  defaultTrinketManifest,
} from "../../fixtures/default-battle-state";
import { makeCombatTexts as makeTexts, makeTestBattleState, patchBattleState } from "../../fixtures/battle";

describe("tickEnemyStatuses", () => {
  it("deals burn damage and halves burn stack", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ burn: 10 }),
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyHealth).toBe(20);
    expect(next.enemyStatuses.burn).toBe(5);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "burn", amount: 10 });
  });

  it("fully clears enemy burn at 1 stack", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ burn: 1 }),
    });
    const next = tickEnemyStatuses(state, makeTexts());
    expect(next.enemyHealth).toBe(29);
    expect(next.enemyStatuses.burn).toBe(0);
  });

  it("deals poison damage and decays poison by 20% (minimum 1)", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ poison: 8 }),
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyHealth).toBe(22);
    expect(next.enemyStatuses.poison).toBe(6);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "poison", amount: 8 });
  });

  it("deals bleed damage equal to stack and resets bleed to 0", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ bleed: 6 }),
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyHealth).toBe(24);
    expect(next.enemyStatuses.bleed).toBe(0);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "bleed", amount: 6 });
  });

  it("heals player from pending bleed leech healing", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      playerHealth: 20,
      enemyStatuses: defaultEnemyStatusValues({ bleed: 6 }),
      pendingBleedLeechHealing: 3,
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.playerHealth).toBe(22);
    expect(next.pendingBleedLeechHealing).toBe(0);
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 2 });
  });

  it("scales pending bleed leech healing by leechHealBonusPercent", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      playerHealth: 20,
      playerMaxHealth: 40,
      enemyStatuses: defaultEnemyStatusValues({ bleed: 6 }),
      pendingBleedLeechHealing: 4,
      gearEffects: { ...makeTestBattleState().gearEffects, leechHealBonusPercent: 50 },
    });
    const texts = makeTexts();
    // computeLeechHeal(4) = 2, scaled by +50% -> 3.
    const next = tickEnemyStatuses(state, texts);
    expect(next.playerHealth).toBe(23);
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 3 });
  });

  it("caps pending bleed leech at the health the tick actually removed", () => {
    const state = patchBattleState({
      enemyHealth: 3,
      enemyMaxHealth: 30,
      playerHealth: 20,
      enemyStatuses: defaultEnemyStatusValues({ bleed: 6 }),
      pendingBleedLeechHealing: 10,
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyHealth).toBe(0);
    // Only 3 health was lost, so leech pays round(3 / 2) — not the queued round(10 / 2).
    expect(next.playerHealth).toBe(22);
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 2 });
  });

  it("skips tick when burn is 0", () => {
    const state = patchBattleState();
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyHealth).toBe(30);
    expect(texts).toEqual([]);
  });

  it("applies all DoTs in sequence", () => {
    const state = patchBattleState({
      enemyHealth: 50,
      enemyMaxHealth: 50,
      enemyStatuses: defaultEnemyStatusValues({ burn: 10, poison: 5, bleed: 8 }),
      pendingBleedLeechHealing: 2,
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyHealth).toBe(27);
    expect(next.enemyStatuses.burn).toBe(5);
    expect(next.enemyStatuses.poison).toBe(4);
    expect(next.enemyStatuses.bleed).toBe(0);
  });

  it("burnDoubleChance doubles burn when triggered", () => {
    const state = patchBattleState({
      enemyStatuses: defaultEnemyStatusValues({ burn: 10 }),
      talentEffects: { ...defaultTalentEffects, burnDoubleChance: 50 },
      rng: () => 0.01,
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyStatuses.burn).toBe(20);
  });

  it("poisonGainChance increases poison when triggered", () => {
    const state = patchBattleState({
      enemyStatuses: defaultEnemyStatusValues({ poison: 5 }),
      talentEffects: { ...defaultTalentEffects, poisonGainChance: 50 },
      rng: () => 0.01,
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyStatuses.poison).toBe(6);
  });

  it("parasiticBloomLeechChance heals player on poison tick", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      playerHealth: 20,
      enemyStatuses: defaultEnemyStatusValues({ poison: 8 }),
      trinketEffects: defaultTrinketManifest({ parasiticBloomLeechChance: 50 }),
      rng: () => 0.01,
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyHealth).toBe(22);
    expect(next.playerHealth).toBe(24);
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 4 });
  });

  it("clamps enemy health at 0", () => {
    const state = patchBattleState({
      enemyHealth: 3,
      enemyStatuses: defaultEnemyStatusValues({ burn: 10 }),
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyHealth).toBe(0);
  });

  it("applies resistance multiplier for burn", () => {
    const state = patchBattleState({
      enemyHealth: 50,
      enemyMaxHealth: 50,
      enemyStatuses: defaultEnemyStatusValues({ burn: 10 }),
      currentEnemy: {
        id: "fire-elemental",
        title: "Fire Elemental",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "normal",
        traits: [{ id: "burn-resistance", title: "Burn Resistance", description: "Half burn damage" }],
        attackEffects: [],
      },
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyHealth).toBe(45);
  });

  it("applies vulnerability multiplier for burn", () => {
    const state = patchBattleState({
      enemyHealth: 50,
      enemyMaxHealth: 50,
      enemyStatuses: defaultEnemyStatusValues({ burn: 10 }),
      currentEnemy: {
        id: "blight-treant",
        title: "The Blight Treant",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "boss",
        traits: [
          { id: "burn-vulnerability", title: "Burn Vulnerability", description: "Receives 50% more Burn damage" },
        ],
        attackEffects: [],
      },
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    // 10 burn damage * 1.5 (vulnerability multiplier) = 15 damage. Health: 50 -> 35.
    expect(next.enemyHealth).toBe(35);
  });

  it("applies resistance multiplier for bleed against living-armor", () => {
    const state = patchBattleState({
      enemyHealth: 50,
      enemyMaxHealth: 50,
      enemyStatuses: defaultEnemyStatusValues({ bleed: 10 }),
      currentEnemy: {
        id: "living-armor",
        title: "Living Armor",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "elite",
        traits: [{ id: "living-armor", title: "Living Armor", description: "Receives 25% less Bleed damage" }],
        attackEffects: [],
      },
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    // 10 bleed damage * 0.75 (resistance multiplier) = 8 damage. Health: 50 -> 42.
    expect(next.enemyHealth).toBe(42);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "bleed", amount: 8 });
  });
});

describe("DoT tick kills pay lethality payouts", () => {
  it("a lethal burn tick pays Bone Charm and gear rewards once", () => {
    const state = patchBattleState({
      enemyHealth: 5,
      playerHealth: 20,
      enemyStatuses: defaultEnemyStatusValues({ burn: 10 }),
      gearEffects: { ...makeTestBattleState().gearEffects, healOnKill: 3, goldOnKill: 4 },
      trinketEffects: defaultTrinketManifest({ boneCharmHealOnKill: 2 }),
    });
    const texts = makeTexts();
    const next = tickEnemyStatuses(state, texts);
    expect(next.enemyHealth).toBe(0);
    expect(next.playerHealth).toBe(25); // +2 bone charm, +3 heal-on-kill
    expect(next.gold).toBe(4);
  });

  it("a lethal burn tick still counts as defeated while burning", () => {
    const state = patchBattleState({
      // 1-stack burn is lethal here and decays to 0 after the tick; the payout
      // must run before that decay to see burn > 0.
      enemyHealth: 1,
      playerHealth: 20,
      enemyStatuses: defaultEnemyStatusValues({ burn: 1 }),
      gearEffects: { ...makeTestBattleState().gearEffects, healOnBurnEnemyDefeated: 6 },
    });
    const next = tickEnemyStatuses(state, makeTexts());
    expect(next.enemyHealth).toBe(0);
    expect(next.playerHealth).toBe(26);
  });

  it.each(["poison", "bleed"] as const)("a lethal %s tick pays the same rewards", (status) => {
    const state = patchBattleState({
      enemyHealth: 5,
      playerHealth: 20,
      enemyStatuses: defaultEnemyStatusValues({ [status]: 8 }),
      gearEffects: { ...makeTestBattleState().gearEffects, healOnKill: 3, goldOnKill: 4 },
      trinketEffects: defaultTrinketManifest({ boneCharmHealOnKill: 2 }),
    });
    const next = tickEnemyStatuses(state, makeTexts());
    expect(next.enemyHealth).toBe(0);
    expect(next.playerHealth).toBe(25);
    expect(next.gold).toBe(4);
  });

  it("does not double-pay when later DoTs tick an already-dead enemy", () => {
    const state = patchBattleState({
      enemyHealth: 5,
      playerHealth: 20,
      enemyMaxHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ burn: 10, poison: 8, bleed: 6 }),
      gearEffects: { ...makeTestBattleState().gearEffects, healOnKill: 3, goldOnKill: 4 },
      trinketEffects: defaultTrinketManifest({ boneCharmHealOnKill: 2 }),
    });
    const next = tickEnemyStatuses(state, makeTexts());
    expect(next.enemyHealth).toBe(0);
    expect(next.gold).toBe(4); // single goldOnKill payment
    expect(next.playerHealth).toBe(25); // +2 +3 paid once
  });
});
