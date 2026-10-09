import { describe, expect, it } from "vitest";
import { cardById } from "@/lib/game-data";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { resolveEnemyAttackHit } from "@/lib/battle/enemy-attack-hit";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { purgeOnePlayerBenefit } from "@/lib/battle/player-purge";
import { selectCombatSound } from "@/features/alchemy/run-loop/battle/combat-sound-selection";
import { getCombatImpactVisual, getCombatTextLeadingIcon } from "@/features/alchemy/shared/utils/battle";
import type { CombatTextEvent } from "@/lib/battle";
import { patchBattleState } from "../../fixtures/battle";

describe("status multiplication and resource feedback", () => {
  it.each([
    { benefit: true, winterborn: false, expected: 14 },
    { benefit: false, winterborn: true, expected: 9 },
  ])(
    "Cold Snap preserves attack-only bonuses and resistance under $benefit/$winterborn modifiers",
    ({ benefit, winterborn, expected }) => {
      const state = patchBattleState({
        enemyHealth: 100,
        enemyMaxHealth: 100,
        enemyStatuses: { freeze: 5 },
        encounterBenefits: benefit ? ["bitter-cold"] : [],
        currentEnemy: { traits: winterborn ? [{ id: "winterborn", title: "Winterborn", description: "" }] : [] },
        rng: () => 0.99,
      });
      const texts: CombatTextEvent[] = [];
      const next = applyCardEffects(state, cardById["cold-snap"]!, texts);
      expect(next.enemyStatuses.freeze).toBe(expected);
      expect(next.enemyCC.freezeSkipTurns).toBe(0);
      expect(texts).toContainEqual({ target: "enemy", kind: "multiply", stat: "freeze", amount: winterborn ? 3 : 7 });
      expect(state.enemyStatuses.freeze).toBe(5);
    },
  );

  it("Cold Snap's multiplication can trigger Freeze and its Block reward while immunity prevents further buildup", () => {
    const state = patchBattleState({
      enemyHealth: 20,
      enemyMaxHealth: 20,
      enemyStatuses: { freeze: 4 },
      talentEffects: { blockOnFreeze: 3 },
      rng: () => 0.99,
    });
    const next = applyCardEffects(state, cardById["cold-snap"]!, []);
    expect(next.enemyCC.freezeSkipTurns).toBeGreaterThan(0);
    expect(next.enemyStatuses.freeze).toBe(0);
    expect(next.playerStatuses.block).toBe(3);
    const immune = { ...state, enemyCC: { ...state.enemyCC, cooldown: 2 } };
    const prevented = applyCardEffects(immune, cardById["cold-snap"]!, []);
    expect(prevented.enemyCC).toEqual(immune.enemyCC);
    expect(prevented.enemyStatuses.freeze).toBe(4);
    expect(prevented.playerStatuses.block).toBe(0);
  });

  it("Mana Shield reports only the remaining Mana it converts without a damage impact", () => {
    const card = cardById["mana-shield"]!;
    const state = patchBattleState({ mana: 4, hand: [card] });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.mana).toBe(0);
    expect(result.state.playerStatuses.block).toBe(12);
    const spent = { target: "player", kind: "damage", stat: "mana", amount: 4 - card.cost, impact: false } as const;
    expect(result.combatTexts).toContainEqual(spent);
    expect(getCombatImpactVisual(spent)).toBeNull();
  });
});

describe("Block depletion outside enemy hits", () => {
  it.each(["decay", "dodge", "purge"] as const)(
    "Second Wind and Resolute pay matching healing on %s depletion",
    (source) => {
      const state = patchBattleState({
        playerHealth: 10,
        playerMaxHealth: 30,
        playerStatuses: { block: 1 },
        talentEffects: { blockDepletedHeal: 2 },
        gearEffects: { blockDepletedHeal: 3, dodgeSpendsPreservedBlock: source === "dodge" ? 1 : 0 },
        flags: { dodgeNextAttack: true },
        rng: () => 0.99,
      });
      const texts: CombatTextEvent[] = [];
      const next =
        source === "decay"
          ? advanceToPlayerTurn(state, texts)
          : source === "purge"
            ? purgeOnePlayerBenefit(state, texts).state
            : resolveEnemyAttackHit(state, { kind: "damage", damageType: "physical", amount: 4 }, texts, {
                canDodge: true,
              }).state;
      expect(next.playerStatuses.block).toBe(0);
      expect(next.playerHealth).toBe(15);
      expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 5 });
    },
  );

  it.each(["decay", "dodge", "purge"] as const)("Briarward grants Thorns on %s depletion", (source) => {
    const state = patchBattleState({
      playerStatuses: { block: 1 },
      gearEffects: { thornsOnBlockDepleted: 3, dodgeSpendsPreservedBlock: source === "dodge" ? 1 : 0 },
      flags: { dodgeNextAttack: true },
      rng: () => 0.99,
    });
    const texts: CombatTextEvent[] = [];
    const next =
      source === "decay"
        ? advanceToPlayerTurn(state, texts)
        : source === "purge"
          ? purgeOnePlayerBenefit(state, texts).state
          : resolveEnemyAttackHit(state, { kind: "damage", damageType: "physical", amount: 4 }, texts, {
              canDodge: true,
            }).state;
    expect(next.playerStatuses.block).toBe(0);
    expect(next.playerStatuses.thorns).toBe(3);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "thorns", amount: 3 });
  });

  it("partial depletion and Winter's Credit payment cannot pay depletion rewards", () => {
    const card = cardById.frostbolt!;
    const state = patchBattleState({
      hand: [card],
      mana: 0,
      playerHealth: 10,
      playerMaxHealth: 30,
      playerStatuses: { block: 3 },
      talentEffects: { blockDepletedHeal: 2, forgeOnBlockDepleted: 1 },
      gearEffects: { thornsOnBlockDepleted: 3, blockPaysFreezeMana: 1 },
      rng: () => 0.99,
    });
    const partial = advanceToPlayerTurn(state);
    expect(partial.playerStatuses.block).toBe(2);
    expect(partial.playerHealth).toBe(10);
    expect(partial.playerStatuses.thorns).toBe(0);
    const paid = playBattleCardResolved(state, card.id, 0).state;
    expect(paid.playerStatuses.block).toBe(0);
    expect(paid.playerHealth).toBe(10);
    expect(paid.playerStatuses).toMatchObject({ forge: 0, thorns: 0 });
  });

  it("fatal retaliation from depletion healing stops Laughing Guard's counterattack", () => {
    const state = patchBattleState({
      playerHealth: 1,
      playerMaxHealth: 30,
      playerStatuses: { block: 1 },
      enemyHealth: 100,
      enemyMaxHealth: 100,
      roomScalingMultiplier: 4,
      currentEnemy: {
        traits: [
          { id: "blood-countess", title: "Profane Blood", description: "" },
          { id: "cinder-skin", title: "Cinder Skin", description: "" },
        ],
      },
      deathsDoorUsed: true,
      talentEffects: { blockDepletedHeal: 2 },
      gearEffects: { dodgeSpendsPreservedBlock: 1 },
      flags: { dodgeNextAttack: true },
      rng: () => 0.99,
    });
    const next = resolveEnemyAttackHit(state, { kind: "damage", damageType: "physical", amount: 4 }, [], {
      canDodge: true,
    }).state;
    expect(next.playerHealth).toBe(0);
    expect(next.enemyHealth).toBe(99);
  });
});

describe("player control immunity feedback", () => {
  it.each(["stun", "freeze"] as const)("explains blocked %s buildup while preserving Health damage", (damageType) => {
    const state = patchBattleState({ playerCC: { cooldown: 2 }, rng: () => 0.99 });
    const texts: CombatTextEvent[] = [];
    const next = resolveEnemyAttackHit(state, { kind: "damage", damageType, amount: 3 }, texts, {
      canDodge: true,
    }).state;
    expect(next.playerHealth).toBe(state.playerHealth - 3);
    expect(next.playerStatuses[damageType]).toBe(0);
    expect(next.playerCC).toEqual(state.playerCC);
    const notice = texts.find((event) => event.kind === "notice" && event.signal === "immune");
    expect(notice).toMatchObject({ target: "player", stat: damageType, signal: "immune" });
    expect(notice && getCombatTextLeadingIcon(notice)).toBeDefined();
    expect(selectCombatSound(notice ? [notice] : [], false)).toBeUndefined();
    const blockedTexts: CombatTextEvent[] = [];
    resolveEnemyAttackHit(
      { ...state, playerStatuses: { ...state.playerStatuses, block: 10 } },
      { kind: "damage", damageType, amount: 3 },
      blockedTexts,
      { canDodge: true },
    );
    expect(blockedTexts.some((event) => event.kind === "notice" && event.signal === "immune")).toBe(false);
  });
});
