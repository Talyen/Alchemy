import { describe, expect, it, vi, afterEach } from "vitest";
import {
  advanceDestinationOfferState,
  computeDestinationWeight,
  createEmptyDestinationOfferState,
  getRunAvailableDestinations,
  lastOfferedIncludesCombat,
  restoreOrCreateDestinationRewardState,
  sampleDestinationChoices,
} from "@/features/alchemy/run-loop/navigation/destination-flow";
import { createEmptyRewardState } from "@/features/alchemy/run-loop/navigation/reward-flow";
import {
  DEFAULT_DESTINATION_WEIGHT,
  DESTINATION_PITY_WEIGHT_PER_ROUND,
  LAST_OFFERED_DESTINATION_WEIGHT,
} from "@/lib/game-constants";
import { DESTINATIONS } from "@/features/alchemy/shared/types";

vi.mock("@/lib/routing", async () => {
  const actual = await vi.importActual<typeof import("@/lib/routing")>("@/lib/routing");
  return {
    ...actual,
    getAvailableDestinations: vi.fn(() => [
      DESTINATIONS.NORMAL_COMBAT,
      DESTINATIONS.ELITE_COMBAT,
      DESTINATIONS.MERCHANT_SHOP,
      DESTINATIONS.ALCHEMIST_SHOP,
      DESTINATIONS.MYSTERY,
      DESTINATIONS.CORRUPTION,
      DESTINATIONS.CAMPFIRE,
    ]),
  };
});

const FULL_POOL = [
  DESTINATIONS.NORMAL_COMBAT,
  DESTINATIONS.ELITE_COMBAT,
  DESTINATIONS.MERCHANT_SHOP,
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

afterEach(() => {
  vi.restoreAllMocks();
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
    });
    expect(result.destinations).toEqual([DESTINATIONS.CAMPFIRE, DESTINATIONS.MYSTERY]);
    expect(result.selectedBossId).toBeNull();
  });

  it("samples destinations when none are stored", () => {
    const onSampled = vi.fn();
    const prev = createEmptyRewardState();
    const result = restoreOrCreateDestinationRewardState(prev, {
      availableDestinations: [DESTINATIONS.MERCHANT_SHOP, DESTINATIONS.CAMPFIRE, DESTINATIONS.MYSTERY],
      offerState: createEmptyDestinationOfferState(),
      bossEnemyId: "skeleton",
      onSampled,
    });
    expect(result.destinations.length).toBeGreaterThan(0);
    expect(onSampled).toHaveBeenCalledOnce();
  });
});

describe("sampleDestinationChoices", () => {
  it("returns boss-only choices unchanged", () => {
    const result = sampleDestinationChoices([DESTINATIONS.BOSS_COMBAT], createEmptyDestinationOfferState());
    expect(result.choices).toEqual([DESTINATIONS.BOSS_COMBAT]);
  });

  it("guarantees exactly one combat when the previous screen offered none", () => {
    const result = sampleDestinationChoices([...FULL_POOL], createEmptyDestinationOfferState(), () => 0.99);
    const combatCount = result.choices.filter(
      (destination) => destination === DESTINATIONS.NORMAL_COMBAT || destination === DESTINATIONS.ELITE_COMBAT,
    ).length;
    expect(combatCount).toBe(1);
  });

  it("allows zero combats when the previous screen offered combat", () => {
    let sawZeroCombats = false;
    for (let seed = 0; seed < 40; seed += 1) {
      let i = 0;
      const rng = () => {
        const value = (Math.sin(seed + i++) + 1) / 2;
        return value;
      };
      const result = sampleDestinationChoices(
        [DESTINATIONS.MYSTERY, DESTINATIONS.CAMPFIRE, DESTINATIONS.MERCHANT_SHOP, DESTINATIONS.ALCHEMIST_SHOP],
        {
          lastOfferedDestinations: [DESTINATIONS.NORMAL_COMBAT, DESTINATIONS.MYSTERY, DESTINATIONS.CAMPFIRE],
          roundsSinceOffered: {},
        },
        rng,
      );
      const combatCount = result.choices.filter(
        (destination) => destination === DESTINATIONS.NORMAL_COMBAT || destination === DESTINATIONS.ELITE_COMBAT,
      ).length;
      if (combatCount === 0) {
        sawZeroCombats = true;
        break;
      }
    }
    expect(sawZeroCombats).toBe(true);
  });

  it("never offers more than one shop", () => {
    for (let seed = 0; seed < 50; seed += 1) {
      let i = 0;
      const rng = () => (Math.sin(seed + i++) + 1) / 2;
      const result = sampleDestinationChoices([...FULL_POOL], createEmptyDestinationOfferState(), rng);
      const shopCount = result.choices.filter((destination) =>
        [
          DESTINATIONS.MERCHANT_SHOP,
          DESTINATIONS.ALCHEMIST_SHOP,
          DESTINATIONS.TRINKET_SHOP,
          DESTINATIONS.EQUIPMENT_SHOP,
        ].includes(destination as "Merchant's Shop" | "Alchemist's Shop" | "Trinket Shop" | "Equipment Shop"),
      ).length;
      expect(shopCount).toBeLessThanOrEqual(1);
    }
  });

  it("returns all destinations when fewer than requested count", () => {
    const result = sampleDestinationChoices([DESTINATIONS.NORMAL_COMBAT], createEmptyDestinationOfferState());
    expect(result.choices).toEqual([DESTINATIONS.NORMAL_COMBAT]);
  });

  it("handles empty array", () => {
    const result = sampleDestinationChoices([], createEmptyDestinationOfferState());
    expect(result.choices).toEqual([]);
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
});

describe("lastOfferedIncludesCombat", () => {
  it("detects combat on the previous offer screen", () => {
    expect(lastOfferedIncludesCombat([DESTINATIONS.NORMAL_COMBAT, DESTINATIONS.MYSTERY])).toBe(true);
    expect(lastOfferedIncludesCombat([DESTINATIONS.CAMPFIRE, DESTINATIONS.MYSTERY])).toBe(false);
    expect(lastOfferedIncludesCombat([])).toBe(false);
  });
});
