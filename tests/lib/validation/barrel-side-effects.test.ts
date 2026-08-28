import { describe, expect, it } from "vitest";
import * as gameDataBarrel from "@/lib/game-data";
import * as battleBarrel from "@/lib/battle";
import * as validationBarrel from "@/lib/validation";
import * as metaScreensBarrel from "@/features/alchemy/meta/screens";
import * as runLoopScreensBarrel from "@/features/alchemy/run-loop/screens";
import * as sharedUtilsBarrel from "@/features/alchemy/shared/utils";

describe("@/lib/game-data barrel", () => {
  it("exports known symbols", () => {
    expect(gameDataBarrel.cardLibrary).toBeDefined();
    expect(gameDataBarrel.enemyBestiary).toBeDefined();
    expect(gameDataBarrel.characters).toBeDefined();
    expect(gameDataBarrel.companionLibrary).toBeDefined();
    expect(gameDataBarrel.keywordDefinitions).toBeDefined();
    expect(gameDataBarrel.trinketLibrary).toBeDefined();
    expect(gameDataBarrel.selectRewardCards).toBeTypeOf("function");
  });
});

describe("@/lib/battle barrel", () => {
  it("exports known symbols", () => {
    expect(battleBarrel.createBattleState).toBeTypeOf("function");
    expect(battleBarrel.endPlayerTurn).toBeTypeOf("function");
    expect(battleBarrel.applyCardEffects).toBeTypeOf("function");
    expect(battleBarrel.mergeCombatText).toBeTypeOf("function");
    expect(battleBarrel.tickEnemyStatuses).toBeTypeOf("function");
    expect(battleBarrel.tickPlayerStatuses).toBeTypeOf("function");
    expect(battleBarrel.defaultBattleState).toBeTypeOf("function");
    expect(battleBarrel.playBattleCardResolved).toBeTypeOf("function");
    expect(battleBarrel.chooseWishCard).toBeTypeOf("function");
  });
});

describe("@/lib/validation barrel", () => {
  it("exports known symbols", () => {
    expect(validationBarrel.ActiveRunDataSchema).toBeDefined();
    expect(validationBarrel.SaveDataSchema).toBeDefined();
    expect(validationBarrel.CURRENT_SAVE_SCHEMA_VERSION).toBeTypeOf("number");
    expect(validationBarrel.migrateSaveDataToCurrent).toBeTypeOf("function");
  });
});

describe("@/features/alchemy phase screen barrels", () => {
  it("exports known symbols from meta and run-loop barrels", () => {
    expect(metaScreensBarrel.MenuScreen).toBeDefined();
    expect(metaScreensBarrel.HomesteadScreen).toBeDefined();
    expect(runLoopScreensBarrel.BattleScreen).toBeDefined();
    expect(runLoopScreensBarrel.RewardsScreen).toBeDefined();
  });
});

describe("@/features/alchemy/shared/utils barrel", () => {
  it("exports known symbols", () => {
    expect(sharedUtilsBarrel.tokenizeDescription).toBeTypeOf("function");
  });
});

describe("@/features/alchemy/shared/storage barrel", () => {
  it("exports known symbols", async () => {
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
