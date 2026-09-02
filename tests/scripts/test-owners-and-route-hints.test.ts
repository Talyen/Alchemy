import { describe, expect, it } from "vitest";
import { formatRouteHintLine, routeHintForPath } from "../../scripts/lib/route-hints.mjs";

describe("route hints", () => {
  it("names only the retained save-focused E2E from changed paths", () => {
    const save = routeHintForPath("src/features/alchemy/shared/storage/io.ts");
    expect(save.focusedE2E).toContain("save");
    expect(formatRouteHintLine(save)).toContain("CI focused E2E: save");

    const shop = routeHintForPath("src/features/alchemy/run-loop/screens/alchemist-shop-screen.tsx");
    expect(shop.focusedE2E).toEqual([]);

    const shopDomain = routeHintForPath("src/features/alchemy/run-loop/shop/create-shop-actions.ts");
    expect(shopDomain.focusedE2E).toEqual([]);
  });
});
