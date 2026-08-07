import { describe, expect, it } from "vitest";
import { routeDestinationChoice } from "@/features/alchemy/run-loop/run/run-destination-handlers";
import { DESTINATIONS, type Destination } from "@/features/alchemy/shared/types";
import { makeDestinationRouteDeps } from "../../../../helpers/destination-route-handlers";

const ROUTE_CASES: Array<{
  destination: Destination;
  expectedScreen: string;
  shopKind?: "shop" | "alchemist" | "trinket" | "equipment";
  beginMystery?: boolean;
  resetCorruption?: boolean;
  battleType?: "normal" | "elite";
  bossBattle?: boolean;
}> = [
  { destination: DESTINATIONS.CAMPFIRE, expectedScreen: "campfire" },
  { destination: DESTINATIONS.MERCHANT_SHOP, expectedScreen: "shop", shopKind: "shop" },
  { destination: DESTINATIONS.ALCHEMIST_SHOP, expectedScreen: "alchemist", shopKind: "alchemist" },
  { destination: DESTINATIONS.TRINKET_SHOP, expectedScreen: "trinket-shop", shopKind: "trinket" },
  { destination: DESTINATIONS.EQUIPMENT_SHOP, expectedScreen: "equipment-shop", shopKind: "equipment" },
  { destination: DESTINATIONS.MYSTERY, expectedScreen: "", beginMystery: true },
  { destination: DESTINATIONS.CORRUPTION, expectedScreen: "corruption", resetCorruption: true },
  { destination: DESTINATIONS.ELITE_COMBAT, expectedScreen: "battle", battleType: "elite" },
  { destination: DESTINATIONS.BOSS_COMBAT, expectedScreen: "battle", bossBattle: true },
  { destination: DESTINATIONS.NORMAL_COMBAT, expectedScreen: "battle", battleType: "normal" },
];

describe("routeDestinationChoice", () => {
  it.each(ROUTE_CASES)("routes $destination to the expected screen and handlers", (testCase) => {
    const deps = makeDestinationRouteDeps();
    routeDestinationChoice(testCase.destination, deps);

    if (testCase.beginMystery) {
      expect(deps.beginMysteryEvent).toHaveBeenCalledOnce();
      expect(deps.navigateTo).not.toHaveBeenCalled();
      return;
    }

    expect(deps.navigateTo).toHaveBeenCalledWith(testCase.expectedScreen);
    if (testCase.shopKind) expect(deps.initShop).toHaveBeenCalledWith(testCase.shopKind);
    if (testCase.resetCorruption) expect(deps.resetCorruption).toHaveBeenCalledOnce();
    if (testCase.bossBattle) {
      expect(deps.startBoss).toHaveBeenCalledOnce();
      expect(deps.startBattle).not.toHaveBeenCalled();
    } else if (testCase.battleType) {
      expect(deps.startBattle).toHaveBeenCalledWith({ enemyType: testCase.battleType });
    } else {
      expect(deps.startBattle).not.toHaveBeenCalled();
      expect(deps.startBoss).not.toHaveBeenCalled();
    }
  });

  it("falls through to normal combat for unknown destinations", () => {
    const deps = makeDestinationRouteDeps();
    routeDestinationChoice("Unknown Destination" as unknown as Destination, deps);
    expect(deps.startBattle).toHaveBeenCalledWith({ enemyType: "normal" });
    expect(deps.navigateTo).toHaveBeenCalledWith("battle");
  });
});
