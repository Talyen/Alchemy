import { describe, it, expect } from "vitest";
import { normalizeActiveRunData } from "@/lib/validation";
import { baseActiveRunInput } from "../../fixtures/active-run";

const baseInput = baseActiveRunInput;

describe("normalizeActiveRunData", () => {
  it("passes through an active campaign run and nulls foreign content fields", () => {
    const result = normalizeActiveRunData(baseInput());
    expect(result.contentSystemType).toBe("campaign");
    expect(result.runPlayerHealth).toBe(30);
    expect(result.labyrinthMap).toBeNull();
    expect(result.wildwoodDraft).toBeNull();
    expect(result.starterDraftChoices).toBeNull();
  });

  it("keeps labyrinth contentSystemType when labyrinthMap is null", () => {
    const input = { ...baseInput(), contentSystemType: "labyrinth" };
    const result = normalizeActiveRunData(input);
    expect(result.contentSystemType).toBe("labyrinth");
  });

  it("clamps player health to maxHealth", () => {
    const input = { ...baseInput(), runPlayerHealth: 50, runMaxHealth: 30 };
    const result = normalizeActiveRunData(input);
    expect(result.runPlayerHealth).toBe(30);
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

  it("nulls wildwood draft outside wildwood runs", () => {
    const input = {
      ...baseInput(),
      contentSystemType: "campaign",
      wildwoodDraft: { version: 3, phase: "draft" },
    };
    const result = normalizeActiveRunData(input);
    expect(result.wildwoodDraft).toBeNull();
  });

  it("nulls starter draft choices on wildwood runs", () => {
    const input = {
      ...baseInput(),
      contentSystemType: "wildwood",
      starterDraftChoices: [{ id: "slash" }],
    };
    const result = normalizeActiveRunData(input);
    expect(result.starterDraftChoices).toBeNull();
  });
});
