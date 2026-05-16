import { describe, expect, it, vi } from "vitest";
import { routeDestinationChoice, type DestinationRouteHandlers } from "@/features/alchemy/navigation/routing-flow";
import { DESTINATIONS } from "@/features/alchemy/types";

function makeHandlers(): DestinationRouteHandlers {
  return {
    navigateTo: vi.fn(),
    beginMysteryEvent: vi.fn(),
    resetCorruption: vi.fn(),
    startShop: vi.fn(),
    startAlchemist: vi.fn(),
    startBattle: vi.fn(),
    startBossBattle: vi.fn(),
  };
}

describe("routeDestinationChoice", () => {
  it("routes Campfire to navigateTo campfire", () => {
    const handlers = makeHandlers();
    routeDestinationChoice(DESTINATIONS.CAMPFIRE, handlers);
    expect(handlers.navigateTo).toHaveBeenCalledWith("campfire");
    expect(handlers.startBattle).not.toHaveBeenCalled();
    expect(handlers.startBossBattle).not.toHaveBeenCalled();
  });

  it("routes Merchant Shop to startShop and navigateTo shop", () => {
    const handlers = makeHandlers();
    routeDestinationChoice(DESTINATIONS.MERCHANT_SHOP, handlers);
    expect(handlers.startShop).toHaveBeenCalledOnce();
    expect(handlers.navigateTo).toHaveBeenCalledWith("shop");
    expect(handlers.startBattle).not.toHaveBeenCalled();
  });

  it("routes Alchemist Shop to startAlchemist and navigateTo alchemist", () => {
    const handlers = makeHandlers();
    routeDestinationChoice(DESTINATIONS.ALCHEMIST_SHOP, handlers);
    expect(handlers.startAlchemist).toHaveBeenCalledOnce();
    expect(handlers.navigateTo).toHaveBeenCalledWith("alchemist");
    expect(handlers.startBattle).not.toHaveBeenCalled();
  });

  it("routes Mystery to beginMysteryEvent", () => {
    const handlers = makeHandlers();
    routeDestinationChoice(DESTINATIONS.MYSTERY, handlers);
    expect(handlers.beginMysteryEvent).toHaveBeenCalledOnce();
    expect(handlers.navigateTo).not.toHaveBeenCalled();
    expect(handlers.startBattle).not.toHaveBeenCalled();
  });

  it("routes Corruption to resetCorruption and navigateTo corruption", () => {
    const handlers = makeHandlers();
    routeDestinationChoice(DESTINATIONS.CORRUPTION, handlers);
    expect(handlers.resetCorruption).toHaveBeenCalledOnce();
    expect(handlers.navigateTo).toHaveBeenCalledWith("corruption");
    expect(handlers.startBattle).not.toHaveBeenCalled();
  });

  it("routes Elite Combat to startBattle elite and navigateTo battle", () => {
    const handlers = makeHandlers();
    routeDestinationChoice(DESTINATIONS.ELITE_COMBAT, handlers);
    expect(handlers.startBattle).toHaveBeenCalledWith("elite");
    expect(handlers.navigateTo).toHaveBeenCalledWith("battle");
  });

  it("routes Boss Combat to startBossBattle and navigateTo battle", () => {
    const handlers = makeHandlers();
    routeDestinationChoice(DESTINATIONS.BOSS_COMBAT, handlers);
    expect(handlers.startBossBattle).toHaveBeenCalledOnce();
    expect(handlers.navigateTo).toHaveBeenCalledWith("battle");
    expect(handlers.startBattle).not.toHaveBeenCalled();
  });

  it("routes Normal Combat to startBattle normal and navigateTo battle", () => {
    const handlers = makeHandlers();
    routeDestinationChoice(DESTINATIONS.NORMAL_COMBAT, handlers);
    expect(handlers.startBattle).toHaveBeenCalledWith("normal");
    expect(handlers.navigateTo).toHaveBeenCalledWith("battle");
  });

  it("falls through to normal combat for unknown destinations", () => {
    const handlers = makeHandlers();
    routeDestinationChoice("Unknown Destination" as any, handlers);
    expect(handlers.startBattle).toHaveBeenCalledWith("normal");
    expect(handlers.navigateTo).toHaveBeenCalledWith("battle");
  });
});
