import { describe, expect, it } from "vitest";
import { routeDestinationChoice } from "@/features/alchemy/run-loop/run/run-destination-handlers";
import { DESTINATIONS, type Destination } from "@/features/alchemy/shared/types";
import { makeDestinationRouteHandlers } from "../../helpers/destination-route-handlers";

const ROUTE_CASES: {
  destination: Destination;
  expectedScreen: string;
  startShop?: boolean;
  startAlchemist?: boolean;
  startTrinketShop?: boolean;
  startEquipmentShop?: boolean;
  beginMystery?: boolean;
  resetCorruption?: boolean;
  battleType?: "normal" | "elite";
  bossBattle?: boolean;
}[] = [
  { destination: DESTINATIONS.CAMPFIRE, expectedScreen: "campfire" },
  { destination: DESTINATIONS.MERCHANT_SHOP, expectedScreen: "shop", startShop: true },
  { destination: DESTINATIONS.ALCHEMIST_SHOP, expectedScreen: "alchemist", startAlchemist: true },
  { destination: DESTINATIONS.TRINKET_SHOP, expectedScreen: "trinket-shop", startTrinketShop: true },
  { destination: DESTINATIONS.EQUIPMENT_SHOP, expectedScreen: "equipment-shop", startEquipmentShop: true },
  { destination: DESTINATIONS.MYSTERY, expectedScreen: "", beginMystery: true },
  { destination: DESTINATIONS.CORRUPTION, expectedScreen: "corruption", resetCorruption: true },
  { destination: DESTINATIONS.ELITE_COMBAT, expectedScreen: "battle", battleType: "elite" },
  { destination: DESTINATIONS.BOSS_COMBAT, expectedScreen: "battle", bossBattle: true },
  { destination: DESTINATIONS.NORMAL_COMBAT, expectedScreen: "battle", battleType: "normal" },
];

describe("routeDestinationChoice", () => {
  it.each(ROUTE_CASES)("routes $destination to the expected screen and handlers", (testCase) => {
    const handlers = makeDestinationRouteHandlers();
    routeDestinationChoice(testCase.destination, handlers);

    if (testCase.beginMystery) {
      expect(handlers.beginMysteryEvent).toHaveBeenCalledOnce();
      expect(handlers.navigateTo).not.toHaveBeenCalled();
      return;
    }

    expect(handlers.navigateTo).toHaveBeenCalledWith(testCase.expectedScreen);
    if (testCase.startShop) expect(handlers.startShop).toHaveBeenCalledOnce();
    if (testCase.startAlchemist) expect(handlers.startAlchemist).toHaveBeenCalledOnce();
    if (testCase.startTrinketShop) expect(handlers.startTrinketShop).toHaveBeenCalledOnce();
    if (testCase.startEquipmentShop) expect(handlers.startEquipmentShop).toHaveBeenCalledOnce();
    if (testCase.resetCorruption) expect(handlers.resetCorruption).toHaveBeenCalledOnce();
    if (testCase.bossBattle) {
      expect(handlers.startBossBattle).toHaveBeenCalledOnce();
      expect(handlers.startBattle).not.toHaveBeenCalled();
    } else if (testCase.battleType) {
      expect(handlers.startBattle).toHaveBeenCalledWith(testCase.battleType);
    } else {
      expect(handlers.startBattle).not.toHaveBeenCalled();
      expect(handlers.startBossBattle).not.toHaveBeenCalled();
    }
  });

  it("falls through to normal combat for unknown destinations", () => {
    const handlers = makeDestinationRouteHandlers();
    routeDestinationChoice("Unknown Destination" as unknown as Destination, handlers);
    expect(handlers.startBattle).toHaveBeenCalledWith("normal");
    expect(handlers.navigateTo).toHaveBeenCalledWith("battle");
  });
});
