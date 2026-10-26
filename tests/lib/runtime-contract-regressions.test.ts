import { describe, expect, it, vi } from "vitest";
import { getDifficultyModifiers } from "@/lib/game-data/difficulties";
import { getUniqueAffixes, getUniqueItemDefinition } from "@/lib/gear/unique-catalog";
import { createSessionLifetime } from "@/features/alchemy/shared/stores/session/session-lifetime";
import { SaveStorage } from "@/features/alchemy/shared/storage/save-storage";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { SAVE_RECOVERY_KEY } from "@/lib/game-constants";
import { makeTestCard, regressionBattle } from "../fixtures/battle";

describe("runtime ownership boundaries", () => {
  it("keeps one battle's difficulty edits out of later battles and other heroes", () => {
    const modifiers = getDifficultyModifiers("knight", "difficulty-2");
    const original = structuredClone(modifiers);
    try {
      const health = modifiers.find((modifier) => modifier.kind === "enemy-health-multiplier")!;
      health.amount = 99;
      modifiers.splice(0);
      expect(getDifficultyModifiers("ranger", "difficulty-2")).toEqual(original);
      expect(getDifficultyModifiers("knight", "difficulty-2")).toEqual(original);
    } finally {
      // Keep a failing reproduction from contaminating the remaining tests.
      modifiers.splice(0, modifiers.length, ...original);
    }
  });

  it("keeps Unique definition reads consistent with cached combat affixes", () => {
    const definition = getUniqueItemDefinition("wardbreaker")!;
    const original = structuredClone(definition);
    const affixes = getUniqueAffixes(definition.id)!;
    try {
      definition.signatureAffix.value += 10;
      definition.supportingAffixes[0].value += 10;
      expect(getUniqueItemDefinition(definition.id)).toEqual(original);
      expect(getUniqueAffixes(definition.id)).toEqual(affixes);
    } finally {
      Object.assign(definition, original);
    }
  });

  it("releases each owned registration independently when callbacks are shared", () => {
    const lifetime = createSessionLifetime();
    const cleanup = vi.fn();
    const releaseFirst = lifetime.track(cleanup);
    const releaseSecond = lifetime.track(cleanup);
    releaseFirst();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(lifetime.close()).toEqual([]);
    expect(cleanup).toHaveBeenCalledTimes(2);
    releaseSecond();
    releaseFirst();
    expect(cleanup).toHaveBeenCalledTimes(2);
  });

  it("does not treat incomplete empty save reads as a confirmed new career", async () => {
    const readDemoImportSource = vi.fn(async () => ({
      initialized: true,
      fullSaveExists: false,
      readFailed: false,
      candidates: [],
    }));
    const completeDemoInitialization = vi.fn(async () => true);
    const storage = new SaveStorage({
      readCandidates: async (key) => ({
        ok: true,
        candidates: [],
        ...(key === SAVE_RECOVERY_KEY ? { cloudReadFailed: true } : {}),
      }),
      write: async () => ({ ok: true }),
      writeSync: () => null,
      clear: async () => ({ ok: true }),
      readDemoImportSource,
      completeDemoInitialization,
    });
    expect((await storage.load()).status.kind).toBe("unavailable");
    expect(readDemoImportSource).not.toHaveBeenCalled();
    expect(completeDemoInitialization).not.toHaveBeenCalled();
  });

  it("spends Concussion on the first attack execution without weakening its full-card repeat", () => {
    const card = makeTestCard({
      cost: 0,
      effects: [
        { kind: "damage", damageType: "physical", amount: 4 },
        { kind: "damage", damageType: "physical", amount: 4 },
      ],
    });
    const state = regressionBattle({
      hand: [card],
      enemyHealth: 100,
      enemyMaxHealth: 100,
      flags: { concussionReady: true, playNextCardTwice: true },
    });
    const result = playBattleCardResolved(state, card.id, 0).state;
    expect(result.enemyHealth).toBe(86);
    expect(result.flags.concussionReady).toBe(false);
    expect(result.cardsPlayedThisTurn).toBe(1);
  });
});
