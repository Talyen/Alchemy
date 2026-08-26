import { describe, expect, it } from "vitest";
import { createBattleState } from "@/lib/battle";
import {
  getPlayerStatusChips,
  getEnemyStatusChips,
  getCombatTextColorClass,
  getCombatImpactVisual,
  getCombatTextIcon,
  getBattleCardPlayTarget,
} from "@/features/alchemy/shared/utils/battle";
import { keywordIcons } from "@/features/alchemy/shared/config";
import { enemyBestiary, keywordDefinitions } from "@/lib/game-data";
import { makeTestCard } from "../../../../fixtures/battle";

const skeleton = enemyBestiary.find((enemy) => enemy.id === "skeleton")!;

function makeProductionBattleState() {
  return createBattleState({ runDeck: [makeTestCard()], currentEnemy: skeleton });
}

describe("getPlayerStatusChips", () => {
  it.each([null, undefined] as const)("returns empty array when state is %s", (state) => {
    expect(getPlayerStatusChips(state)).toEqual([]);
  });

  it("returns empty array when no statuses are active", () => {
    const state = makeProductionBattleState();
    expect(getPlayerStatusChips(state)).toEqual([]);
  });

  it("returns matching chips for active statuses", () => {
    const state = makeProductionBattleState();
    state.playerStatuses.block = 10;
    state.playerStatuses.burn = 3;
    const chips = getPlayerStatusChips(state);
    expect(chips).toContainEqual({ id: "block", value: 10 });
    expect(chips).toContainEqual({ id: "burn", value: 3 });
    expect(chips).toHaveLength(2);
  });

  it("filters out zero-value statuses", () => {
    const state = makeProductionBattleState();
    state.playerStatuses.block = 0;
    state.playerStatuses.burn = 5;
    const chips = getPlayerStatusChips(state);
    expect(chips).not.toContainEqual({ id: "block", value: 0 });
    expect(chips).toContainEqual({ id: "burn", value: 5 });
  });

  it("returns chips in defined order", () => {
    const state = makeProductionBattleState();
    state.playerStatuses.burn = 3;
    state.playerStatuses.block = 10;
    state.playerStatuses.stun = 1;
    const ids = getPlayerStatusChips(state).map((c) => c.id);
    expect(ids.indexOf("block")).toBeLessThan(ids.indexOf("burn"));
    expect(ids.indexOf("burn")).toBeLessThan(ids.indexOf("stun"));
  });

  it("surfaces armed CombatFlags as badge-less buff chips", () => {
    const state = makeProductionBattleState();
    state.flags.playNextCardTwice = true;
    state.flags.nextHitCrit = true;
    state.flags.nextHitPhysicalBonus = 4;
    state.flags.nextPhysicalDealsBleed = true;
    state.flags.nextArcheryCardFree = true;
    const chips = getPlayerStatusChips(state);
    expect(chips).toContainEqual({ id: "playNextCardTwice", value: 1, hideValue: true });
    expect(chips).toContainEqual({ id: "nextHitCrit", value: 1, hideValue: true });
    expect(chips).toContainEqual({ id: "nextHitPhysicalBonus", value: 4 });
    expect(chips).toContainEqual({ id: "nextPhysicalDealsBleed", value: 1, hideValue: true });
    expect(chips).toContainEqual({ id: "nextArcheryCardFree", value: 1, hideValue: true });
    expect(chips.find((chip) => chip.id === "nextHitPoison")).toBeUndefined();
  });

  it("counts mixed pending pulses as a hero Echo chip", () => {
    const state = makeProductionBattleState();
    state.pendingTurnStartEffects = [
      {
        remainingTurns: 1,
        effects: [
          { kind: "player-status", status: "block", amount: 4 },
          { kind: "damage", damageType: "holy", amount: 4 },
        ],
      },
      { remainingTurns: 1, effects: [{ kind: "damage", damageType: "freeze", amount: 2 }] },
    ];
    expect(getPlayerStatusChips(state)).toEqual([{ id: "echo", value: 1 }]);
  });

  it("orders armed chips after buffs and before harmful build-ups", () => {
    const state = makeProductionBattleState();
    state.playerStatuses.block = 10;
    state.playerStatuses.burn = 3;
    state.flags.nextHitCrit = true;
    const ids = getPlayerStatusChips(state).map((c) => c.id);
    expect(ids).toEqual(["block", "nextHitCrit", "burn"]);
  });

  it("does not surface purely-offensive pending pulses under the hero", () => {
    const state = makeProductionBattleState();
    state.pendingTurnStartEffects = [
      { remainingTurns: 1, effects: [{ kind: "damage", damageType: "stun", amount: 2 }] },
    ];
    expect(getPlayerStatusChips(state)).toEqual([]);
  });

  it("surfaces the player's CC immunity cooldown only after active CC ends", () => {
    const state = makeProductionBattleState();
    state.playerCC.cooldown = 2;
    expect(getPlayerStatusChips(state)).toEqual([{ id: "ccImmunity", value: 2, hideValue: true }]);
  });

  it("surfaces Stunned and Frozen chips while skip turns are active", () => {
    const state = makeProductionBattleState();
    state.playerCC.stunSkipTurns = 1;
    state.playerCC.freezeSkipTurns = 1;
    expect(getPlayerStatusChips(state)).toEqual([
      { id: "stunned", value: 1, hideValue: true },
      { id: "frozen", value: 1, hideValue: true },
    ]);
  });

  it("prefers active CC chips over immunity and buildup stacks", () => {
    const state = makeProductionBattleState();
    state.playerCC.stunSkipTurns = 1;
    state.playerCC.cooldown = 2;
    state.playerStatuses.stun = 8;
    expect(getPlayerStatusChips(state)).toEqual([{ id: "stunned", value: 1, hideValue: true }]);
  });

  it("surfaces Phoenix Feather as a badge-less binary effect", () => {
    const state = makeProductionBattleState();
    state.playerStatuses.phoenixFeather = 1;
    expect(getPlayerStatusChips(state)).toEqual([{ id: "phoenixFeather", value: 1, hideValue: true }]);
  });
});

describe("getEnemyStatusChips", () => {
  it.each([null, undefined] as const)("returns empty array when state is %s", (state) => {
    expect(getEnemyStatusChips(state)).toEqual([]);
  });

  it("returns empty array when no statuses are active", () => {
    const state = makeProductionBattleState();
    expect(getEnemyStatusChips(state)).toEqual([]);
  });

  it("returns matching chips for active statuses", () => {
    const state = makeProductionBattleState();
    state.enemyStatuses.poison = 4;
    state.enemyStatuses.freeze = 1;
    const chips = getEnemyStatusChips(state);
    expect(chips).toContainEqual({ id: "poison", value: 4 });
    expect(chips).toContainEqual({ id: "freeze", value: 1 });
  });

  it("filters out zero-value statuses", () => {
    const state = makeProductionBattleState();
    state.enemyStatuses.poison = 0;
    state.enemyStatuses.bleed = 2;
    const chips = getEnemyStatusChips(state);
    expect(chips).not.toContainEqual({ id: "poison", value: 0 });
    expect(chips).toContainEqual({ id: "bleed", value: 2 });
  });

  it("does not expose pending bleed leech healing as a status chip", () => {
    const state = makeProductionBattleState();
    state.enemyStatuses.bleed = 2;
    state.pendingBleedLeechHealing = 4;
    expect(getEnemyStatusChips(state)).toEqual([{ id: "bleed", value: 2 }]);
  });

  it("surfaces purely-offensive pending pulses as incoming damage chips", () => {
    const state = makeProductionBattleState();
    state.pendingTurnStartEffects = [
      { remainingTurns: 1, effects: [{ kind: "damage", damageType: "freeze", amount: 2 }] },
      { remainingTurns: 1, effects: [{ kind: "damage", damageType: "stun", amount: 2 }] },
      { remainingTurns: 1, effects: [{ kind: "damage", damageType: "freeze", amount: 3 }] },
    ];
    const chips = getEnemyStatusChips(state);
    expect(chips).toEqual([
      { id: "pending-stun", value: 2 },
      { id: "pending-freeze", value: 5 },
    ]);
  });

  it("does not surface mixed pending pulses under the enemy", () => {
    const state = makeProductionBattleState();
    state.pendingTurnStartEffects = [
      {
        remainingTurns: 1,
        effects: [
          { kind: "player-status", status: "block", amount: 4 },
          { kind: "damage", damageType: "holy", amount: 4 },
        ],
      },
    ];
    expect(getEnemyStatusChips(state)).toEqual([]);
  });

  it("exposes onAttackBleed as a status chip", () => {
    const state = makeProductionBattleState();
    state.enemyStatuses.onAttackBleed = 2;
    expect(getEnemyStatusChips(state)).toEqual([{ id: "onAttackBleed", value: 2 }]);
  });

  it("surfaces the enemy's CC immunity cooldown only after active CC ends", () => {
    const state = makeProductionBattleState();
    state.enemyStatuses.stun = 1;
    state.enemyCC.cooldown = 2;
    expect(getEnemyStatusChips(state)).toEqual([{ id: "ccImmunity", value: 2, hideValue: true }]);
  });

  it("surfaces enemy Stunned chip while skip turns are active", () => {
    const state = makeProductionBattleState();
    state.enemyCC.stunSkipTurns = 1;
    state.enemyCC.cooldown = 2;
    expect(getEnemyStatusChips(state)).toEqual([{ id: "stunned", value: 1, hideValue: true }]);
  });
});

describe("getCombatTextColorClass", () => {
  it("returns red for health damage", () => {
    expect(getCombatTextColorClass({ target: "player", kind: "damage", stat: "health", amount: 5 })).toBe(
      "text-red-400",
    );
  });

  it("returns type color for damage by type", () => {
    expect(getCombatTextColorClass({ target: "enemy", kind: "damage", stat: "burn", amount: 5 })).toBe(
      "text-orange-400",
    );
  });

  it("returns green for heals", () => {
    expect(getCombatTextColorClass({ target: "player", kind: "heal", stat: "health", amount: 5 })).toBe(
      "text-green-400",
    );
  });
});

describe("getCombatImpactVisual", () => {
  it.each(["physical", "burn", "freeze"] as const)("uses the %s keyword palette for damage", (stat) => {
    expect(getCombatImpactVisual({ target: "enemy", kind: "damage", stat, amount: 5 })).toEqual({
      colors: keywordDefinitions[stat].shineColors,
      healthLost: true,
    });
  });

  it("uses Block blue without marking Health loss", () => {
    expect(getCombatImpactVisual({ target: "player", kind: "damage", stat: "block", amount: 5 })).toEqual({
      colors: keywordDefinitions.block.shineColors,
      healthLost: false,
    });
  });

  it.each([
    { target: "player", kind: "heal", stat: "health", amount: 5 },
    { target: "player", kind: "status", stat: "block", amount: 5 },
    { target: "player", kind: "damage", stat: "mana", amount: 2 },
    { target: "player", kind: "notice", stat: "dodge", text: "Dodge" },
  ] as const)("does not create an impact for $kind $stat text", (event) => {
    expect(getCombatImpactVisual(event)).toBeNull();
  });
});

describe("getCombatTextIcon", () => {
  it("returns HeartPulse for heal", () => {
    const icon = getCombatTextIcon({ target: "player", kind: "heal", stat: "health", amount: 5 });
    expect(icon).toBe(keywordIcons.health);
  });

  it("returns the stat's icon for damage", () => {
    const icon = getCombatTextIcon({ target: "enemy", kind: "damage", stat: "burn", amount: 5 });
    expect(icon).toBe(keywordIcons.burn);
  });
});

describe("getBattleCardPlayTarget", () => {
  it('returns "enemy" for damage cards', () => {
    const card = makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 5 }] });
    expect(getBattleCardPlayTarget(card)).toBe("enemy");
  });

  it('returns "enemy" for enemy-status cards', () => {
    const card = makeTestCard({ effects: [{ kind: "enemy-status", status: "burn", amount: 3 }] });
    expect(getBattleCardPlayTarget(card)).toBe("enemy");
  });

  it('returns "player" for player-status cards', () => {
    const card = makeTestCard({ effects: [{ kind: "player-status", status: "block", amount: 5 }] });
    expect(getBattleCardPlayTarget(card)).toBe("player");
  });

  it('returns "player" for heal cards', () => {
    const card = makeTestCard({ effects: [{ kind: "heal", amount: 5 }] });
    expect(getBattleCardPlayTarget(card)).toBe("player");
  });

  it('returns "player" for restore-mana cards', () => {
    const card = makeTestCard({ effects: [{ kind: "restore-mana", amount: 2 }] });
    expect(getBattleCardPlayTarget(card)).toBe("player");
  });

  it('returns "player" for draw-cards cards', () => {
    const card = makeTestCard({ effects: [{ kind: "draw-cards", amount: 1 }] });
    expect(getBattleCardPlayTarget(card)).toBe("player");
  });

  it('returns "player" for summon-companion cards', () => {
    const card = makeTestCard({ effects: [{ kind: "summon-companion", companionId: "wolf" }] });
    expect(getBattleCardPlayTarget(card)).toBe("player");
  });

  it('returns "player" for wish cards', () => {
    const card = makeTestCard({ effects: [{ kind: "wish", amount: 1 }] });
    expect(getBattleCardPlayTarget(card)).toBe("player");
  });

  it('returns "enemy" for damage even when preceded by wish/gold', () => {
    const card = makeTestCard({
      effects: [
        { kind: "damage", damageType: "physical", amount: 5 },
        { kind: "gain-gold", amount: 5 },
      ],
    });
    expect(getBattleCardPlayTarget(card)).toBe("enemy");
  });

  it('returns "player" for player-status even when preceded by draw-cards', () => {
    const card = makeTestCard({
      effects: [
        { kind: "draw-cards", amount: 1 },
        { kind: "player-status", status: "block", amount: 5 },
      ],
    });
    expect(getBattleCardPlayTarget(card)).toBe("player");
  });
});
