import { describe, expect, it, vi } from "vitest";
import {
  advanceDestinationOfferState,
  computeDestinationWeight,
  createDestinationRewardState,
  createEmptyDestinationOfferState,
  getRunAvailableDestinations,
  lastOfferedIncludesCombat,
  restoreOrCreateDestinationRewardState,
  sampleDestinationChoices,
  withSelectedBossForDestinations,
} from "@/features/alchemy/shared/run-flow/destination-flow";
import { createEmptyRewardState } from "@/lib/active-run-session";
import {
  DEFAULT_DESTINATION_WEIGHT,
  DESTINATION_PITY_WEIGHT_PER_ROUND,
  LAST_OFFERED_DESTINATION_WEIGHT,
} from "@/lib/game-constants";
import { DESTINATIONS } from "@/lib/routing";

vi.mock("@/lib/routing", async () => {
  const actual = await vi.importActual<typeof import("@/lib/routing")>("@/lib/routing");
  return {
    ...actual,
    getAvailableDestinations: vi.fn(() => [
      actual.DESTINATIONS.NORMAL_COMBAT,
      actual.DESTINATIONS.ELITE_COMBAT,
      actual.DESTINATIONS.CARD_SHOP,
      actual.DESTINATIONS.ALCHEMIST_SHOP,
      actual.DESTINATIONS.MYSTERY,
      actual.DESTINATIONS.CORRUPTION,
      actual.DESTINATIONS.CAMPFIRE,
    ]),
  };
});

const FULL_POOL = [
  DESTINATIONS.NORMAL_COMBAT,
  DESTINATIONS.ELITE_COMBAT,
  DESTINATIONS.CARD_SHOP,
  DESTINATIONS.ALCHEMIST_SHOP,
  DESTINATIONS.TRINKET_SHOP,
  DESTINATIONS.EQUIPMENT_SHOP,
  DESTINATIONS.MYSTERY,
  DESTINATIONS.CAMPFIRE,
] as const;

describe("getRunAvailableDestinations", () => {
  it("returns only Boss Combat at last index in act", () => {
    const result = getRunAvailableDestinations({
      destinationIndexInAct: 7,
      currentHealth: 30,
      currentGold: 100,
      maxHealth: 30,
    });
    expect(result).toEqual([DESTINATIONS.BOSS_COMBAT]);
  });

  it("returns filtered destinations for non-last positions", () => {
    const result = getRunAvailableDestinations({
      destinationIndexInAct: 2,
      currentHealth: 30,
      currentGold: 100,
      maxHealth: 30,
    });
    expect(result).toContain(DESTINATIONS.NORMAL_COMBAT);
    expect(result).toContain(DESTINATIONS.CORRUPTION);
    expect(result).not.toContain(DESTINATIONS.BOSS_COMBAT);
  });

  it("prevents Corruption after a Corruption destination", () => {
    const result = getRunAvailableDestinations({
      destinationIndexInAct: 2,
      currentHealth: 30,
      currentGold: 100,
      maxHealth: 30,
      previousDestination: DESTINATIONS.CORRUPTION,
    });
    expect(result).not.toContain(DESTINATIONS.CORRUPTION);
  });
});

describe("computeDestinationWeight", () => {
  it("down-weights destinations offered on the previous screen", () => {
    const fresh = computeDestinationWeight(DESTINATIONS.CAMPFIRE, {
      lastOfferedDestinations: [],
      roundsSinceOffered: {},
    });
    const repeated = computeDestinationWeight(DESTINATIONS.CAMPFIRE, {
      lastOfferedDestinations: [DESTINATIONS.CAMPFIRE],
      roundsSinceOffered: {},
    });
    expect(repeated).toBeLessThan(fresh);
    expect(repeated).toBe(LAST_OFFERED_DESTINATION_WEIGHT);
  });

  it("increases weight for destinations not offered recently", () => {
    const base = computeDestinationWeight(DESTINATIONS.MYSTERY, {
      lastOfferedDestinations: [],
      roundsSinceOffered: {},
    });
    const pity = computeDestinationWeight(DESTINATIONS.MYSTERY, {
      lastOfferedDestinations: [],
      roundsSinceOffered: { [DESTINATIONS.MYSTERY]: 3 },
    });
    expect(pity).toBe(base + 3 * DESTINATION_PITY_WEIGHT_PER_ROUND);
  });
});

describe("advanceDestinationOfferState", () => {
  it("increments streaks only for eligible destinations not chosen", () => {
    const next = advanceDestinationOfferState(
      createEmptyDestinationOfferState(),
      [DESTINATIONS.NORMAL_COMBAT, DESTINATIONS.MYSTERY, DESTINATIONS.CAMPFIRE],
      [DESTINATIONS.MYSTERY, DESTINATIONS.CAMPFIRE, DESTINATIONS.NORMAL_COMBAT],
    );
    expect(next.roundsSinceOffered[DESTINATIONS.NORMAL_COMBAT]).toBe(0);
    expect(next.roundsSinceOffered[DESTINATIONS.MYSTERY]).toBe(0);
    expect(next.roundsSinceOffered[DESTINATIONS.CAMPFIRE]).toBe(0);
    expect(next.lastOfferedDestinations).toEqual([
      DESTINATIONS.MYSTERY,
      DESTINATIONS.CAMPFIRE,
      DESTINATIONS.NORMAL_COMBAT,
    ]);
  });

  it("does not increment streak for gated destinations outside the eligible pool", () => {
    const next = advanceDestinationOfferState(
      { lastOfferedDestinations: [], roundsSinceOffered: { [DESTINATIONS.CAMPFIRE]: 2 } },
      [DESTINATIONS.NORMAL_COMBAT, DESTINATIONS.MYSTERY],
      [DESTINATIONS.NORMAL_COMBAT, DESTINATIONS.MYSTERY],
    );
    expect(next.roundsSinceOffered[DESTINATIONS.CAMPFIRE]).toBe(2);
  });
});

describe("restoreOrCreateDestinationRewardState", () => {
  it("keeps existing destinations on resume", () => {
    const prev = createEmptyRewardState([DESTINATIONS.CAMPFIRE, DESTINATIONS.MYSTERY]);
    const result = restoreOrCreateDestinationRewardState(prev, {
      availableDestinations: [DESTINATIONS.NORMAL_COMBAT],
      offerState: createEmptyDestinationOfferState(),
      bossEnemyId: "frostwarden",
      rng: () => 0.5,
    });
    expect(result.destinations).toEqual([DESTINATIONS.CAMPFIRE, DESTINATIONS.MYSTERY]);
    expect(result.selectedBossId).toBeNull();
  });

  it("samples destinations when none are stored", () => {
    const onSampled = vi.fn();
    const prev = createEmptyRewardState();
    const result = restoreOrCreateDestinationRewardState(prev, {
      availableDestinations: [DESTINATIONS.CARD_SHOP, DESTINATIONS.CAMPFIRE, DESTINATIONS.MYSTERY],
      offerState: createEmptyDestinationOfferState(),
      bossEnemyId: "skeleton",
      rng: () => 0.5,
      onSampled,
    });
    expect(result.destinations.length).toBeGreaterThan(0);
    expect(onSampled).toHaveBeenCalledOnce();
  });
});

describe("sampleDestinationChoices", () => {
  it("returns boss-only choices unchanged", () => {
    const result = sampleDestinationChoices([DESTINATIONS.BOSS_COMBAT], createEmptyDestinationOfferState(), () => 0.5);
    expect(result.choices).toEqual([DESTINATIONS.BOSS_COMBAT]);
  });

  it("guarantees exactly one combat when the previous screen offered none", () => {
    const result = sampleDestinationChoices([...FULL_POOL], createEmptyDestinationOfferState(), () => 0.99);
    const combatCount = result.choices.filter(
      (destination) => destination === DESTINATIONS.NORMAL_COMBAT || destination === DESTINATIONS.ELITE_COMBAT,
    ).length;
    expect(combatCount).toBe(1);
    expect(result.choices).toHaveLength(3);
  });

  it("allows zero combats when the previous screen offered combat", () => {
    const result = sampleDestinationChoices(
      [DESTINATIONS.MYSTERY, DESTINATIONS.CAMPFIRE, DESTINATIONS.CARD_SHOP, DESTINATIONS.ALCHEMIST_SHOP],
      {
        lastOfferedDestinations: [DESTINATIONS.NORMAL_COMBAT, DESTINATIONS.MYSTERY, DESTINATIONS.CAMPFIRE],
        roundsSinceOffered: {},
      },
      () => 0,
    );

    expect(result.choices).toEqual([DESTINATIONS.MYSTERY, DESTINATIONS.CAMPFIRE, DESTINATIONS.CARD_SHOP]);
  });

  it("never offers more than one shop when the remaining pool is all shops", () => {
    const result = sampleDestinationChoices(
      [
        DESTINATIONS.NORMAL_COMBAT,
        DESTINATIONS.CARD_SHOP,
        DESTINATIONS.ALCHEMIST_SHOP,
        DESTINATIONS.TRINKET_SHOP,
        DESTINATIONS.EQUIPMENT_SHOP,
      ],
      createEmptyDestinationOfferState(),
      () => 0.5,
    );

    expect(result.choices).toHaveLength(2);
    expect(result.choices.filter((destination) => destination.includes("Shop"))).toHaveLength(1);
  });

  it("returns all destinations when fewer than requested count", () => {
    const result = sampleDestinationChoices(
      [DESTINATIONS.NORMAL_COMBAT],
      createEmptyDestinationOfferState(),
      () => 0.5,
    );
    expect(result.choices).toEqual([DESTINATIONS.NORMAL_COMBAT]);
  });

  it("handles empty array", () => {
    const result = sampleDestinationChoices([], createEmptyDestinationOfferState(), () => 0.5);
    expect(result.choices).toEqual([]);
  });

  it("applies the shop cap even when the input has fewer than three unique destinations", () => {
    const result = sampleDestinationChoices(
      [DESTINATIONS.CARD_SHOP, DESTINATIONS.ALCHEMIST_SHOP, DESTINATIONS.TRINKET_SHOP],
      { lastOfferedDestinations: [DESTINATIONS.NORMAL_COMBAT], roundsSinceOffered: {} },
      () => 0,
    );

    expect(result.choices).toEqual([DESTINATIONS.CARD_SHOP]);
  });

  it("deduplicates malformed input before sampling", () => {
    const result = sampleDestinationChoices(
      [DESTINATIONS.MYSTERY, DESTINATIONS.MYSTERY, DESTINATIONS.CAMPFIRE],
      { lastOfferedDestinations: [DESTINATIONS.NORMAL_COMBAT], roundsSinceOffered: {} },
      () => 0,
    );

    expect(result.choices).toEqual([DESTINATIONS.MYSTERY, DESTINATIONS.CAMPFIRE]);
    expect(result.offerState.roundsSinceOffered).toEqual({
      [DESTINATIONS.MYSTERY]: 0,
      [DESTINATIONS.CAMPFIRE]: 0,
    });
  });

  it("favors high-pity destinations over freshly offered repeats", () => {
    const pityWeight = computeDestinationWeight(DESTINATIONS.MYSTERY, {
      lastOfferedDestinations: [],
      roundsSinceOffered: { [DESTINATIONS.MYSTERY]: 10 },
    });
    const repeatWeight = computeDestinationWeight(DESTINATIONS.CAMPFIRE, {
      lastOfferedDestinations: [DESTINATIONS.CAMPFIRE],
      roundsSinceOffered: {},
    });
    expect(pityWeight).toBeGreaterThan(repeatWeight);
    expect(pityWeight).toBeGreaterThan(DEFAULT_DESTINATION_WEIGHT);
  });

  it("returns DESTINATION_CHOICES entries when the valid pool has enough destinations", () => {
    const result = sampleDestinationChoices([...FULL_POOL], createEmptyDestinationOfferState(), () => 0.5);

    expect(result.choices).toHaveLength(3);
    expect(new Set(result.choices).size).toBe(3);
  });

  it("includes exactly the picked combat when the previous screen had none", () => {
    const result = sampleDestinationChoices([...FULL_POOL], createEmptyDestinationOfferState(), () => 0.99);
    const combats = result.choices.filter(
      (destination) => destination === DESTINATIONS.NORMAL_COMBAT || destination === DESTINATIONS.ELITE_COMBAT,
    );

    expect(combats).toEqual([DESTINATIONS.ELITE_COMBAT]);
    expect(result.choices).toHaveLength(3);
  });
});

describe("lastOfferedIncludesCombat", () => {
  it("detects combat on the previous offer screen", () => {
    expect(lastOfferedIncludesCombat([DESTINATIONS.NORMAL_COMBAT, DESTINATIONS.MYSTERY])).toBe(true);
    expect(lastOfferedIncludesCombat([DESTINATIONS.CAMPFIRE, DESTINATIONS.MYSTERY])).toBe(false);
    expect(lastOfferedIncludesCombat([])).toBe(false);
  });
});

describe("withSelectedBossForDestinations", () => {
  it("sets selectedBossId when only Boss Combat is available", () => {
    const reward = createEmptyRewardState(["Boss Combat"]);
    const result = withSelectedBossForDestinations(["Boss Combat"], reward, "mimic");
    expect(result.selectedBossId).toBe("mimic");
  });

  it("clears selectedBossId when multiple destinations are available", () => {
    const reward = { ...createEmptyRewardState(["Normal Combat", "Campfire"]), selectedBossId: "dragon" };
    const result = withSelectedBossForDestinations(["Normal Combat", "Campfire"], reward);
    expect(result.selectedBossId).toBeNull();
  });

  it("preserves existing selectedBossId for single boss destination", () => {
    const reward = { ...createEmptyRewardState(["Boss Combat"]), selectedBossId: "dragon" };
    const result = withSelectedBossForDestinations(["Boss Combat"], reward, "mimic");
    expect(result.selectedBossId).toBe("dragon");
  });
});

describe("createDestinationRewardState", () => {
  it("returns empty reward state with destinations", () => {
    const result = createDestinationRewardState(["Normal Combat", "Campfire"]);
    expect(result.destinations).toEqual(["Normal Combat", "Campfire"]);
    expect(result.gold).toBe(0);
    expect(result.choices).toEqual([]);
  });

  it("sets selectedBossId for single boss destination", () => {
    const result = createDestinationRewardState(["Boss Combat"], "mimic");
    expect(result.selectedBossId).toBe("mimic");
    expect(result.destinations).toEqual(["Boss Combat"]);
  });
});
