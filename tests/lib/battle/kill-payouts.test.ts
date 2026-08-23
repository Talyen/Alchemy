import { describe, expect, it } from "vitest";
import type { GearEffectManifest } from "@/lib/gear";
import { dealPlayerTypedHit } from "@/lib/battle/player-typed-hit";
import { resolveStunTrigger } from "@/lib/battle/status-stun-resolve";
import { tryTriggerEnemyFreeze } from "@/lib/battle/damage-status-riders";
import { withPreservedFlags, type BattleState } from "@/lib/battle/types";
import { makeCombatTexts, makeTestBattleState } from "../../fixtures/battle";
import { defaultCombatFlags, defaultTrinketManifest } from "../../fixtures/default-battle-state";

/** State where a CC proc fires (stacks far above threshold) and the proc damage kills. */
function ccProcKillState(): BattleState {
  return makeTestBattleState({
    enemyHealth: 5,
    enemyMaxHealth: 30,
    playerHealth: 20,
    playerMaxHealth: 30,
    gold: 0,
  });
}

function withGear(state: BattleState, gear: Partial<GearEffectManifest>): BattleState {
  return { ...state, gearEffects: { ...state.gearEffects, ...gear } };
}

describe("lethality payouts — every kill path pays the same rewards", () => {
  it("thunderstone-on-stun kill pays gear kill rewards and Bone Charm heal", () => {
    const base = ccProcKillState();
    const state = {
      ...base,
      enemyStatuses: { ...base.enemyStatuses, stun: 999 },
      gearEffects: { ...base.gearEffects, healOnKill: 3, goldOnKill: 4 },
      trinketEffects: defaultTrinketManifest({ thunderstoneDamageOnStun: 10, boneCharmHealOnKill: 2 }),
    };
    const texts = makeCombatTexts();
    const result = resolveStunTrigger(state, texts);
    expect(result.enemyHealth).toBe(0);
    expect(result.playerHealth).toBe(25); // +2 bone charm, +3 heal-on-kill
    expect(result.gold).toBe(4);
  });

  it("Frozen Heart freeze-proc kill pays gear kill rewards and Bone Charm heal", () => {
    const base = ccProcKillState();
    const state = {
      ...withGear(base, { goldOnKill: 4 }),
      enemyStatuses: { ...base.enemyStatuses, freeze: 999 },
      trinketEffects: defaultTrinketManifest({ frozenHeartDamage: 10, boneCharmHealOnKill: 2 }),
    };
    const texts = makeCombatTexts();
    const result = tryTriggerEnemyFreeze(state, state, texts);
    expect(result.enemyHealth).toBe(0);
    expect(result.playerHealth).toBe(22);
    expect(result.gold).toBe(4);
  });

  it("follow-up typed hit kills pay Bone Charm heal alongside gear rewards", () => {
    const state = withGear(ccProcKillState(), { healOnKill: 3 });
    const trinketState = { ...state, trinketEffects: defaultTrinketManifest({ boneCharmHealOnKill: 2 }) };
    const texts = makeCombatTexts();
    const result = dealPlayerTypedHit(trinketState, "physical", 10, texts);
    expect(result.enemyHealth).toBe(0);
    expect(result.playerHealth).toBe(25);
  });

  it("does not pay twice when a follow-up path lands after an already-lethal hit", () => {
    const lethal = withGear({ ...ccProcKillState(), enemyHealth: 0 }, { goldOnKill: 4 });
    const texts = makeCombatTexts();
    // Enemy already dead: any follow-up path must see enemyWasAlive=false and no-op.
    const afterTypedHit = dealPlayerTypedHit(lethal, "physical", 10, texts);
    expect(afterTypedHit.gold).toBe(0);
    expect(afterTypedHit.playerHealth).toBe(20);
  });
});

describe("withPreservedFlags", () => {
  it("restores cost/first-use flags mutated inside the callback", () => {
    const state = makeTestBattleState({
      flags: defaultCombatFlags({ nextCardCostReduction: 2 }),
    });
    const result = withPreservedFlags(state, (s) => ({
      ...s,
      flags: { ...s.flags, nextCardCostReduction: 0 },
    }));
    expect(result.flags.nextCardCostReduction).toBe(2);
  });

  it("forces non-card flags inactive during the callback so companions/pulses cannot consume them", () => {
    const state = makeTestBattleState({
      flags: defaultCombatFlags({ nextHitCrit: true, playNextCardTwice: true }),
    });
    let observedInside: Record<string, unknown> = {};
    const result = withPreservedFlags(state, (s) => {
      observedInside = { crit: s.flags.nextHitCrit, twice: s.flags.playNextCardTwice };
      return s;
    });
    expect(observedInside).toEqual({ crit: false, twice: false });
    // And the caller's armed values survive the action.
    expect(result.flags.nextHitCrit).toBe(true);
    expect(result.flags.playNextCardTwice).toBe(true);
  });

  it("forces first-time-per-combat flags to their used sentinels during the callback", () => {
    const state = makeTestBattleState();
    let observedInside = false;
    withPreservedFlags(state, (s) => {
      observedInside = s.flags.firstHolyCardFreeUsed;
      return s;
    });
    expect(observedInside).toBe(true);
    expect(state.flags.firstHolyCardFreeUsed).toBe(false);
  });
});
