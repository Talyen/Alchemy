import { describe, expect, it } from "vitest";
import { createShopActions } from "@/features/alchemy/run-loop/shop/create-shop-actions";
import { createEmptyTalentEffectManifest } from "@/lib/game-data";
import { defaultHomesteadEffects } from "@/lib/homestead/defaults";

describe("createShopActions", () => {
  it("creates the complete shop command set", () => {
    const talentEffects = createEmptyTalentEffectManifest();
    const homesteadEffects = defaultHomesteadEffects;
    const initial = createShopActions({ talentEffects, homesteadEffects });

    expect(initial.merchant.buyCard).toBeTypeOf("function");
    expect(initial.initialize).toBeTypeOf("function");
  });
});
