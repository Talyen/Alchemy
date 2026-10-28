import { afterEach, expect, it, vi } from "vitest";
import { preloadImagesInBatches, resetImagePreloadCache } from "@/lib/preload";
import { preloadSounds, resetSoundPreloadCache } from "@/lib/audio/preload";
import { isNonPlayerAudioHost } from "@/lib/audio/host";
import { createDesktopSaveBackend } from "@/lib/platform-save-backend";
import { buildWishOptions } from "@/lib/battle/wish";
import * as gameData from "@/lib/game-data";
import { cardLibrary, isCompanionSummonCard } from "@/lib/game-data";
import { SAVE_KEY } from "@/lib/game-constants";
import { patchBattleState } from "../fixtures/battle";
import { createdFakeAudio, installFakeAudio } from "../helpers/fake-audio";

afterEach(() => {
  resetImagePreloadCache();
  resetSoundPreloadCache();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("failed image setup does not reject a startup batch or skip subsequent artwork", async () => {
  let created = 0;
  vi.stubGlobal(
    "Image",
    class extends EventTarget {
      complete = true;
      naturalWidth = 1;
      decoding = "";
      src = "";
      constructor() {
        super();
        if (++created === 1) throw new Error("image setup failed");
      }
      removeAttribute() {}
    },
  );
  const progress = vi.fn();
  await expect(preloadImagesInBatches(["broken.webp", "ready.webp"], 2, progress)).resolves.toBeUndefined();
  expect(created).toBe(2);
  expect(progress).toHaveBeenLastCalledWith(2, 2);
});

it("resetting sound warmup revokes pending handlers and releases their media sources", () => {
  installFakeAudio();
  preloadSounds(["pending.ogg"]);
  const element = createdFakeAudio.find((entry) => entry.preload === "auto")!;
  const late = element.oncanplaythrough;
  resetSoundPreloadCache();
  expect(element.onerror).toBeNull();
  expect(element.oncanplaythrough).toBeNull();
  expect(element.removeAttribute).toHaveBeenCalledWith("src");
  expect(element.load).toHaveBeenCalledOnce();
  late?.();
  expect(element.load).toHaveBeenCalledOnce();
});

it("zero-area windows remain non-player audio hosts when background mute is disabled", () => {
  vi.stubGlobal("window", { innerWidth: 0, innerHeight: 0, outerWidth: 0, outerHeight: 0 });
  vi.stubGlobal("navigator", { webdriver: false, userAgent: "Alchemy browser" });
  expect(isNonPlayerAudioHost()).toBe(true);
});

it("a forced local wipe proceeds even when the Cloud capability probe rejects", async () => {
  const clearSave = vi.fn(async () => true);
  const steamCloudDelete = vi.fn(async (_slot?: "recovery") => true);
  vi.stubGlobal("window", {
    alchemyDesktop: {
      isDesktop: true,
      clearSave,
      steamIsCloudEnabled: async () => {
        throw new Error("Steam unavailable");
      },
      steamCloudDelete,
    },
  });
  const backend = createDesktopSaveBackend();
  await expect(backend.clear(SAVE_KEY)).resolves.toMatchObject({ ok: false });
  expect(clearSave).not.toHaveBeenCalled();
  await expect(backend.clear(SAVE_KEY, { forceLocalWipe: true })).resolves.toEqual({ ok: true });
  expect(clearSave).toHaveBeenCalledOnce();
  expect(steamCloudDelete.mock.calls).toEqual([[], ["recovery"]]);
});

it("Companion-only Wishes recognize nested summons using the canonical detector", () => {
  const summon = cardLibrary.find(isCompanionSummonCard)!;
  const nested = {
    ...summon,
    id: "nested-companion-regression",
    effects: [
      {
        kind: "chance" as const,
        probability: 1,
        successEffects: summon.effects,
        failureEffects: [],
      },
    ],
  };
  vi.spyOn(gameData, "getOfferableCardPoolView").mockReturnValue([nested]);
  const options = buildWishOptions(patchBattleState({ rng: () => 0.99 }), undefined, true);
  expect(options.map((card) => card.id)).toContain(nested.id);
});
