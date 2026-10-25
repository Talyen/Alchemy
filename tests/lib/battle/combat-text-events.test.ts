import { describe, expect, it } from "vitest";
import { mergeCombatText } from "@/lib/battle/combat-text-events";
import type { CombatTextEvent, NumericCombatTextEvent } from "@/lib/battle";
import { applyCardEffects } from "@/lib/battle/effect-handlers/registry";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { cardById, companionLibrary, type BattleCardEffect } from "@/lib/game-data";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("combat feedback aggregation", () => {
  it("keeps direct and periodic audio identities separate without losing amounts", () => {
    const texts: CombatTextEvent[] = [];
    mergeCombatText(texts, { target: "enemy", kind: "damage", stat: "burn", amount: 2 });
    mergeCombatText(texts, {
      target: "enemy",
      kind: "damage",
      stat: "burn",
      amount: 3,
      critical: true,
      periodic: true,
    });
    expect(texts).toEqual([
      { target: "enemy", kind: "damage", stat: "burn", amount: 2 },
      { target: "enemy", kind: "damage", stat: "burn", amount: 3, critical: true, periodic: true },
    ]);
  });
  it("hides status buildup while retaining damage, control notices and beneficial gains", () => {
    const texts: CombatTextEvent[] = [];
    mergeCombatText(texts, { target: "player", kind: "status", stat: "burn", amount: 2 });
    mergeCombatText(texts, { target: "enemy", kind: "status", stat: "stun", amount: 2 });
    const visible: CombatTextEvent[] = [
      { target: "player", kind: "damage", stat: "burn", amount: 2 },
      { target: "enemy", kind: "notice", stat: "stun", text: "Stunned" },
      { target: "player", kind: "status", stat: "block", amount: 5 },
    ];
    for (const event of visible) mergeCombatText(texts, event);
    expect(texts).toEqual(visible);
  });

  it.each<Partial<NumericCombatTextEvent>>([
    { target: "player" },
    { kind: "heal" },
    { stat: "burn" },
    { impact: false },
    { additive: false },
    { amount: -3 },
    { amount: 0 },
  ])("keeps a distinct numeric outcome separate: %j", (difference) => {
    const base: NumericCombatTextEvent = { target: "enemy", kind: "damage", stat: "health", amount: 2 };
    const distinct = { ...base, ...difference };
    const texts: CombatTextEvent[] = [];
    mergeCombatText(texts, { ...distinct });
    mergeCombatText(texts, { ...base });
    mergeCombatText(texts, { ...base });
    expect(texts).toEqual([distinct, { ...base, amount: 4 }]);
  });

  it("deduplicates notices only when their target, stat, text and signal match", () => {
    const notice: CombatTextEvent = { target: "enemy", kind: "notice", stat: "stun", text: "Stunned" };
    const texts: CombatTextEvent[] = [];
    const distinct: CombatTextEvent[] = [
      notice,
      { ...notice, target: "player" },
      { ...notice, stat: "freeze" },
      { ...notice, text: "Purged" },
      { ...notice, signal: "purge" },
    ];
    for (const event of distinct) {
      mergeCombatText(texts, event);
      mergeCombatText(texts, { ...event });
    }
    expect(texts).toEqual(distinct);
  });
});

describe("intended card feedback", () => {
  const resolve = (effects: BattleCardEffect[], patch: Parameters<typeof patchBattleState>[0] = {}) => {
    const events: CombatTextEvent[] = [];
    const state = patchBattleState({ rng: () => 0.99, ...patch });
    applyCardEffects(state, makeTestCard({ effects }), events, { manaAtStart: state.mana, origin: "played-card" });
    return events;
  };
  const primary = (events: CombatTextEvent[]) => events.filter((event) => event.feedback === "primary");

  it("acknowledges Block centrally and makes Spiked Shield's Thorns secondary without duplicating either", () => {
    expect(primary(resolve(cardById["block"]!.effects))).toMatchObject([{ stat: "block", amount: 5 }]);
    const events = resolve(cardById["spiked-shield"]!.effects);
    expect(events).toHaveLength(2);
    expect(events).toMatchObject([
      { stat: "block", amount: 2, feedback: "primary" },
      { stat: "thorns", amount: 2, feedback: "secondary" },
    ]);
  });

  it("prefers the actual hit to its setup status and retains healing on the other recipient", () => {
    const events = resolve([...cardById["shield-bash"]!.effects, { kind: "heal", amount: 3 }], {
      playerHealth: 20,
      playerMaxHealth: 30,
    });
    expect(primary(events)).toMatchObject([
      { target: "enemy", kind: "damage", stat: "stun" },
      { target: "player", kind: "heal", amount: 3 },
    ]);
    expect(events.find((event) => event.stat === "block")?.feedback).toBe("secondary");
  });

  it("uses the next meaningful authored buff after a no-op and never promotes a Health cost", () => {
    const events = resolve([
      { kind: "lose-health", amount: 2 },
      { kind: "player-status", status: "block", amount: 0 },
      { kind: "player-status", status: "thorns", amount: 3 },
      { kind: "player-status", status: "forge", amount: 20 },
    ]);
    expect(primary(events)).toMatchObject([{ stat: "thorns", amount: 3 }]);
    expect(events.find((event) => event.stat === "health")?.feedback).toBe("secondary");
    expect(events.find((event) => event.stat === "forge")?.feedback).toBe("secondary");
  });

  it("keeps a paid-card Block proc separate from the card's own Block, preserving the exact total", () => {
    const card = makeTestCard({ cost: 1, effects: [{ kind: "player-status", status: "block", amount: 5 }] });
    const state = patchBattleState({
      hand: [card],
      mana: 3,
      maxMana: 3,
      rng: () => 0.99,
      gearEffects: { blockOnPaidCardWithoutBlock: 2 },
    });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.playerStatuses.block).toBe(7);
    expect(result.combatTexts.filter((event) => event.stat === "block")).toMatchObject([
      { amount: 2, feedback: "secondary" },
      { amount: 5, feedback: "primary" },
    ]);
  });

  it("marks triggered card effects as secondary and retains a zero acknowledgement for an ineffective direct action", () => {
    const card = makeTestCard({ effects: [{ kind: "player-status", status: "block", amount: 5 }] });
    const state = patchBattleState();
    const triggered: CombatTextEvent[] = [];
    applyCardEffects(state, card, triggered, { manaAtStart: state.mana, origin: "triggered-card" });
    expect(primary(triggered)).toEqual([]);
    expect(triggered).toMatchObject([{ stat: "block", feedback: "secondary" }]);
    expect(primary(resolve([{ kind: "heal", amount: 0 }]))).toMatchObject([{ stat: "health", amount: 0 }]);
  });

  it("treats an explicitly commanded Companion attack as the card outcome, not an idle Companion proc", () => {
    const events = resolve([{ kind: "companion-action", amount: 1 }], { activeCompanion: companionLibrary.wolf });
    expect(primary(events)).toEqual([expect.objectContaining({ target: "enemy", kind: "damage" })]);
    expect(primary(events).some((event) => event.kind !== "notice" && event.amount === 0)).toBe(false);
  });
});
