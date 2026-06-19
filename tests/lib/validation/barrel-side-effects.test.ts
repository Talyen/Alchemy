import { describe, expect, it } from "vitest";

// Barrel files should re-export symbols without executing module-level side effects.
// These tests verify that importing each barrel resolves the expected public API.

describe("@/lib/game-data barrel", () => {
  it("exports known symbols", async () => {
    const mod = await import("@/lib/game-data");
    expect(mod.cardLibrary).toBeDefined();
    expect(mod.enemyBestiary).toBeDefined();
    expect(mod.characters).toBeDefined();
    expect(mod.companionLibrary).toBeDefined();
    expect(mod.keywordDefinitions).toBeDefined();
    expect(mod.trinketLibrary).toBeDefined();
    expect(mod.getStandardPotionPool).toBeTypeOf("function");
    expect(mod.getOfferableCardPool).toBeTypeOf("function");
    expect(mod.isStandardPotionCard).toBeTypeOf("function");
  }, 15_000);
});

describe("@/lib/battle barrel", () => {
  it("exports known symbols", async () => {
    const mod = await import("@/lib/battle");
    expect(mod.createBattleState).toBeTypeOf("function");
    expect(mod.endPlayerTurn).toBeTypeOf("function");
    expect(mod.applyCardEffects).toBeTypeOf("function");
    expect(mod.mergeCombatText).toBeTypeOf("function");
    expect(mod.tickEnemyStatuses).toBeTypeOf("function");
    expect(mod.tickPlayerStatuses).toBeTypeOf("function");
    expect(mod.defaultBattleState).toBeTypeOf("function");
    expect(mod.playBattleCardResolved).toBeTypeOf("function");
    expect(mod.chooseWishCard).toBeTypeOf("function");
  });
});

describe("@/lib/validation barrel", () => {
  it("exports known symbols", async () => {
    const mod = await import("@/lib/validation");
    expect(mod.ActiveRunDataSchema).toBeDefined();
    expect(mod.SaveDataSchema).toBeDefined();
    expect(mod.CURRENT_SAVE_SCHEMA_VERSION).toBeTypeOf("number");
    expect(mod.migrateSaveDataToCurrent).toBeTypeOf("function");
  });
});

describe("@/features/alchemy/shared/screens barrel", () => {
  it("exports known symbols", async () => {
    const mod = await import("@/features/alchemy/shared/screens");
    expect(mod.BattleScreen).toBeDefined();
    expect(mod.MenuScreen).toBeDefined();
    expect(mod.HomesteadScreen).toBeDefined();
    expect(mod.RewardsScreen).toBeDefined();
  }, 15_000);
});

describe("@/features/alchemy/shared/utils barrel", () => {
  it("exports known symbols", async () => {
    const mod = await import("@/features/alchemy/shared/utils");
    expect(mod.sampleItems).toBeTypeOf("function");
    expect(mod.tokenizeDescription).toBeTypeOf("function");
  });
});

describe("@/features/alchemy/shared/storage barrel", () => {
  it("exports known symbols", async () => {
    // Storage module has module-level dependency on window for platform detection.
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = {} as Window & typeof globalThis;
    try {
      const mod = await import("@/features/alchemy/shared/storage");
      expect(mod.loadAlchemySaveState).toBeTypeOf("function");
      expect(mod.saveAlchemySaveData).toBeTypeOf("function");
      expect(mod.clearAlchemySaveData).toBeTypeOf("function");
    } finally {
      (globalThis as Record<string, unknown>).window = origWindow;
    }
  });
});
