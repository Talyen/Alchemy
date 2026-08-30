import { describe, expect, it } from "vitest";
import { emitOverhealBlockText, mergeCombatText, shouldShowCombatText } from "@/lib/battle/combat-text-events";
import type { CombatTextEvent } from "@/lib/battle/types";

describe("combat-text-events", () => {
  it("merges numeric events and deduplicates notices", () => {
    const events: CombatTextEvent[] = [];
    mergeCombatText(events, { target: "player", kind: "damage", stat: "physical", amount: 3 });
    mergeCombatText(events, { target: "player", kind: "damage", stat: "physical", amount: 2 });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ amount: 5 });

    mergeCombatText(events, { target: "player", kind: "notice", stat: "block", text: "Blocked" });
    mergeCombatText(events, { target: "player", kind: "notice", stat: "block", text: "Blocked" });
    expect(events.filter((entry) => entry.kind === "notice")).toHaveLength(1);
  });

  it("suppresses harmful status text and emits overheal block", () => {
    expect(shouldShowCombatText({ target: "player", kind: "status", stat: "poison", amount: 1 })).toBe(false);
    expect(shouldShowCombatText({ target: "player", kind: "status", stat: "block", amount: 1 })).toBe(true);

    const events: CombatTextEvent[] = [];
    emitOverhealBlockText({ playerStatuses: { block: 0 } as never }, { playerStatuses: { block: 4 } as never }, events);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ stat: "block", amount: 4 });
  });
});
