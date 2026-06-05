import { describe, expect, it, vi } from "vitest";
import { getCardKeywords } from "@/lib/game-data";
import { selectRewardCards } from "@/features/alchemy/reward-utils";
import { sampleItems } from "@/features/alchemy/utils";
import type { BattleCard } from "@/lib/game-data";

function card(overrides: Partial<BattleCard> = {}): BattleCard {
  return { id: "test", title: "Test", descriptionLines: [""], art: "", cost: 1, effects: [], ...overrides };
}

describe("getCardKeywords", () => {
  it("extracts damage type keyword", () => {
    const c = card({ effects: [{ kind: "damage", damageType: "physical", amount: 5 }] });
    expect(getCardKeywords(c)).toEqual(["physical"]);
  });

  it("adds leech when damage has lifesteal", () => {
    const c = card({ effects: [{ kind: "damage", damageType: "bleed", amount: 5, lifesteal: true }] });
    const kw = getCardKeywords(c);
    expect(kw).toContain("bleed");
    expect(kw).toContain("leech");
  });

  it("extracts block/armor/forge from player-status effects", () => {
    const c = card({ effects: [{ kind: "player-status", status: "block", amount: 5 }] });
    expect(getCardKeywords(c)).toEqual(["block"]);

    const c2 = card({ effects: [{ kind: "player-status", status: "armor", amount: 1 }] });
    expect(getCardKeywords(c2)).toEqual(["armor"]);

    const c3 = card({ effects: [{ kind: "player-status", status: "forge", amount: 1 }] });
    expect(getCardKeywords(c3)).toEqual(["forge"]);
  });

  it("excludes haste player-status from keywords", () => {
    const c = card({ effects: [{ kind: "player-status", status: "haste", amount: 1 }] });
    expect(getCardKeywords(c)).toEqual([]);
  });

  it("extracts health for heal", () => {
    const c = card({ effects: [{ kind: "heal", amount: 5 }] });
    expect(getCardKeywords(c)).toEqual(["health"]);
  });

  it("extracts mana for restore-mana effects", () => {
    const c = card({ effects: [{ kind: "restore-mana", amount: 2 }] });
    expect(getCardKeywords(c)).toEqual(["mana"]);
  });

  it("extracts mana for lose-mana effects", () => {
    const c = card({ effects: [{ kind: "lose-mana", amount: 1 }] });
    expect(getCardKeywords(c)).toEqual(["mana"]);
  });

  it("extracts mana for lose-max-mana effects", () => {
    const c = card({ effects: [{ kind: "lose-max-mana", amount: 1 }] });
    expect(getCardKeywords(c)).toEqual(["mana"]);
  });

  it("extracts mana for gain-max-mana effects", () => {
    const c = card({ effects: [{ kind: "gain-max-mana", amount: 1 }] });
    expect(getCardKeywords(c)).toEqual(["mana"]);
  });

  it("extracts gold for gain-gold", () => {
    const c = card({ effects: [{ kind: "gain-gold", amount: 4 }] });
    expect(getCardKeywords(c)).toEqual(["gold"]);
  });

  it("extracts wish for wish effects", () => {
    const c = card({ effects: [{ kind: "wish", amount: 1 }] });
    expect(getCardKeywords(c)).toEqual(["wish"]);
  });

  it("extracts companion for summon-companion effects", () => {
    const c = card({ effects: [{ kind: "summon-companion", companionId: "wolf" }] });
    expect(getCardKeywords(c)).toEqual(["companion"]);
  });

  it("does not extract a keyword for remove-harmful-status effects", () => {
    const c = card({ effects: [{ kind: "remove-harmful-status", amount: 1 }] });
    expect(getCardKeywords(c)).toEqual([]);
  });

  it("adds consume keyword for consume cards", () => {
    const c = card({ consume: true, effects: [] });
    expect(getCardKeywords(c)).toEqual(["consume"]);
  });

  it("deduplicates keywords from multiple effects", () => {
    const c = card({ effects: [
      { kind: "damage", damageType: "physical", amount: 5 },
      { kind: "player-status", status: "block", amount: 3 },
    ]});
    const kw = getCardKeywords(c);
    expect(kw).toContain("physical");
    expect(kw).toContain("block");
  });

  it("returns empty array for a card with no keyword-generating effects", () => {
    const c = card({ effects: [] });
    expect(getCardKeywords(c)).toEqual([]);
  });
});

describe("selectRewardCards", () => {
  it("samples from the offerable pool passed by callers", () => {
    const deck: BattleCard[] = [card({ id: "stab", effects: [{ kind: "damage", damageType: "physical", amount: 5 }] })];
    const allCards: BattleCard[] = [
      card({ id: "slash", effects: [{ kind: "damage", damageType: "physical", amount: 5 }] }),
      card({ id: "fireball", effects: [{ kind: "damage", damageType: "burn", amount: 3 }] }),
    ];
    const result = selectRewardCards(deck, allCards, 1);
    expect(result).toHaveLength(1);
    expect(["slash", "fireball"]).toContain(result[0].id);
  });

  it("returns requested count of cards", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const deck: BattleCard[] = [card({ id: "stab", effects: [{ kind: "damage", damageType: "physical", amount: 4 }] })];
    const allCards: BattleCard[] = [
      card({ id: "a", effects: [{ kind: "damage", damageType: "physical", amount: 5 }] }),
      card({ id: "b", effects: [{ kind: "damage", damageType: "burn", amount: 3 }] }),
      card({ id: "c", effects: [{ kind: "heal", amount: 5 }] }),
    ];
    const result = selectRewardCards(deck, allCards, 2);
    expect(result).toHaveLength(2);
    vi.restoreAllMocks();
  });
});

describe("sampleItems for trinket rewards", () => {
  it("returns requested number of trinkets", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const trinkets = [
      { id: "bone-charm", title: "Bone Charm", description: "", art: "" },
      { id: "brass-censer", title: "Brass Censer", description: "", art: "" },
      { id: "tattered-pages", title: "Tattered Pages", description: "", art: "" },
      { id: "meteorite", title: "Meteorite", description: "", art: "" },
    ];
    const result = sampleItems(trinkets, 2);
    expect(result).toHaveLength(2);
    vi.restoreAllMocks();
  });

  it("handles requesting more trinkets than available", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const trinkets = [{ id: "bone-charm", title: "Bone Charm", description: "", art: "" }];
    const result = sampleItems(trinkets, 5);
    expect(result).toHaveLength(1);
    vi.restoreAllMocks();
  });

  it("returns empty array for empty library", () => {
    const result = sampleItems([], 3);
    expect(result).toEqual([]);
  });
});
