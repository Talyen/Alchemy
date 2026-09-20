import { describe, expect, it } from "vitest";
import type { BattleCard } from "@/lib/game-data";
import { scoreArchetypeCard, scoreStrategyCard, scoreStrategyKeyword } from "@/app/playthrough/archetype-policy";

function card(id: string, tags: BattleCard["tags"]): BattleCard {
  return {
    id,
    title: id,
    descriptionLines: [],
    art: "",
    cost: 1,
    tags,
    effects: [],
  };
}

describe("adaptive archetype policy", () => {
  it("uses current deck synergy as Wildcard's fallback signal", () => {
    const poison = card("poison", ["poison"]);
    const burn = card("burn", ["burn"]);

    expect(scoreArchetypeCard("wildcard", poison, [poison])).toBeGreaterThan(
      scoreArchetypeCard("wildcard", burn, [poison]),
    );
  });

  it("uses immediate utility while Wildcard has no established deck profile", () => {
    const lowUtility = card("low-utility", []);
    const directDamage = card("direct-damage", []);
    directDamage.effects = [{ kind: "damage", damageType: "physical", amount: 10 }];

    expect(scoreArchetypeCard("wildcard", directDamage, [])).toBeGreaterThan(
      scoreArchetypeCard("wildcard", lowUtility, []),
    );
  });

  it("avoids exhausting a blank-slate deck with consumables", () => {
    const reusable = card("reusable", []);
    const consumable = card("consumable", []);
    consumable.consume = true;

    expect(scoreArchetypeCard("wildcard", reusable, [])).toBeGreaterThan(
      scoreArchetypeCard("wildcard", consumable, []),
    );
  });

  it("preserves hero affinity while adding deck-conditioned scoring", () => {
    const block = card("block", ["block"]);
    const burn = card("burn", ["burn"]);

    expect(scoreArchetypeCard("knight", block, [])).toBeGreaterThan(scoreArchetypeCard("knight", burn, []));
    expect(scoreStrategyCard("minimalist", "knight", block, [burn])).toBe(1);
    expect(scoreStrategyKeyword("archetype", "knight", "block", [])).toBeGreaterThan(
      scoreStrategyKeyword("archetype", "knight", "burn", []),
    );
  });
});
