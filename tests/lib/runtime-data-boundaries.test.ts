import { afterEach, expect, it, vi } from "vitest";
import { createMusicPlayer } from "@/lib/audio/music-player";
import { createSfxPlayer } from "@/lib/audio/sfx-player";
import { MUSIC_KEYS } from "@/lib/game-constants";
import { EMPTY_CRAFTING_CURRENCIES, normalizeCraftingCurrencies } from "@/lib/gear/crafting-ids";
import { normalizeGearInstance } from "@/lib/gear/instance-normalization";
import { registerErrorSink } from "@/lib/error-logger";
import { SaveOperationQueue } from "@/features/alchemy/shared/storage/save-operation-queue";
import { logStorageFailure } from "@/lib/storage-logging";
import { isRecord } from "@/lib/utils";
import { createFakeAudioElement } from "../helpers/fake-audio";
import { cardHasKeyword, isCompanionSummonCard, isEnemyAbilityCard } from "@/lib/game-data";
import { cardHasDamageType } from "@/lib/battle/card-classification";
import { makeTestCard } from "../fixtures/cards";

afterEach(() => vi.restoreAllMocks());

it("recomputes classifications when an owned effect tree changes, including below a frozen outer array", () => {
  const card = makeTestCard({
    effects: [{ kind: "chance", probability: 0.5, successEffects: [{ kind: "heal", amount: 1 }], failureEffects: [] }],
  });
  Object.freeze(card.effects);
  expect(cardHasKeyword(card, "burn")).toBe(false);
  expect(cardHasDamageType(card, "burn")).toBe(false);
  expect(isCompanionSummonCard(card)).toBe(false);
  expect(isEnemyAbilityCard(card)).toBe(true);
  const branch = card.effects[0]!;
  if (branch.kind !== "chance") throw new Error("Expected chance wrapper");
  branch.successEffects.push(
    { kind: "damage", damageType: "burn", amount: 1 },
    { kind: "summon-companion", companionId: "wolf" },
  );
  expect(cardHasKeyword(card, "burn")).toBe(true);
  expect(cardHasDamageType(card, "burn")).toBe(true);
  expect(isCompanionSummonCard(card)).toBe(true);
  expect(isEnemyAbilityCard(card)).toBe(false);
});

it("gear normalization rejects inherited item identities and accepts plain dictionaries", () => {
  const item = { instanceId: "owned-item", definitionId: "ruby-ring-basic", affixes: [] };
  const inherited: unknown = Object.create(item);
  expect(isRecord(inherited)).toBe(false);
  expect(normalizeGearInstance(inherited)).toBeNull();
  expect(normalizeGearInstance(item)).toEqual(item);
  const dictionary: unknown = Object.assign(Object.create(null) as object, item);
  expect(isRecord(dictionary)).toBe(true);
  expect(normalizeGearInstance(dictionary)).toEqual(item);
});

it("shared currency defaults cannot contaminate later balances", () => {
  const changed = Reflect.set(EMPTY_CRAFTING_CURRENCIES, "voidstone", 9);
  const next = normalizeCraftingCurrencies(null);
  // Restore the old implementation's global before reporting the regression.
  if (changed) Reflect.set(EMPTY_CRAFTING_CURRENCIES, "voidstone", 0);
  expect(changed).toBe(false);
  expect(next.voidstone).toBe(0);
});

it("unreadable storage exceptions still reach diagnostics without aborting recovery", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const sink = vi.fn();
  const release = registerErrorSink(sink);
  const unreadable = Object.create(null) as Record<string | symbol, unknown>;
  for (const key of ["name", "message", "toJSON", Symbol.toStringTag]) {
    Object.defineProperty(unreadable, key, {
      get() {
        throw new Error("detached error wrapper");
      },
    });
  }
  try {
    expect(() => logStorageFailure("Storage unavailable", unreadable)).not.toThrow();
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ source: "storage" }));
    const queue = new SaveOperationQueue();
    const result = await queue.enqueueLoad(async () => {
      logStorageFailure("Storage unavailable", unreadable);
      return "recovered";
    });
    expect(result).toBe("recovered");
    expect(await queue.enqueueLoad(async () => "next load")).toBe("next load");
  } finally {
    release();
  }
});

it("one failed timer cancellation cannot leave peer sound cues alive after reset", () => {
  const element = createFakeAudioElement();
  const createElement = vi.fn(() => element);
  const pending: Array<() => void> = [];
  const cancel = vi.fn().mockImplementationOnce(() => {
    throw new Error("timer cancellation failed");
  });
  const player = createSfxPlayer({
    createElement,
    readSettings: () => ({ muted: false, sfxVolume: 1, masterVolume: 1 }),
    now: () => 0,
    schedule: (callback) => {
      pending.push(callback);
      return pending.length as unknown as ReturnType<typeof setTimeout>;
    },
    cancel,
  });
  player.play("delayed", { delay: 1 });
  player.play("active");
  player.play("later", { delay: 2 });
  expect(() => player.reset()).not.toThrow();
  expect(element.pause).toHaveBeenCalledOnce();
  expect(cancel).toHaveBeenCalledTimes(2);
  for (const callback of pending) callback();
  expect(createElement).toHaveBeenCalledOnce();
});

it("a failed outgoing pause cannot block the next music track or leave both tracks audible", () => {
  const elements: Array<ReturnType<typeof createFakeAudioElement>> = [];
  const player = createMusicPlayer({
    createElement: (file) => {
      const element = createFakeAudioElement(file);
      elements.push(element);
      return element;
    },
    selectFile: (files) => files[0],
    readSettings: () => ({ musicVolume: 1, masterVolume: 1, muted: false }),
    canPlay: () => true,
    now: () => 0,
    schedule: (callback, delay) => setInterval(callback, delay),
    cancel: clearInterval,
    reportFailure: vi.fn(),
  });
  try {
    player.playMusicImmediate(MUSIC_KEYS.MENU);
    elements[0]!.pause.mockImplementationOnce(() => {
      throw new Error("detached media");
    });
    expect(() => player.playMusicImmediate(MUSIC_KEYS.BATTLE)).not.toThrow();
    expect(elements[0]!.muted).toBe(true);
    expect(elements[1]!.paused).toBe(false);
    expect(player.readMusicPlayback()).toMatchObject({ key: MUSIC_KEYS.BATTLE, audible: true });
  } finally {
    player.reset();
  }
});
