import { describe, expect, it } from "vitest";
import { xpForNextPoint, xpThresholdForPoints, computeTalentPoints, xpToNextPoint, extractCardKeywords, addTalentXP } from "@/lib/talents";
import type { BattleCard } from "@/lib/game-data";

describe("xpForNextPoint", () => {
  it("returns 10 XP for point 0→1", () => expect(xpForNextPoint(0)).toBe(10));
  it("returns 20 XP for point 1→2", () => expect(xpForNextPoint(1)).toBe(20));
  it("returns 50 XP for point 4→5", () => expect(xpForNextPoint(4)).toBe(50));
});

describe("xpThresholdForPoints", () => {
  it("returns 0 for 0 points", () => expect(xpThresholdForPoints(0)).toBe(0));
  it("returns 10 for 1 point", () => expect(xpThresholdForPoints(1)).toBe(10));
  it("returns 30 for 2 points", () => expect(xpThresholdForPoints(2)).toBe(30));
  it("returns 60 for 3 points", () => expect(xpThresholdForPoints(3)).toBe(60));
});

describe("computeTalentPoints", () => {
  it("returns 0 for 0 XP", () => expect(computeTalentPoints(0)).toBe(0));
  it("returns 0 for XP below 10", () => expect(computeTalentPoints(9)).toBe(0));
  it("returns 1 for exactly 10 XP", () => expect(computeTalentPoints(10)).toBe(1));
  it("returns 2 for 30 XP", () => expect(computeTalentPoints(30)).toBe(2));
  it("returns 3 for 60 XP", () => expect(computeTalentPoints(60)).toBe(3));
  it("returns 4 for 100 XP", () => expect(computeTalentPoints(100)).toBe(4));
  it("does not go negative", () => expect(computeTalentPoints(-5)).toBe(0));
});

describe("xpToNextPoint", () => {
  it("returns 10 remaining from 0 XP", () => expect(xpToNextPoint(0)).toBe(10));
  it("returns 5 remaining from 5 XP", () => expect(xpToNextPoint(5)).toBe(5));
  it("returns 20 remaining from exactly 10 XP (next threshold is 30)", () => expect(xpToNextPoint(10)).toBe(20));
  it("returns 19 remaining from 11 XP (toward threshold of 30)", () => expect(xpToNextPoint(11)).toBe(19));
});

describe("extractCardKeywords", () => {
  function card(overrides: Partial<BattleCard> = {}): BattleCard {
    return { id: "t", title: "T", descriptionLines: [""], art: "", cost: 1, template: "mechanical", effects: [], ...overrides };
  }

  it("extracts damage type keyword", () => {
    const c = card({ effects: [{ kind: "damage", damageType: "physical", amount: 5 }] });
    expect(extractCardKeywords(c)).toEqual(["physical"]);
  });

  it("adds leech when damage has lifesteal", () => {
    const c = card({ effects: [{ kind: "damage", damageType: "bleed", amount: 5, lifesteal: true }] });
    const kw = extractCardKeywords(c);
    expect(kw).toContain("bleed");
    expect(kw).toContain("leech");
  });

  it("extracts player-status keyword", () => {
    const c = card({ effects: [{ kind: "player-status", status: "block", amount: 5 }] });
    expect(extractCardKeywords(c)).toEqual(["block"]);
  });

  it("extracts health for heal effects", () => {
    const c = card({ effects: [{ kind: "heal", amount: 5 }] });
    expect(extractCardKeywords(c)).toEqual(["health"]);
  });

  it("extracts mana for mana-related effects", () => {
    const c = card({ effects: [{ kind: "restore-mana", amount: 2 }] });
    expect(extractCardKeywords(c)).toEqual(["mana"]);
  });

  it("extracts gold for gain-gold effects", () => {
    const c = card({ effects: [{ kind: "gain-gold", amount: 5 }] });
    expect(extractCardKeywords(c)).toEqual(["gold"]);
  });

  it("extracts wish for wish effects", () => {
    const c = card({ effects: [{ kind: "wish", amount: 1 }] });
    expect(extractCardKeywords(c)).toEqual(["wish"]);
  });

  it("extracts ailment for remove-ailment effects", () => {
    const c = card({ effects: [{ kind: "remove-ailment", mode: "one" }] });
    expect(extractCardKeywords(c)).toEqual(["ailment"]);
  });

  it("extracts consume keyword for consume cards", () => {
    const c = card({ consume: true, effects: [] });
    expect(extractCardKeywords(c)).toEqual(["consume"]);
  });

  it("deduplicates keywords from multiple effects", () => {
    const c = card({ effects: [
      { kind: "damage", damageType: "physical", amount: 5 },
      { kind: "player-status", status: "block", amount: 3 },
    ]});
    const kw = extractCardKeywords(c);
    expect(kw).toContain("physical");
    expect(kw).toContain("block");
  });
});

describe("addTalentXP", () => {
  it("adds XP to a new keyword", () => {
    const result = addTalentXP({}, ["physical"]);
    expect(result.physical).toBe(1);
  });

  it("adds XP to an existing keyword", () => {
    const result = addTalentXP({ physical: 3 }, ["physical"]);
    expect(result.physical).toBe(4);
  });

  it("adds XP to multiple keywords at once", () => {
    const result = addTalentXP({}, ["physical", "burn"]);
    expect(result.physical).toBe(1);
    expect(result.burn).toBe(1);
  });

  it("returns a new object without mutating the input", () => {
    const input = { physical: 1 };
    const result = addTalentXP(input, ["physical"]);
    expect(input).toEqual({ physical: 1 });
    expect(result.physical).toBe(2);
    expect(result).not.toBe(input);
  });
});
