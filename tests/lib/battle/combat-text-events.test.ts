import { describe, expect, it } from "vitest";
import { mergeCombatText } from "@/lib/battle/combat-text-events";
import type { CombatTextEvent, NumericCombatTextEvent } from "@/lib/battle";

describe("combat feedback aggregation", () => {
  it("preserves resolved audio metadata while keeping the same numeric aggregation", () => {
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
      { target: "enemy", kind: "damage", stat: "burn", amount: 5, critical: true, periodic: true },
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
