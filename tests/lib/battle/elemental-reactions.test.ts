import * as dodge from "@/lib/battle/dodge";
import { describe, expect, it, vi } from "vitest";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { projectEnemyDotDamage } from "@/lib/battle/dot-resolve";
import { resolveFollowUpHit } from "@/lib/battle/follow-up-hit-resolution";
import { resetTurnFlags } from "@/lib/battle/combat-flags";
import { resolveSecondaryAction } from "@/lib/battle/action-context";
import { patchBattleState, makeTestCard } from "../../fixtures/battle";
import { playBattleCardResolved, type BattleState, type CombatTextEvent } from "@/lib/battle";
import { cardById } from "@/lib/game-data";
const physical = makeTestCard({
  id: "test-physical",
  effects: [{ kind: "damage", damageType: "physical", amount: 4 }],
});
const nature = makeTestCard({ id: "test-nature", effects: [{ kind: "damage", damageType: "nature", amount: 4 }] });
function frozen() {
  return patchBattleState({
    rng: () => 0.99,
    enemyHealth: 100,
    enemyMaxHealth: 100,
    enemyCC: { freezeSkipTurns: 1 },
    enemyMitigation: { block: 8, armor: 5 },
  });
}
function hit(state: BattleState, card = physical, texts: CombatTextEvent[] = []) {
  return applyCardEffects(state, card, texts, {
    manaAtStart: state.mana,
    enemyFreezeSkipTurnsAtStart: state.enemyCC.freezeSkipTurns,
    origin: "played-card",
  });
}
describe("elemental reaction payoffs", () => {
  it("pays Trophy Shot once when an Archery card defeats an enemy through Wildfire", () => {
    const card = cardById["lightning-arrow"]!;
    const state = patchBattleState({
      rng: () => 0.99,
      hand: [card],
      enemyHealth: 10,
      enemyMaxHealth: 100,
      gold: 0,
      enemyStatuses: { burn: 8 },
      talentEffects: { goldOnArcheryKill: 2 },
    });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.enemyHealth).toBe(0);
    expect(result.state.flags.wildfireUsed).toBe(true);
    expect(result.state.gold).toBe(2);
    expect(result.combatTexts.filter((text) => text.stat === "gold")).toEqual([expect.objectContaining({ amount: 2 })]);
  });
  it("Shatter destroys defenses before the guaranteed critical, preserves Freeze, and cannot repeat that turn", () => {
    const state = frozen();
    const texts: CombatTextEvent[] = [];
    const result = hit(state, physical, texts);
    expect(result.enemyMitigation).toMatchObject({ block: 0, armor: 0 });
    expect(result.enemyHealth).toBe(92);
    expect(result.enemyCC.freezeSkipTurns).toBe(1);
    expect(result.flags.shatterUsed).toBe(true);
    expect(state.enemyMitigation).toMatchObject({ block: 8, armor: 5 });
    const notices = texts.filter((event) => event.kind === "notice");
    expect(notices.some((event) => event.kind === "notice" && event.text.startsWith("Shatter"))).toBe(true);
    expect(hit(result).enemyHealth).toBe(88);
    expect(resetTurnFlags(result.flags).shatterUsed).toBe(false);
  });
  it("Dodge and zero attacks preserve defenses and Shatter availability", () => {
    const state = { ...frozen(), rng: () => 0 };
    // Frozen enemies currently cannot Dodge; force the Dodge seam to protect reaction ordering if that changes.
    const spy = vi.spyOn(dodge, "tryDodgePlayerAttackPacket").mockReturnValueOnce(state);
    const result = hit(state);
    spy.mockRestore();
    expect(result.enemyMitigation).toEqual(state.enemyMitigation);
    expect(result.flags.shatterUsed).toBe(false);
    const zero = makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 0 }] });
    expect(hit(frozen(), zero).flags.shatterUsed).toBe(false);
  });
  it("only the first hit of a multi-hit action gets Shatter's critical", () => {
    const twice = makeTestCard({
      effects: [
        { kind: "damage", damageType: "physical", amount: 4 },
        { kind: "damage", damageType: "physical", amount: 4 },
      ],
    });
    expect(hit(frozen(), twice).enemyHealth).toBe(88);
  });
  it("Companions qualify but secondary follow-up and delayed damage do not", () => {
    const state = frozen();
    const texts: CombatTextEvent[] = [];
    const companion = resolveSecondaryAction(state, "companion", (current) =>
      applyCardEffects(current, physical, texts, {
        manaAtStart: current.mana,
        enemyFreezeSkipTurnsAtStart: 1,
        origin: "companion",
      }),
    );
    expect(companion.flags.shatterUsed).toBe(true);
    expect(
      resolveFollowUpHit(state, { source: "player-follow-up", damageType: "physical", amount: 4 }, []).flags
        .shatterUsed,
    ).toBe(false);
    expect(resolveSecondaryAction(state, "delayed-card", (current) => hit(current)).flags.shatterUsed).toBe(false);
  });
  it("Wildfire pays remaining Burn exactly once and clears it after the Nature hit", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { burn: 8 },
    });
    expect(projectEnemyDotDamage(state, "burn", "remaining-ticks")).toBe(15);
    const result = hit(state, nature);
    expect(result.enemyHealth).toBe(81);
    expect(result.enemyStatuses.burn).toBe(0);
    expect(result.flags.wildfireUsed).toBe(true);
    const relit = { ...result, enemyStatuses: { ...result.enemyStatuses, burn: 8 } };
    expect(hit(relit, nature).enemyStatuses.burn).toBe(8);
    expect(resetTurnFlags(result.flags).wildfireUsed).toBe(false);
  });
  it("Wildfire uses the same modified per-tick projection and awards lethal rewards once", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      enemyHealth: 10,
      enemyMaxHealth: 100,
      enemyStatuses: { burn: 8, bleed: 1, poison: 1 },
      gearEffects: { burnDamageBonusToBleedingPercent: 100 },
      talentEffects: { goldOnPoisonedKill: 3 },
    });
    expect(projectEnemyDotDamage(state, "burn", "remaining-ticks")).toBe(30);
    const result = hit(state, nature);
    expect(result.enemyHealth).toBe(0);
    expect(result.flags.killRewardsPaid).toBe(true);
  });
  it("Dodge, absorbed hits, and Nature lethality do not detonate", () => {
    const base = patchBattleState({
      rng: () => 0.99,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { burn: 8 },
    });
    for (const state of [
      { ...base, rng: () => 0 },
      { ...base, enemyMitigation: { ...base.enemyMitigation, block: 20 } },
      { ...base, enemyHealth: 1 },
    ]) {
      const result = hit(state, nature);
      expect(result.enemyStatuses.burn).toBe(8);
      expect(result.flags.wildfireUsed).toBe(false);
    }
  });
  it("fatal retaliation prevents Wildfire, while Death's Door survival permits it", () => {
    const base = patchBattleState({
      rng: () => 0.99,
      playerHealth: 1,
      deathsDoorUsed: true,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { burn: 8, thorns: 20 },
    });
    const fatal = hit(base, nature);
    expect(fatal.playerHealth).toBe(0);
    expect(fatal.enemyStatuses.burn).toBe(8);
    expect(fatal.flags.wildfireUsed).toBe(false);
    const survived = hit({ ...base, deathsDoorActive: true }, nature);
    expect(survived.enemyStatuses.burn).toBe(0);
    expect(survived.flags.wildfireUsed).toBe(true);
  });
});
