import { describe, expect, it, vi } from "vitest";
import {
  advanceDestinationOfferState,
  computeDestinationWeight,
  createEmptyDestinationOfferState,
  createInitialDestinationResult,
  getRunAvailableDestinations,
  restoreOrCreateDestinationRewardState,
  sampleDestinationChoices,
} from "@/features/alchemy/shared/run-flow/destination-flow";
import { createEmptyRewardState } from "@/lib/active-run-session";
import { DESTINATIONS, getAvailableDestinations, isCombatDestination, isShopDestination } from "@/lib/routing";
import { rollFreshBossId } from "@/features/alchemy/shared/config";
import { createRunRngState, createRunStateRng } from "@/lib/rng";

const FULL_POOL = Object.values(DESTINATIONS).filter((id) => id !== DESTINATIONS.BOSS_COMBAT);

describe("destination offers", () => {
  it("uses real eligibility before the boss boundary and prevents consecutive Corruption visits", () => {
    const input = { destinationIndexInAct: 2, currentHealth: 30, currentGold: 100, maxHealth: 30 };
    expect(getRunAvailableDestinations(input)).toEqual(getAvailableDestinations(30, 100, 30));
    expect(getRunAvailableDestinations({ ...input, previousDestination: DESTINATIONS.CORRUPTION })).toEqual(
      getAvailableDestinations(30, 100, 30).filter((id) => id !== DESTINATIONS.CORRUPTION),
    );
    expect(
      getRunAvailableDestinations({ ...input, destinationIndexInAct: 7, currentGold: 0, currentHealth: 1 }),
    ).toEqual([DESTINATIONS.BOSS_COMBAT]);
  });

  it("caps pity, discounts repeated offers, and updates only eligible history without changing the input", () => {
    const history = {
      lastOfferedDestinations: [DESTINATIONS.CAMPFIRE],
      roundsSinceOffered: { [DESTINATIONS.CAMPFIRE]: 2, [DESTINATIONS.MYSTERY]: 999, [DESTINATIONS.GEAR_SHOP]: 8 },
    };
    const before = structuredClone(history);
    expect(computeDestinationWeight(DESTINATIONS.CAMPFIRE, history)).toBeLessThan(
      computeDestinationWeight(DESTINATIONS.CORRUPTION, history),
    );
    expect(computeDestinationWeight(DESTINATIONS.MYSTERY, history)).toBe(
      computeDestinationWeight(DESTINATIONS.MYSTERY, {
        ...history,
        roundsSinceOffered: { [DESTINATIONS.MYSTERY]: 1000 },
      }),
    );
    expect(
      advanceDestinationOfferState(history, [DESTINATIONS.CAMPFIRE, DESTINATIONS.MYSTERY], [DESTINATIONS.CAMPFIRE]),
    ).toEqual({
      lastOfferedDestinations: [DESTINATIONS.CAMPFIRE],
      roundsSinceOffered: { [DESTINATIONS.CAMPFIRE]: 0, [DESTINATIONS.MYSTERY]: 1000, [DESTINATIONS.GEAR_SHOP]: 8 },
    });
    expect(history).toEqual(before);
  });

  it("guarantees one combat after a peaceful offer and caps shops without drawing from an empty pool", () => {
    const rng = vi.fn(() => 0.99);
    const result = sampleDestinationChoices(FULL_POOL, createEmptyDestinationOfferState(), rng);
    expect(result.choices.filter(isCombatDestination)).toEqual([DESTINATIONS.ELITE_COMBAT]);
    expect(result.choices.filter(isShopDestination).length).toBeLessThanOrEqual(1);
    expect(result.choices).toHaveLength(3);
    expect(new Set(result.choices).size).toBe(3);
    expect(result.offerState.lastOfferedDestinations).toEqual(result.choices);
    expect(rng).toHaveBeenCalledTimes(3);

    rng.mockClear();
    const shops = sampleDestinationChoices(
      [DESTINATIONS.NORMAL_COMBAT, DESTINATIONS.CARD_SHOP, DESTINATIONS.ALCHEMIST_SHOP],
      createEmptyDestinationOfferState(),
      rng,
    );
    expect(shops.choices).toEqual([DESTINATIONS.NORMAL_COMBAT, DESTINATIONS.ALCHEMIST_SHOP]);
    expect(rng).toHaveBeenCalledTimes(2);
  });

  it("allows a peaceful offer after combat and deduplicates destinations before advancing history", () => {
    const history = { lastOfferedDestinations: [DESTINATIONS.NORMAL_COMBAT], roundsSinceOffered: {} };
    const result = sampleDestinationChoices(
      [
        DESTINATIONS.MYSTERY,
        DESTINATIONS.MYSTERY,
        DESTINATIONS.CAMPFIRE,
        DESTINATIONS.CARD_SHOP,
        DESTINATIONS.ALCHEMIST_SHOP,
      ],
      history,
      () => 0,
    );
    expect(result.choices).toEqual([DESTINATIONS.MYSTERY, DESTINATIONS.CAMPFIRE, DESTINATIONS.CARD_SHOP]);
    expect(result.offerState.roundsSinceOffered).toEqual({
      Mystery: 0,
      Campfire: 0,
      "Card Shop": 0,
      "Alchemist's Shop": 1,
    });
  });

  it("keeps forced Boss offers and empty pools from consuming world randomness", () => {
    const rng = vi.fn(() => 0.5);
    expect(
      sampleDestinationChoices([DESTINATIONS.BOSS_COMBAT], createEmptyDestinationOfferState(), rng).choices,
    ).toEqual([DESTINATIONS.BOSS_COMBAT]);
    expect(sampleDestinationChoices([], createEmptyDestinationOfferState(), rng).choices).toEqual([]);
    expect(rng).not.toHaveBeenCalled();
  });

  it("preserves a stored offer and its reward payload without resampling", () => {
    const prev = {
      ...createEmptyRewardState([DESTINATIONS.CAMPFIRE, DESTINATIONS.MYSTERY]),
      gold: 17,
      selectedBossId: "stale-boss",
    };
    const rng = vi.fn(() => 0.5);
    const rollBossEnemyId = vi.fn(() => "frostwarden");
    const onSampled = vi.fn();
    expect(
      restoreOrCreateDestinationRewardState(prev, {
        availableDestinations: FULL_POOL,
        offerState: createEmptyDestinationOfferState(),
        rollBossEnemyId,
        rng,
        onSampled,
      }),
    ).toEqual({ ...prev, selectedBossId: null });
    expect(rng).not.toHaveBeenCalled();
    expect(rollBossEnemyId).not.toHaveBeenCalled();
    expect(onSampled).not.toHaveBeenCalled();
    expect(prev.selectedBossId).toBe("stale-boss");
  });

  it("samples a missing offer once and reports the same choices and updated history to its owner", () => {
    const onSampled = vi.fn();
    const rng = vi.fn(() => 0);
    const result = restoreOrCreateDestinationRewardState(createEmptyRewardState(), {
      availableDestinations: [DESTINATIONS.MYSTERY, DESTINATIONS.CAMPFIRE],
      offerState: createEmptyDestinationOfferState(),
      rollBossEnemyId: () => "frostwarden",
      rng,
      onSampled,
    });
    expect(result.destinations).toEqual([DESTINATIONS.MYSTERY, DESTINATIONS.CAMPFIRE]);
    expect(onSampled).toHaveBeenCalledExactlyOnceWith({
      choices: result.destinations,
      offerState: { lastOfferedDestinations: result.destinations, roundsSinceOffered: { Mystery: 0, Campfire: 0 } },
    });
    expect(rng).toHaveBeenCalledTimes(2);
  });

  it.each([
    { offer: DESTINATIONS.NORMAL_COMBAT, worldDraws: 0 },
    { offer: DESTINATIONS.BOSS_COMBAT, worldDraws: 1 },
  ])("draws and preserves a boss preview only for a forced $offer offer", ({ offer, worldDraws }) => {
    const rngState = createRunRngState(42);
    const rollBossEnemyId = () => rollFreshBossId(createRunStateRng(rngState, "world"));
    const options = {
      availableDestinations: [offer],
      offerState: createEmptyDestinationOfferState(),
      rollBossEnemyId,
      rng: () => 0.5,
    };
    const initial = createInitialDestinationResult(options);
    expect(initial.rewardState.destinations).toEqual([offer]);
    expect(rngState.counters.world).toBe(worldDraws);
    expect(Boolean(initial.rewardState.selectedBossId)).toBe(worldDraws === 1);
    expect(restoreOrCreateDestinationRewardState(initial.rewardState, options)).toEqual(initial.rewardState);
    expect(rngState.counters.world).toBe(worldDraws);
    if (offer === DESTINATIONS.BOSS_COMBAT) {
      const repaired = restoreOrCreateDestinationRewardState({ ...initial.rewardState, selectedBossId: null }, options);
      expect(repaired.selectedBossId).toBeTruthy();
      expect(rngState.counters.world).toBe(2);
      expect(restoreOrCreateDestinationRewardState(repaired, options)).toEqual(repaired);
      expect(rngState.counters.world).toBe(2);
    }
  });
});
