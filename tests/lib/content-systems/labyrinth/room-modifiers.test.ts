import { describe, expect, it } from "vitest";
import {
  ENCOUNTER_TRAITS,
  eligibleEncounterTraitIds,
  sanitizeEncounterTraitIds,
} from "@/lib/content-systems/encounter-traits";
import { LABYRINTH_TRAITS } from "@/lib/content-systems/labyrinth/trait-catalog";
import {
  isLabyrinthTraitEligible,
  areLabyrinthTraitsCompatible,
  getEnemyModifiersForNodeType,
  getRewardModifiersForNodeType,
} from "@/lib/content-systems/labyrinth/modifiers";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";
import { LABYRINTH_SUPPORT_TYPES } from "@/lib/content-systems/labyrinth/data";
import {
  activeLabyrinthBenefits,
  applyLabyrinthMysteryModifiers,
  isLabyrinthMysteryEligible,
  labyrinthCampfireHealing,
} from "@/lib/content-systems/labyrinth/room-rules";
import { LabyrinthMapSchema } from "@/lib/validation/save-schemas/labyrinth-schemas";
import { keywordDefinitions, trinketLibrary } from "@/lib/game-data";
import { findMysteryEvent, mysteryPool, pickResolvedMysteryEvent } from "@/lib/mystery";
import { emptyHydratedMysteryVisit, hydrateMysteryVisit, serializeMysteryVisit } from "@/lib/active-run-session";
import { getCompanionCardChoices } from "@/features/alchemy/run-loop/navigation/reward-flow";
import { getCardKeywords } from "@/lib/game-data/keywords";
import { seededRng } from "../../../fixtures/rng";

describe("Labyrinth modifier catalog", () => {
  it("keeps new descriptions short and player-facing", () => {
    for (const trait of Object.values(LABYRINTH_TRAITS)) {
      expect(trait.description.split(/\s+/).length, trait.label).toBeLessThanOrEqual(10);
      expect(trait.description, trait.label).not.toMatch(/\b(keyword|both|numerical)\b/i);
    }
    expect(LABYRINTH_TRAITS["strong-spirits"].description).toBe("Offered Potions have doubled potency");
  });

  it("covers all registered themes", () => {
    const covered = new Set(Object.values(LABYRINTH_TRAITS).map((trait) => trait.keyword));
    expect([...covered].sort()).toEqual(Object.keys(keywordDefinitions).sort());
  });

  it("offers a positive modifier for each playable node without cross-room leakage", () => {
    for (const type of ["combat", "elite", "boss", ...LABYRINTH_SUPPORT_TYPES] as const) {
      for (let seed = 0; seed < 30; seed++) {
        const mods = getRewardModifiersForNodeType(seededRng(seed), type);
        expect(mods).toHaveLength(1);
        expect(isLabyrinthTraitEligible(mods[0]!, type)).toBe(true);
        expect(ENCOUNTER_TRAITS[mods[0]!].category).toBe("reward");
      }
    }
    expect(getRewardModifiersForNodeType(seededRng(1), "entrance")).toEqual([]);
  });

  it("preserves old saved modifiers but excludes them from new Labyrinth rooms", () => {
    const legacy = [
      "septic",
      "caustic",
      "flesheater",
      "thorns",
      "insatiable",
      "jealous",
      "rooted",
      "divine-aegis",
    ] as const;
    expect(sanitizeEncounterTraitIds(legacy, "combat")).toEqual(legacy);
    for (const id of [...legacy, "wealthy"] as const) expect(isLabyrinthTraitEligible(id, "combat")).toBe(false);
    expect(eligibleEncounterTraitIds("wildwood", "combat")).toContain("septic");
    expect(eligibleEncounterTraitIds("wildwood", "combat")).not.toContain("unbreakable");
  });

  it("avoids duplicate labels and effects in each active pool", () => {
    for (const type of ["combat", "elite", "boss", ...LABYRINTH_SUPPORT_TYPES] as const) {
      const traits = Object.values(ENCOUNTER_TRAITS).filter((trait) => isLabyrinthTraitEligible(trait.id, type));
      expect(new Set(traits.map((trait) => trait.label)).size).toBe(traits.length);
      expect(new Set(traits.map((trait) => trait.description)).size).toBe(traits.length);
    }
  });

  it("excludes overlapping modifiers and duplicates of native enemy traits", () => {
    expect(areLabyrinthTraitsCompatible("plated", "unbreakable")).toBe(false);
    expect(areLabyrinthTraitsCompatible("thornhide", "briar-crown")).toBe(false);
    for (let seed = 0; seed < 100; seed++) {
      const mods = getEnemyModifiersForNodeType("boss", seededRng(seed), ["tempered", "vampire"]);
      expect(mods).toHaveLength(2);
      expect(mods).not.toContain("tempered");
      expect(mods).not.toContain("whitehot");
      expect(mods).not.toContain("ravenous");
      expect(areLabyrinthTraitsCompatible(mods[0]!, mods[1]!)).toBe(true);
    }
  });

  it("round-trips new support and combat modifiers in generated maps", () => {
    const map = generateLabyrinthMap(seededRng(28));
    expect(LabyrinthMapSchema.parse(JSON.parse(JSON.stringify(map)))).toEqual(map);
    for (const node of Object.values(map.nodes)) {
      if (node.type !== "entrance") expect(node.rewardModifiers).toHaveLength(1);
    }
  });

  it("omits unsupported themed Trinket shops", () => {
    const healing = trinketLibrary.filter((item) =>
      item.descriptionLines.join(" ").match(/(?:Restore|Gain) \d+ Health/),
    );
    expect(healing).toHaveLength(2);
    expect(trinketLibrary.filter((item) => item.descriptionLines.join(" ").includes("Archery"))).toHaveLength(0);
    expect(Object.values(LABYRINTH_TRAITS).map((item) => item.label)).not.toContain("Mercy Charms");
    expect(Object.values(LABYRINTH_TRAITS).map((item) => item.label)).not.toContain("Hunter’s Charms");
  });
});

describe("Labyrinth support rules", () => {
  it("ignores inactive modifiers in Campaign and Wildwood", () => {
    expect(activeLabyrinthBenefits("campaign", ["bargain-bin"])).toEqual([]);
    expect(activeLabyrinthBenefits("wildwood", ["strong-spirits"])).toEqual([]);
  });

  it("keeps Campfire healing bounded while applying room and talent bonuses", () => {
    expect(labyrinthCampfireHealing(0.4, ["deep-rest"])).toBe(0.8);
    expect(labyrinthCampfireHealing(0.6, ["deep-rest"])).toBe(1);
    expect(labyrinthCampfireHealing(0.3, ["healing-spring"])).toBe(1);
  });

  it.each(["golden-omen", "bountiful", "enlightening"] as const)(
    "%s only selects events with a matching reward",
    (id) => {
      const eligible = mysteryPool.filter((event) => isLabyrinthMysteryEligible(event, [id]));
      expect(eligible.length).toBeGreaterThan(0);
      for (let seed = 0; seed < 20; seed++) {
        const event = pickResolvedMysteryEvent(seededRng(seed), [], (candidate) =>
          isLabyrinthMysteryEligible(candidate, [id]),
        );
        expect(eligible.map((item) => item.id)).toContain(event.id);
      }
    },
  );

  it("Mystery descriptions and rewards survive resume without doubling twice", () => {
    const original = findMysteryEvent("ancient-altar")!;
    const event = applyLabyrinthMysteryModifiers(original, ["golden-omen"], 30);
    const goldChoice = event.choices.find((choice) => choice.effects.some((effect) => effect.kind === "gainGold"))!;
    expect(goldChoice.effects).toContainEqual({ kind: "gainGold", amount: 40 });
    const saved = serializeMysteryVisit({
      ...emptyHydratedMysteryVisit(),
      mysteryEvent: event,
      mysteryChosenChoice: goldChoice,
    });
    const restored = hydrateMysteryVisit(saved, { modifiers: ["golden-omen"], maxHealth: 30 });
    expect(restored.mysteryEvent).toEqual(event);
    expect(restored.mysteryChosenChoice).toEqual(goldChoice);
    const again = hydrateMysteryVisit(serializeMysteryVisit(restored), { modifiers: ["golden-omen"], maxHealth: 30 });
    expect(again).toEqual(restored);
    expect(original.choices.flatMap((choice) => choice.effects)).toContainEqual({ kind: "gainGold", amount: 20 });
  });

  it.each([
    ["fletched", "archery"],
    ["wishkeeper", "wish"],
    ["kindred-spoils", "nature"],
  ] as const)("%s uses the existing bonus card reward with matching cards", (id, theme) => {
    const cards = getCompanionCardChoices(seededRng(17), [id]);
    expect(cards).toHaveLength(3);
    expect(cards.every((card) => getCardKeywords(card).includes(theme))).toBe(true);
  });
});
