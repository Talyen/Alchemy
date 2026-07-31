// Combat text aggregation tests for filtering UI-only floating number events.
// Depends on the battle combat-text helper and type contracts.
import { describe, expect, it } from "vitest";

import { emitOverhealBlockText, mergeCombatText, shouldShowCombatText } from "@/lib/battle/combat-text";
import { defaultPlayerStatusValues } from "../../fixtures/default-battle-state";
import { makeCombatTexts as makeTexts } from "../../fixtures/battle";

describe("shouldShowCombatText", () => {
  it("hides harmful status application text", () => {
    expect(shouldShowCombatText({ target: "player", kind: "status", stat: "burn", amount: 2 })).toBe(false);
    expect(shouldShowCombatText({ target: "enemy", kind: "status", stat: "poison", amount: 3 })).toBe(false);
    expect(shouldShowCombatText({ target: "enemy", kind: "status", stat: "bleed", amount: 4 })).toBe(false);
    expect(shouldShowCombatText({ target: "enemy", kind: "status", stat: "freeze", amount: 5 })).toBe(false);
    expect(shouldShowCombatText({ target: "enemy", kind: "status", stat: "stun", amount: 6 })).toBe(false);
  });

  it("keeps harmful status damage text visible", () => {
    expect(shouldShowCombatText({ target: "player", kind: "damage", stat: "burn", amount: 2 })).toBe(true);
  });

  it("keeps control notices visible", () => {
    expect(shouldShowCombatText({ target: "enemy", kind: "notice", stat: "stun", text: "Stunned" })).toBe(true);
    expect(shouldShowCombatText({ target: "enemy", kind: "notice", stat: "freeze", text: "Frozen" })).toBe(true);
  });

  it("keeps beneficial status and resource text visible", () => {
    expect(shouldShowCombatText({ target: "player", kind: "status", stat: "block", amount: 5 })).toBe(true);
    expect(shouldShowCombatText({ target: "player", kind: "status", stat: "gold", amount: 3 })).toBe(true);
  });
});

describe("mergeCombatText", () => {
  it("does not add harmful status application events", () => {
    const texts = makeTexts();
    mergeCombatText(texts, { target: "player", kind: "status", stat: "burn", amount: 2 });
    expect(texts).toEqual([]);
  });

  it("still merges visible events", () => {
    const texts = makeTexts();
    mergeCombatText(texts, { target: "player", kind: "status", stat: "block", amount: 2 });
    mergeCombatText(texts, { target: "player", kind: "status", stat: "block", amount: 3 });
    expect(texts).toEqual([{ target: "player", kind: "status", stat: "block", amount: 5 }]);
  });

  it("deduplicates matching control notices", () => {
    const texts = makeTexts();
    mergeCombatText(texts, { target: "enemy", kind: "notice", stat: "stun", text: "Stunned" });
    mergeCombatText(texts, { target: "enemy", kind: "notice", stat: "stun", text: "Stunned" });
    expect(texts).toEqual([{ target: "enemy", kind: "notice", stat: "stun", text: "Stunned" }]);
  });
});

describe("emitOverhealBlockText", () => {
  it("emits block combat text when overheal increases block", () => {
    const base = defaultPlayerStatusValues({ block: 2 });
    const before = { playerStatuses: base };
    const after = { playerStatuses: { ...base, block: 7 } };
    const texts = makeTexts();
    emitOverhealBlockText(before, after, texts);
    expect(texts).toEqual([{ target: "player", kind: "status", stat: "block", amount: 5 }]);
  });

  it("no-ops when block did not increase", () => {
    const statuses = defaultPlayerStatusValues({ block: 4 });
    const texts = makeTexts();
    emitOverhealBlockText({ playerStatuses: statuses }, { playerStatuses: statuses }, texts);
    expect(texts).toEqual([]);
  });
});
