import { beforeEach, describe, expect, it } from "vitest";
import { readRunAvailableDestinations } from "@/features/alchemy/shell/run-destination-wiring";
import { DESTINATIONS } from "@/lib/routing";
import { resetAllTestStores, setRunProgress } from "../../../helpers/run-domain-store-test";

beforeEach(() => {
  resetAllTestStores();
});

describe("readRunAvailableDestinations", () => {
  it("maps live run, profile gold, and gear reads to the pure helper", () => {
    setRunProgress({
      currentAct: 1,
      destinationIndexInAct: 0,
      completedDestinations: [],
      runPlayerHealth: 30,
      runMaxHealth: 30,
      gold: 100,
    });
    const result = readRunAvailableDestinations();
    expect(result).toContain(DESTINATIONS.NORMAL_COMBAT);
    expect(result).not.toContain(DESTINATIONS.BOSS_COMBAT);
  });

  it("returns only boss combat at the last index in the act", () => {
    setRunProgress({
      currentAct: 1,
      destinationIndexInAct: 7,
      completedDestinations: [],
      runPlayerHealth: 30,
      runMaxHealth: 30,
      gold: 100,
    });
    expect(readRunAvailableDestinations()).toEqual([DESTINATIONS.BOSS_COMBAT]);
  });

  it("forwards destination overrides to the pure helper", () => {
    setRunProgress({
      currentAct: 1,
      destinationIndexInAct: 0,
      completedDestinations: [],
      runPlayerHealth: 30,
      runMaxHealth: 30,
      gold: 100,
    });
    expect(readRunAvailableDestinations({ destinationIndexInAct: 7 })).toEqual([DESTINATIONS.BOSS_COMBAT]);
  });
});
