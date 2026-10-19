import { makeTestCard } from "../fixtures/cards";
import { describe, expect, it } from "vitest";
import { cardById, type BattleCard } from "@/lib/game-data";
import { scoreArchetypeCard, scoreStrategyCard, scoreStrategyKeyword } from "@/app/playthrough/archetype-policy";
import { scoreStarterDraftCard } from "@/app/playthrough/draft-policy";

function card(id: string, tags: BattleCard["tags"]): BattleCard {
  return makeTestCard({ id, title: id, descriptionLines: [], tags });
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

describe("Wildcard starter deck roles", () => {
  it("fills the first Companion and defensive roles before piling on additional attacks", () => {
    const attacks = [cardById.slash!, cardById["concussive-shot"]!];
    const wolf = cardById["wolf-companion"]!;
    const fangs = cardById.fangs!;
    expect(scoreStarterDraftCard("archetype", "wildcard", wolf, attacks)).toBeGreaterThan(
      scoreStarterDraftCard("archetype", "wildcard", fangs, attacks),
    );
    const deck = [...attacks, wolf];
    expect(scoreStarterDraftCard("archetype", "wildcard", cardById.block!, deck)).toBeGreaterThan(
      scoreStarterDraftCard("archetype", "wildcard", fangs, deck),
    );
  });

  it("takes repeatable attacks over another summon in the recorded Companion-heavy draft", () => {
    const deck = [cardById["wolf-companion"]!, cardById["pack-tactics"]!];
    const offers = [cardById["fox-companion"]!, cardById["concussive-shot"]!, cardById["gamblers-shot"]!];
    const before = JSON.stringify({ deck, offers });
    const legacy = offers.map((entry) => scoreStrategyCard("archetype", "wildcard", entry, deck));
    expect(legacy[0]).toBeGreaterThan(Math.max(legacy[1]!, legacy[2]!));
    const scores = offers.map((entry) => scoreStarterDraftCard("archetype", "wildcard", entry, deck));
    expect(scores[1]).toBeGreaterThan(scores[0]!);
    expect(scores[2]).toBeGreaterThan(scores[0]!);
    expect(JSON.stringify({ deck, offers })).toBe(before);
  });

  it("distinguishes recurring attack utility when an offer contains only Companions", () => {
    const deck = ["wolf-companion", "pack-tactics", "fox-companion", "avatar", "pixie-companion"].map(
      (id) => cardById[id]!,
    );
    const gold = cardById["golden-retriever-companion"]!;
    const damage = cardById["phoenix-companion"]!;
    expect(scoreStrategyCard("archetype", "wildcard", gold, deck)).toBe(
      scoreStrategyCard("archetype", "wildcard", damage, deck),
    );
    expect(scoreStarterDraftCard("archetype", "wildcard", damage, deck)).toBeGreaterThan(
      scoreStarterDraftCard("archetype", "wildcard", gold, deck),
    );
  });

  it("preserves other heroes and the random/minimalist controls", () => {
    const deck = [cardById["wolf-companion"]!, cardById["pack-tactics"]!];
    for (const entry of [cardById["fox-companion"]!, cardById["concussive-shot"]!]) {
      for (const policy of ["random", "minimalist"] as const)
        expect(scoreStarterDraftCard(policy, "wildcard", entry, deck)).toBe(
          scoreStrategyCard(policy, "wildcard", entry, deck),
        );
      expect(scoreStarterDraftCard("archetype", "ranger", entry, deck)).toBe(
        scoreStrategyCard("archetype", "ranger", entry, deck),
      );
    }
  });
});
