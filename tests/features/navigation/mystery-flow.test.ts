import { describe, expect, it, vi, beforeEach } from "vitest";
import { applyMysteryEffect, getMysteryCardPool, addCardToRun } from "@/features/alchemy/navigation/mystery-flow";

const mockSetRunDeck = vi.fn();
const mockSetRunGold = vi.fn();
const mockSetRunPlayerHealth = vi.fn();
const mockSetRunTrinkets = vi.fn();
const mockSetDiscoveredCardIds = vi.fn();
const mockSetDiscoveredTrinketIds = vi.fn();
const mockSetMysteryCardChoices = vi.fn();
const mockAwardMysteryXP = vi.fn();
const mockOnAddMaterials = vi.fn();
const mockOnAwardGold = vi.fn();

const context = {
  runMaxHealth: 30,
  setRunDeck: mockSetRunDeck,
  setRunGold: mockSetRunGold,
  setRunPlayerHealth: mockSetRunPlayerHealth,
  setRunTrinkets: mockSetRunTrinkets,
  setDiscoveredCardIds: mockSetDiscoveredCardIds,
  setDiscoveredTrinketIds: mockSetDiscoveredTrinketIds,
  setMysteryCardChoices: mockSetMysteryCardChoices,
  awardMysteryXP: mockAwardMysteryXP,
  onAddMaterials: mockOnAddMaterials,
  onAwardGold: mockOnAwardGold,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("applyMysteryEffect", () => {
  it("dispatches addCard for addCard effect", () => {
    const result = applyMysteryEffect({ kind: "addCard", cardId: "fireball" }, context);
    expect(result.followUp).toBeNull();
    expect(mockSetRunDeck).toHaveBeenCalledOnce();
    expect(mockSetDiscoveredCardIds).toHaveBeenCalledOnce();
  });

  it("dispatches healHP with amount", () => {
    const result = applyMysteryEffect({ kind: "healHP", amount: 5 }, context);
    expect(result.followUp).toBeNull();
    expect(mockSetRunPlayerHealth).toHaveBeenCalledOnce();
  });

  it("healHP with chance high enough heals", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.3);
    const result = applyMysteryEffect({ kind: "healHP", amount: 10, chance: 0.5 }, context);
    expect(result.followUp).toBeNull();
    expect(mockSetRunPlayerHealth).toHaveBeenCalledOnce();
    vi.restoreAllMocks();
  });

  it("healHP with chance too low does not heal", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    const result = applyMysteryEffect({ kind: "healHP", amount: 10, chance: 0.5 }, context);
    expect(result.followUp).toBeNull();
    expect(mockSetRunPlayerHealth).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("dispatches damageHP with amount", () => {
    const result = applyMysteryEffect({ kind: "damageHP", amount: 8 }, context);
    expect(result.followUp).toBeNull();
    expect(mockSetRunPlayerHealth).toHaveBeenCalledOnce();
  });

  it("dispatches gainGold via onAwardGold", () => {
    const result = applyMysteryEffect({ kind: "gainGold", amount: 15 }, context);
    expect(result.followUp).toBeNull();
    expect(mockOnAwardGold).toHaveBeenCalledWith(15);
  });

  it("dispatches loseGold", () => {
    const result = applyMysteryEffect({ kind: "loseGold", amount: 10 }, context);
    expect(result.followUp).toBeNull();
    expect(mockSetRunGold).toHaveBeenCalledOnce();
  });

  it("gainMaxMana returns false without side effects", () => {
    const result = applyMysteryEffect({ kind: "gainMaxMana" }, context);
    expect(result.followUp).toBeNull();
    expect(mockSetRunDeck).not.toHaveBeenCalled();
  });

  it("dispatches gainXP", () => {
    const result = applyMysteryEffect({ kind: "gainXP", keyword: "physical", amount: 5 }, context);
    expect(result.followUp).toBeNull();
    expect(mockAwardMysteryXP).toHaveBeenCalledWith("physical", 5);
  });

  it("dispatches gainTrinket", () => {
    const result = applyMysteryEffect({ kind: "gainTrinket", trinketId: "bone-charm" }, context);
    expect(result.followUp).toBeNull();
    expect(mockSetRunTrinkets).toHaveBeenCalledOnce();
    expect(mockSetDiscoveredTrinketIds).toHaveBeenCalledOnce();
  });

  it("dispatches gainMaterial", () => {
    const result = applyMysteryEffect({ kind: "gainMaterial", material: "wood", amount: 3 }, context);
    expect(result.followUp).toBeNull();
    expect(mockOnAddMaterials).toHaveBeenCalledOnce();
  });

  it("chooseCard returns true to pause for UI", () => {
    const result = applyMysteryEffect({ kind: "chooseCard" }, context);
    expect(result.followUp).toBe("choose-card");
    expect(mockSetMysteryCardChoices).toHaveBeenCalledOnce();
  });

  it("none effect returns false", () => {
    const result = applyMysteryEffect({ kind: "none" }, context);
    expect(result.followUp).toBeNull();
  });
});

describe("getMysteryCardPool", () => {
  it("excludes mixed-potion from card pool", () => {
    const pool = getMysteryCardPool();
    expect(pool.find((c) => c.id === "mixed-potion")).toBeUndefined();
  });

  it("returns at least some cards", () => {
    const pool = getMysteryCardPool();
    expect(pool.length).toBeGreaterThan(0);
  });
});

describe("addCardToRun", () => {
  it("appends card to deck and updates discovered IDs", () => {
    const card = { id: "fireball", title: "Fireball", descriptionLines: [""], art: "", cost: 2, template: "mechanical" as const, effects: [] };
    const deckSetter = vi.fn();
    const discoverySetter = vi.fn();

    addCardToRun(card, { setRunDeck: deckSetter, setDiscoveredCardIds: discoverySetter });

    const deckUpdater = deckSetter.mock.calls[0][0];
    expect(deckUpdater([{ id: "stab" }])).toEqual([{ id: "stab" }, card]);

    const discUpdater = discoverySetter.mock.calls[0][0];
    expect(discUpdater(["stab"])).toEqual(["stab", "fireball"]);
  });
});
