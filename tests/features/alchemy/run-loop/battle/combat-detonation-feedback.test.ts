import { describe, expect, it, vi } from "vitest";
import { applyCardEffects, type CombatTextEvent } from "@/lib/battle";
import { mergeCombatText } from "@/lib/battle/combat-text-events";
import { detonateEnemyStatuses } from "@/lib/battle/dot-resolve";
import { prepareCombatFeedback } from "@/features/alchemy/run-loop/battle/combat-feedback-model";
import { consolidateCombatBursts } from "@/features/alchemy/run-loop/battle/combat-feedback-merge";
import { combatTextLane } from "@/features/alchemy/run-loop/battle/combat-feedback-motion";
import { makeTestCard, regressionBattle } from "../../../../fixtures/battle";

const direct: CombatTextEvent = {
  target: "enemy",
  kind: "damage",
  stat: "burn",
  amount: 8,
  feedback: "primary",
};
const detonation: CombatTextEvent = {
  target: "enemy",
  kind: "damage",
  stat: "burn",
  amount: 38,
  detonation: true,
  feedback: "secondary",
};
const prepare = (events: CombatTextEvent[], action = 1, now = 0) => prepareCombatFeedback(events, action, now, 1100);
const entries = (events: CombatTextEvent[]) => prepare(events).bursts.flatMap((burst) => burst.entries);

describe("detonation combat feedback", () => {
  it("shows Combustion's actual 8 hit plus 38 consumed Burn as one central 46, retaining the raw ledger", () => {
    const rng = vi.fn(() => 0.99);
    const state = regressionBattle({ rng, enemyHealth: 100, enemyMaxHealth: 100, enemyStatuses: { burn: 30 } });
    const before = { ...state, rng: undefined };
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(
      state,
      makeTestCard({ effects: [{ kind: "damage", damageType: "burn", amount: 8, detonateAllBurn: true }] }),
      texts,
      { manaAtStart: state.mana, origin: "played-card" },
    );
    expect(result.enemyHealth).toBe(54);
    expect(result.enemyStatuses.burn).toBe(0);
    expect(texts.filter((event) => event.kind === "damage")).toEqual([detonation, direct]);
    const ledger = structuredClone(texts);
    const rngCalls = rng.mock.calls.length;
    const prepared = prepare(texts);
    expect(prepared.bursts[0]!.entries).toMatchObject([
      { amount: 46, displayText: "-46", stat: "burn", detonation: true, additive: false, feedback: "primary" },
    ]);
    expect(prepared.bursts[0]!.entries.map(combatTextLane)).toEqual(["impact"]);
    expect(prepared.impacts.enemyImpactCue).toMatchObject({ amount: 38 });
    expect(texts).toEqual(ledger);
    expect({ ...state, rng: undefined }).toEqual(before);
    expect(rng).toHaveBeenCalledTimes(rngCalls);
  });

  it("keeps mixed types and Critical attribution separate, while same-type totals only include a Critical", () => {
    const critical: CombatTextEvent = { ...direct, stat: "physical", critical: true };
    const mixed = entries([critical, detonation]);
    expect(mixed).toMatchObject([
      { amount: 8, stat: "physical", critical: true },
      { amount: 38, stat: "burn" },
    ]);
    expect(mixed.map(combatTextLane)).toEqual(["impact", "impact"]);
    expect(mixed[1]).not.toHaveProperty("critical");
    const sameType = entries([{ ...direct, critical: true }, detonation]);
    expect(sameType).toMatchObject([{ amount: 46, critical: true, includesCritical: true }]);
  });

  it("retains overkill separately from displayed resolved damage and does not add healthLost twice", () => {
    const state = regressionBattle({ enemyHealth: 15, enemyMaxHealth: 100, enemyStatuses: { burn: 30 } });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(
      state,
      makeTestCard({ effects: [{ kind: "damage", damageType: "burn", amount: 8, detonateAllBurn: true }] }),
      texts,
      { manaAtStart: state.mana, origin: "played-card" },
    );
    expect(result.enemyHealth).toBe(0);
    expect(texts).toContainEqual({ ...detonation, healthLost: 7 });
    expect(entries(texts).filter((entry) => entry.kind === "damage")).toMatchObject([{ amount: 46, healthLost: 15 }]);
    expect(entries([{ ...detonation, amount: 46, healthLost: 15 }])).toMatchObject([{ amount: 46, healthLost: 15 }]);
  });

  it("does not merge a different recipient, companion action, periodic tick or reaction into the detonation", () => {
    const events: CombatTextEvent[] = [
      direct,
      detonation,
      { ...direct, target: "player" },
      { ...direct, companionActionId: 1 },
      { ...direct, companionActionId: 2 },
      { ...direct, periodic: true },
      { ...direct, reactionId: "bloodboil", feedback: "secondary" },
      { target: "enemy", kind: "notice", stat: "burn", text: "Bloodboil", signal: "reaction", reactionId: "bloodboil" },
    ];
    const result = prepare(events);
    expect(
      result.bursts.flatMap((burst) => burst.entries).map((entry) => entry.kind === "damage" && entry.amount),
    ).toEqual([8, 46, 8, 8, 8]);
    expect(result.reactions[0]!.entries).toMatchObject([{ amount: 8, reactionId: "bloodboil" }]);
  });

  it("does not merge separate detonation actions inside the rapid-feedback window", () => {
    const first = prepare([direct, detonation]);
    const next = prepare([direct, detonation], 2, 10);
    const result = consolidateCombatBursts(first.bursts, next.bursts, 10);
    expect(result.map((burst) => burst.entries[0]!.displayText)).toEqual(["-46", "-46"]);
  });

  it("totals only post-mitigation damage and skips detonation after a lethal direct hit", () => {
    const resolve = (enemyHealth: number) => {
      const state = regressionBattle({
        enemyHealth,
        enemyMaxHealth: 100,
        enemyMitigation: { armor: 3, block: 2 },
        enemyStatuses: { burn: 30 },
      });
      const texts: CombatTextEvent[] = [];
      const result = applyCardEffects(
        state,
        makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 8, detonateAllBurn: true }] }),
        texts,
        { manaAtStart: state.mana, origin: "played-card" },
      );
      return { result, damage: entries(texts).filter((entry) => entry.kind === "damage" && entry.impact !== false) };
    };
    const surviving = resolve(100);
    expect(surviving.result.enemyHealth).toBe(67);
    expect(surviving.damage).toMatchObject([
      { amount: 30, stat: "burn" },
      { amount: 3, stat: "physical" },
    ]);
    const lethal = resolve(2);
    expect(lethal.result.enemyHealth).toBe(0);
    expect(lethal.result.enemyStatuses.burn).toBe(30);
    expect(lethal.damage).toMatchObject([{ amount: 3, healthLost: 2, stat: "physical" }]);
    expect(lethal.damage[0]).not.toHaveProperty("detonation");
  });

  it("does not confuse a direct receipt, natural tick or arbitrary secondary proc with a detonation", () => {
    const texts: CombatTextEvent[] = [];
    for (const event of [direct, { ...direct, feedback: "secondary" as const }, detonation])
      mergeCombatText(texts, event);
    expect(texts).toEqual([direct, { ...direct, feedback: "secondary" }, detonation]);
    const result = entries(texts);
    expect(result).toMatchObject([{ amount: 46 }, { amount: 8, feedback: "secondary" }]);
    expect(result.map(combatTextLane)).toEqual(["impact", "setback"]);
  });

  it("retains ineffective feedback, does not detonate a corpse, and keeps an independent detonation central", () => {
    expect(entries([{ ...direct, amount: 0, impact: false }])).toMatchObject([{ amount: 0, displayText: "0" }]);
    expect(entries([{ ...direct, amount: 0, impact: false }, detonation])).toMatchObject([{ amount: 38 }]);
    const dead = regressionBattle({ enemyHealth: 0, enemyStatuses: { burn: 30 } });
    const texts: CombatTextEvent[] = [];
    expect(detonateEnemyStatuses(dead, ["burn"], texts)).toBe(dead);
    expect(texts).toEqual([]);
    const standalone = entries([detonation]);
    expect(standalone.map(combatTextLane)).toEqual(["impact"]);
    expect(standalone[0]).toMatchObject({ amount: 38 });
  });
});
