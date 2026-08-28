import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useShopController } from "@/features/alchemy/shell/use-shop-controller";
import { createEmptyTalentEffectManifest } from "@/lib/game-data";
import { defaultHomesteadEffects } from "@/lib/homestead/defaults";

describe("useShopController", () => {
  it("preserves command identities while its inputs are unchanged", () => {
    const talentEffects = createEmptyTalentEffectManifest();
    const homesteadEffects = defaultHomesteadEffects;
    const { result, rerender } = renderHook(() => useShopController({ talentEffects, homesteadEffects }));
    const initial = result.current;

    rerender();

    expect(result.current).toBe(initial);
    expect(result.current.merchant.buyCard).toBe(initial.merchant.buyCard);
    expect(result.current.initialize).toBe(initial.initialize);
  });
});
