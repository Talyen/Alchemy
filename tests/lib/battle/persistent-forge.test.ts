import { describe, expect, it, vi } from "vitest";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { addForgeToPlayer, rollForgeAffixAwards } from "@/lib/battle/status-player";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { createBattleStartState } from "@/lib/battle/battle-setup";
import { battleSnapshot } from "@/lib/battle/battle-snapshot";
import { purgeOnePlayerBenefit } from "@/lib/battle/player-purge";
import { computeCardDamageToEnemy } from "@/lib/battle/damage-calc";
import { cardById, computeTalentEffects, enemyById } from "@/lib/game-data";
import { effectsForAffixRolls, mergeGearEffectManifests } from "@/lib/gear";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";
import { createRunRngState, createRunStateRng } from "@/lib/rng";
import { battle, attack, play } from "../../fixtures/unique-gear-battle";
import type { CombatTextEvent } from "@/lib/battle/types";

describe("persistent Forge", () => {
  it("combines bonus Forge once and pays Smithguard once without pacing or recursion", () => {
    const rng = vi.fn(() => 0);
    const state = battle({
      rng,
      turn: 100,
      appliesFightPacing: true,
      playerHealth: 10,
      playerStatuses: { burn: 1 },
      talentEffects: { forgeBurningBonusChance: 25, forgeBonusChance: 10, forgeLowHealthBonusChance: 25 },
      gearEffects: { blockOnForgeGain: 2, forgeReadiesPhysicalRepeat: 1 },
    });
    const texts: CombatTextEvent[] = [];
    const next = addForgeToPlayer(state, 2, texts);
    expect(next.playerStatuses.forge).toBe(5);
    expect(next.uniqueGear.everkeenReady).toBe(true);
    expect(texts.filter((text) => text.stat === "forge")).toEqual([
      { target: "player", kind: "status", stat: "forge", amount: 5 },
    ]);
    expect(rng).toHaveBeenCalledTimes(3);
    expect(state.playerStatuses.forge).toBe(0);
  });

  it.each([0, 1, 2, 3, 6])("Burning Blade at %s Forge uses one rounded conversion and preserves Forge", (forge) => {
    const state = battle({
      playerStatuses: { forge },
      talentEffects: { forgeBurnDamagePercent: 100 },
      gearEffects: { flatBurnDamage: 2 },
    });
    const next = play(state, cardById["burning-blade"]!);
    expect(state.enemyHealth - next.enemyHealth).toBe(3 + Math.round(forge * 0.5));
    expect(next.playerStatuses.forge).toBe(forge);
  });

  it("retains duplicate affix probabilities and rolls copies independently in order", () => {
    const one = effectsForAffixRolls([{ id: "forge-on-stun", value: 50 }], "astral");
    const two = mergeGearEffectManifests(one, one);
    expect(one.forgeOnStunChances).toEqual([50]);
    expect(two.forgeOnStunChances).toEqual([50, 50]);
    const draws = [0.49, 0.5];
    const rng = vi.fn(() => draws.shift()!);
    expect(rollForgeAffixAwards(battle({ rng }), two.forgeOnStunChances)).toBe(1);
    expect(rng).toHaveBeenCalledTimes(2);
    expect(rollForgeAffixAwards(battle({ rng: () => 0.1 }), two.forgeOnStunChances)).toBe(2);
  });

  it("Icebreaker rolls once per attack action while repeated attacks can earn more", () => {
    const talents = computeTalentEffects({ physical: ["physical-shatter"] });
    const card = attack("physical", {
      effects: [
        { kind: "damage", damageType: "physical", amount: 1 },
        { kind: "damage", damageType: "physical", amount: 1 },
      ],
    });
    const state = battle({ rng: () => 0.1, talentEffects: talents, enemyCC: { freezeSkipTurns: 2 } });
    const first = applyCardEffects(state, card, []);
    expect(first.playerStatuses.forge).toBe(1);
    expect(applyCardEffects(first, card, []).playerStatuses.forge).toBe(2);
  });

  it("Sunder removes rounded half Forge once across multiple Physical packets", () => {
    const state = battle({
      playerStatuses: { forge: 3 },
      enemyMitigation: { armor: 20 },
      talentEffects: { physicalStripArmorByForge: true },
    });
    const card = attack("physical", {
      effects: [
        { kind: "damage", damageType: "physical", amount: 30 },
        { kind: "damage", damageType: "physical", amount: 30 },
      ],
    });
    const texts: CombatTextEvent[] = [];
    applyCardEffects(state, card, texts);
    expect(
      texts.filter(
        (text) => text.stat === "armor" && text.target === "enemy" && text.kind === "damage" && text.impact === false,
      ),
    ).toContainEqual({ target: "enemy", kind: "damage", stat: "armor", amount: 2, impact: false });
    expect(texts.filter((text) => text.stat === "armor" && "impact" in text && text.impact === false)).toHaveLength(1);
  });

  it("Oathkeeper grants one Block per damaging Holy attack and uses the stronger conversion", () => {
    const state = battle({
      playerStatuses: { forge: 4 },
      gearEffects: { oathkeeperHolyAndBlock: 1, goldGrantsForgeAndHoly: 1 },
      talentEffects: { forgeHolyDamagePercent: 25 },
    });
    const card = attack("holy", {
      effects: [
        { kind: "damage", damageType: "holy", amount: 1 },
        { kind: "damage", damageType: "holy", amount: 1 },
      ],
    });
    const next = applyCardEffects(state, card, []);
    expect(next.enemyHealth).toBe(994);
    expect(next.playerStatuses).toMatchObject({ forge: 4, block: 1 });
  });

  it("Purge removes every Forge stack and cannot reward Forged Bulwark", () => {
    const forged = battle({ playerStatuses: { forge: 20 }, talentEffects: { forgeOnBlockDepleted: 1 } });
    expect(purgeOnePlayerBenefit(forged, []).state.playerStatuses.forge).toBe(0);
    const blocked = battle({ playerStatuses: { block: 4 }, talentEffects: { forgeOnBlockDepleted: 1 } });
    expect(purgeOnePlayerBenefit(blocked, []).state.playerStatuses.forge).toBe(0);
  });

  it("Vanguard and Obsidian allowances survive reload and reset next turn", () => {
    const initial = battle({
      playerStatuses: { block: 100, forge: 5 },
      trinketEffects: { vanguardCrestForgeOnBlockAbsorb: 1, forgeStunThreshold: 5, forgeStunAmount: 2 },
    });
    const blocked = applyEnemyAbility(initial, attack("physical"), []);
    const second = applyEnemyAbility(blocked, attack("physical"), []);
    expect(second.playerStatuses.forge).toBe(6);
    const hit = play(second, attack("physical"));
    const loaded = PersistedBattleStateSchema.parse(JSON.parse(JSON.stringify(hit)));
    expect(loaded.flags).toMatchObject({ vanguardCrestUsedThisTurn: true, obsidianHammerUsedThisTurn: true });
    const again = play({ ...loaded, rng: () => 0.99 }, attack("physical"));
    expect(again.enemyStatuses.stun).toBe(hit.enemyStatuses.stun);
    const nextTurn = advanceToPlayerTurn(again);
    expect(nextTurn.flags).toMatchObject({ vanguardCrestUsedThisTurn: false, obsidianHammerUsedThisTurn: false });
  });

  it("Patient Edge grants on turns 3 and 6 without spending debt", () => {
    let state = battle({ gearEffects: { forgeEveryThreeTurns: 1 }, playerStatuses: { forge: 5 } });
    const observed = [];
    for (let turn = 2; turn <= 6; turn++) {
      state = advanceToPlayerTurn(state);
      observed.push([state.turn, state.playerStatuses.forge]);
    }
    expect(observed).toEqual([
      [2, 5],
      [3, 6],
      [4, 6],
      [5, 6],
      [6, 7],
    ]);
  });

  it("White Heat grants opening Forge rather than a preservation permission", () => {
    const state = createBattleStartState({
      currentEnemy: enemyById.skeleton!,
      runDeck: [],
      encounterBenefits: ["white-heat"],
      contentSystemType: "labyrinth",
      rng: () => 0.99,
    });
    expect(state.playerStatuses.forge).toBe(2);
  });

  it("new-format Forge lists and readiness replay identically with saved world RNG", () => {
    const world = createRunRngState(451);
    const state = battle({
      currentEnemy: enemyById.skeleton!,
      rng: createRunStateRng(world, "world"),
      gearEffects: { forgeOnBurnVsUnburnedChances: [20, 20], forgeReadiesPhysicalRepeat: 1, blockOnForgeGain: 2 },
      talentEffects: { forgeBonusChance: 10 },
      uniqueGear: { everkeenReady: true },
    });
    const saved = JSON.parse(JSON.stringify({ battle: battleSnapshot(state), world }));
    const restored = PersistedBattleStateSchema.parse(saved.battle);
    const card = cardById.fireball!;
    const direct = applyCardEffects(state, card, []);
    const resumed = applyCardEffects({ ...restored, rng: createRunStateRng(saved.world, "world") }, card, []);
    expect(battleSnapshot(resumed)).toEqual(battleSnapshot(direct));
    expect(saved.world).toEqual(world);
  });

  it("Last Supper can reward successive last-card Consumes in the same turn", () => {
    const talents = computeTalentEffects({ consume: ["consume-last-supper"] });
    const first = play(battle({ talentEffects: talents }), cardById.bread!);
    const second = play(first, cardById.bread!);
    expect(second.turn).toBe(first.turn);
    expect(second.playerStatuses.forge).toBe(2);
  });

  it("duplicate Tempered and Smithguard copies contribute their full flat rewards", () => {
    const gearEffects = effectsForAffixRolls(
      [
        { id: "start-forge", value: 2 },
        { id: "start-forge", value: 2 },
        { id: "block-on-last-forge-spent", value: 2 },
        { id: "block-on-last-forge-spent", value: 2 },
      ],
      "astral",
    );
    expect(gearEffects.startForge).toBe(4);
    expect(gearEffects.blockOnForgeGain).toBe(4);
    const next = addForgeToPlayer(
      battle({ gearEffects, playerStatuses: { forge: 4 }, talentEffects: { forgeBlockPercent: 25 } }),
      1,
    );
    expect(next.playerStatuses).toMatchObject({ forge: 5, block: 5 });
  });

  it("damage ramp retains the 3x cap while Forge grants stay authored", () => {
    const state = battle({ appliesFightPacing: true, turn: 1000 });
    expect(addForgeToPlayer(state, 2).playerStatuses.forge).toBe(2);
    const effect = { kind: "damage" as const, damageType: "physical" as const, amount: 10 };
    expect(computeCardDamageToEnemy(state, effect).modifiedDamage).toBe(
      computeCardDamageToEnemy({ ...state, turn: 100 }, effect).modifiedDamage,
    );
  });
});
