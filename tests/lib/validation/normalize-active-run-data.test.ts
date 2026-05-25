import { describe, it, expect } from "vitest";
import { normalizeActiveRunData } from "@/lib/validation";

function baseInput(): Record<string, unknown> {
  return {
    characterId: "knight",
    runDeck: [],
    runGold: 0,
    runPlayerHealth: 30,
    runMaxHealth: 30,
    roomsEncountered: 0,
    currentAct: 1,
    destinationIndexInAct: 0,
    completedDestinations: [],
    runTrinkets: [],
    selectedDifficulty: null,
    contentSystemType: "campaign",
    labyrinthMap: null,
  };
}

describe("normalizeActiveRunData", () => {
  it("passes through a valid campaign run", () => {
    const result = normalizeActiveRunData(baseInput());
    expect(result.contentSystemType).toBe("campaign");
    expect(result.runPlayerHealth).toBe(30);
    expect(Array.isArray(result.runDeck)).toBe(true);
    expect(result.runDeck.length).toBeGreaterThan(0);
    expect(result.labyrinthMap).toBeNull();
  });

  it("switches labyrinth → campaign when labyrinthMap is null", () => {
    const input = { ...baseInput(), contentSystemType: "labyrinth" };
    const result = normalizeActiveRunData(input);
    expect(result.contentSystemType).toBe("campaign");
  });

  it("clamps player health to maxHealth", () => {
    const input = { ...baseInput(), runPlayerHealth: 50, runMaxHealth: 30 };
    const result = normalizeActiveRunData(input);
    expect(result.runPlayerHealth).toBe(30);
  });

  it("replaces empty deck with starting deck for unstarted run", () => {
    const result = normalizeActiveRunData(baseInput());
    expect(result.runDeck.length).toBeGreaterThan(0);
    expect((result.runDeck[0] as { id: string }).id).toBeDefined();
  });

  it("replaces legacy starter deck with current starting deck for unstarted run", () => {
    const legacyDeck = [
      { id: "slash" }, { id: "bash" }, { id: "block" },
      { id: "anvil" }, { id: "plate-mail" }, { id: "apple" },
      { id: "meteor" }, { id: "blessed-aegis" },
    ];
    const input = { ...baseInput(), runDeck: legacyDeck };
    const result = normalizeActiveRunData(input);
    expect(result.runDeck.length).toBeGreaterThan(0);
    expect((result.runDeck[0] as { id: string }).id).not.toBe("slash");
  });

  it("preserves custom deck for started run", () => {
    const customDeck = [{ id: "custom-card", title: "Custom", descriptionLines: [], art: "", cost: 1, effects: [] }];
    const input = {
      ...baseInput(),
      roomsEncountered: 5,
      currentAct: 1,
      destinationIndexInAct: 3,
      completedDestinations: ["combat", "combat"],
      runDeck: customDeck,
    };
    const result = normalizeActiveRunData(input);
    expect(result.runDeck).toEqual(customDeck);
  });

  it("defaults runTalentXP to empty object when missing", () => {
    const result = normalizeActiveRunData(baseInput());
    expect(result.runTalentXP).toEqual({});
  });

  it("strips labyrinth modifiers for campaign mode", () => {
    const input = {
      ...baseInput(),
      contentSystemType: "campaign",
      activeCombat: {
        activeLabyrinthModifiers: ["mod1"],
        activeLabyrinthRewardModifiers: ["mod2"],
      },
    };
    const result = normalizeActiveRunData(input);
    expect(result.activeCombat).not.toBeNull();
    if (result.activeCombat) {
      expect((result.activeCombat as Record<string, unknown>).activeLabyrinthModifiers).toEqual([]);
      expect((result.activeCombat as Record<string, unknown>).activeLabyrinthRewardModifiers).toEqual([]);
    }
  });

  it("handles null activeCombat", () => {
    const result = normalizeActiveRunData(baseInput());
    expect(result.activeCombat).toBeNull();
  });

  it("does not crash on missing or undefined fields", () => {
    const result = normalizeActiveRunData({});
    expect(Array.isArray(result.runDeck)).toBe(true);
    expect(result.runDeck).toEqual([]);
    expect(result.completedDestinations).toEqual([]);
  });

  it("does not crash when runDeck is not an array", () => {
    const input = { ...baseInput(), runDeck: "invalid" };
    const result = normalizeActiveRunData(input);
    expect(Array.isArray(result.runDeck)).toBe(true);
    expect(result.runDeck.length).toBeGreaterThan(0);
  });

  it("does not crash when completedDestinations is not an array", () => {
    const input = { ...baseInput(), completedDestinations: "invalid" };
    const result = normalizeActiveRunData(input);
    expect(result.completedDestinations).toEqual([]);
  });
});
