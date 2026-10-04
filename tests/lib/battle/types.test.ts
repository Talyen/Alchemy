import { battleSnapshot } from "@/lib/battle/types/state-types";
import { resolveSecondaryAction, readCombatFlag, writeCombatFlag } from "@/lib/battle/action-context";
import { describe, expect, it } from "vitest";
import {
  addPlayerStatus,
  setEnemyStatus,
  setPlayerStatus,
  gainMana,
  resolvePlayerHealing,
  applyPlayerHealing,
  isPlayerDefeated,
} from "@/lib/battle/types";
import { makeTestBattleState, patchBattleState } from "../../fixtures/battle";
import { defaultCombatFlags } from "../../fixtures/default-battle-state";

describe("unchanged battle writes", () => {
  it("reuses state for unchanged status, flag, capped Mana and Health writes", () => {
    const state = makeTestBattleState({ playerHealth: 30, playerMaxHealth: 30, mana: 3, maxMana: 3 });
    expect(setPlayerStatus(state, "block", state.playerStatuses.block)).toBe(state);
    expect(addPlayerStatus(state, "block", 0)).toBe(state);
    expect(setEnemyStatus(state, "burn", state.enemyStatuses.burn)).toBe(state);
    expect(writeCombatFlag(state, "nextHitCrit", state.flags.nextHitCrit)).toBe(state);
    expect(gainMana(state, 2)).toBe(state);
    expect(resolvePlayerHealing(state, 5)).toEqual({ state, effective: 5, restored: 0, overflow: 5 });
    expect(resolvePlayerHealing(state, 5).state).toBe(state);
    expect(gainMana(state, 2, true).mana).toBe(5);
  });

  it("repairs pending Bleed Leech credit even when Bleed itself is unchanged", () => {
    const state = patchBattleState({ playerStatuses: { bleed: 2 }, pendingEnemyBleedLeechHealing: 5 });
    const next = setPlayerStatus(state, "bleed", 2);
    expect(next.pendingEnemyBleedLeechHealing).toBe(2);
    expect(next.playerStatuses).toBe(state.playerStatuses);
    expect(state.pendingEnemyBleedLeechHealing).toBe(5);
    expect(setPlayerStatus(next, "bleed", 2)).toBe(next);
  });

  it("still converts healing overflow to Block at full Health", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      talentEffects: { overhealToBlockRatio: 0.5 },
    });
    const healing = resolvePlayerHealing(state, 10, true);
    expect(healing.state.playerStatuses.block).toBe(state.playerStatuses.block + 5);
    expect(healing.restored).toBe(0);
    expect(healing.overflow).toBe(10);
    expect(state.playerStatuses.block).toBe(0);
  });

  it("retains Block and Forge reactions when sharing unchanged state fields", () => {
    const state = patchBattleState({
      gearEffects: { flatBlockGained: 2, forgeReadiesPhysicalRepeat: 1 },
      trinketEffects: { ironwoodBucklerThornsOnBlock: 3 },
    });
    const block = addPlayerStatus(state, "block", 1);
    expect(block.playerStatuses.block).toBe(3);
    expect(block.playerStatuses.thorns).toBe(3);
    const forge = addPlayerStatus(state, "forge", 1);
    expect(forge.uniqueGear.everkeenReady).toBe(true);
    const moreForge = addPlayerStatus(forge, "forge", 1);
    expect(moreForge.playerStatuses.forge).toBe(2);
    expect(moreForge.uniqueGear).toBe(forge.uniqueGear);
    expect(state.playerStatuses.block).toBe(0);
    expect(state.uniqueGear.everkeenReady).toBe(false);
  });

  it("compares secondary flag writes after preserving the unspent card discount", () => {
    const state = patchBattleState({ flags: { nextCardCostReduction: 2 } });
    resolveSecondaryAction(state, "companion", (secondary) => {
      expect(writeCombatFlag(secondary, "nextCardCostReduction", 0)).toBe(secondary);
      const earned = writeCombatFlag(secondary, "nextCardCostReduction", 3);
      expect(earned.flags.nextCardCostReduction).toBe(3);
      expect(secondary.flags.nextCardCostReduction).toBe(2);
      return earned;
    });
  });
});

describe("applyPlayerHealing", () => {
  it("preserves Death's Door when healing while active", () => {
    const state = makeTestBattleState({
      playerHealth: 1,
      deathsDoorUsed: true,
      deathsDoorActive: true,
      deathsDoorTriggeredTurn: 3,
    });
    const next = applyPlayerHealing(state, 5);
    expect(next.playerHealth).toBe(6);
    expect(next.deathsDoorActive).toBe(true);
    expect(next.deathsDoorTriggeredTurn).toBe(3);
  });

  it("converts overhealing to block if overhealToBlockRatio talent is active", () => {
    const state = patchBattleState({
      playerHealth: 25,
      playerMaxHealth: 30,
      playerStatuses: { block: 2 },
      talentEffects: { overhealToBlockRatio: 0.5 },
    });

    const next = applyPlayerHealing(state, 15, true);
    expect(next.playerHealth).toBe(30);
    expect(next.playerStatuses.block).toBe(7);
  });
});

it("distinguishes defeat from active Death's Door at zero Health", () => {
  expect(isPlayerDefeated({ playerHealth: 0, deathsDoorActive: true })).toBe(false);
  expect(isPlayerDefeated({ playerHealth: 0, deathsDoorActive: false })).toBe(true);
});

describe("resolveSecondaryAction", () => {
  it("prevents secondary actions from spending an existing discount", () => {
    const state = makeTestBattleState({
      flags: defaultCombatFlags({ nextCardCostReduction: 2 }),
    });
    const result = resolveSecondaryAction(state, "companion", (s) => writeCombatFlag(s, "nextCardCostReduction", 0));
    expect(result.flags.nextCardCostReduction).toBe(2);
  });

  it("keeps newly earned cost reduction and ordinary reaction flags across nested non-card effects", () => {
    const state = makeTestBattleState({ flags: defaultCombatFlags({ nextCardCostReduction: 2, nextHitCrit: true }) });
    const result = resolveSecondaryAction(state, "companion", (outer) =>
      resolveSecondaryAction(outer, "reward", (inner) => ({
        ...inner,
        flags: { ...inner.flags, nextCardCostReduction: 3, pendingWishMana: 1 },
      })),
    );
    expect(result.flags.nextCardCostReduction).toBe(3);
    expect(result.flags.nextHitCrit).toBe(true);
    expect(result.flags.pendingWishMana).toBe(1);
    expect(state.flags.nextCardCostReduction).toBe(2);
    expect(state.flags.pendingWishMana).toBe(0);
  });

  it("makes card bonuses ineligible without changing the underlying flags", () => {
    const state = makeTestBattleState({
      flags: defaultCombatFlags({ nextHitCrit: true, playNextCardTwice: true }),
    });
    let observedInside: Record<string, unknown> = {};
    const result = resolveSecondaryAction(state, "companion", (s) => {
      observedInside = { crit: readCombatFlag(s, "nextHitCrit"), twice: readCombatFlag(s, "playNextCardTwice") };
      return s;
    });
    expect(observedInside).toEqual({ crit: false, twice: false });

    expect(result.flags.nextHitCrit).toBe(true);
    expect(result.flags.playNextCardTwice).toBe(true);
  });

  it("marks first-card bonuses ineligible to secondary actions", () => {
    const state = makeTestBattleState();
    let observedInside = false;
    resolveSecondaryAction(state, "companion", (s) => {
      observedInside = readCombatFlag(s, "firstHolyCardFreeUsed");
      return s;
    });
    expect(observedInside).toBe(true);
    expect(state.flags.firstHolyCardFreeUsed).toBe(false);
  });
});

it("keeps secondary-action policy out of committed snapshots and restores nested scope", () => {
  const state = makeTestBattleState({ flags: defaultCombatFlags({ nextHitCrit: true }) });
  const result = resolveSecondaryAction(state, "companion", (companion) => {
    expect(companion.flags.nextHitCrit).toBe(true);
    expect(readCombatFlag(companion, "nextHitCrit")).toBe(false);
    const repeated = resolveSecondaryAction(companion, "repeat", (repeat) => {
      const reward = resolveSecondaryAction(repeat, "reward", (current) => {
        expect(current.action?.repeatActive).toBe(true);
        return current;
      });
      expect(reward.action?.source).toBe("repeat");
      const snapshot = battleSnapshot(repeat);
      expect(snapshot).not.toHaveProperty("action");
      expect(snapshot).not.toHaveProperty("rng");
      expect(snapshot.flags.nextHitCrit).toBe(true);
      return repeat;
    });
    expect(repeated.action?.source).toBe("companion");
    return repeated;
  });
  expect(result).not.toHaveProperty("action");
  expect(result.flags.nextHitCrit).toBe(true);
});
