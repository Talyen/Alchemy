import { afterEach, expect, it, vi } from "vitest";
import { advanceDestinationOfferState } from "@/features/alchemy/shared/run-flow/destination-flow";
import { isInLabyrinthGrid } from "@/lib/content-systems/labyrinth/grid";
import { unpackCatalogs } from "@/lib/localization/catalog-format.mjs";
import { initializeLanguage, setLanguagePreference } from "@/lib/localization/language";
import { localization } from "@/lib/localization/runtime";
import { createRunRngState, createRunStateRng, createRunStreamRng } from "@/lib/rng";
import { DESTINATIONS } from "@/lib/routing/destinations";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

it("keeps the newest Steam detection when initialization requests complete out of order", async () => {
  const requests: Array<(language: string) => void> = [];
  vi.stubGlobal("alchemyDesktop", {
    steamGetGameLanguage: () =>
      new Promise<string>((resolve) => {
        requests.push(resolve);
      }),
  });
  setLanguagePreference("auto");
  const older = initializeLanguage();
  const newer = initializeLanguage();
  requests[1]!("french");
  await newer;
  requests[0]!("german");
  await older;
  setLanguagePreference("auto");
  expect(localization.language).toBe("fr");
});

it("keeps a saturated destination counter valid across repeated offers", () => {
  const campfire = DESTINATIONS.CAMPFIRE;
  const state = { lastOfferedDestinations: [], roundsSinceOffered: { [campfire]: Number.MAX_SAFE_INTEGER } };
  const next = advanceDestinationOfferState(state, [campfire], []);
  expect(next.roundsSinceOffered[campfire]).toBe(Number.MAX_SAFE_INTEGER);
  expect(advanceDestinationOfferState(next, [campfire], []).roundsSinceOffered[campfire]).toBe(Number.MAX_SAFE_INTEGER);
});

it("only accepts whole positions in the Labyrinth grid", () => {
  expect(isInLabyrinthGrid({ row: 1, col: -1 })).toBe(true);
  expect(isInLabyrinthGrid({ row: 1.5, col: 0 })).toBe(false);
  expect(isInLabyrinthGrid({ row: 1, col: 0.5 })).toBe(false);
});

it("rejects non-finite standalone run seeds like the persisted RNG", () => {
  for (const seed of [NaN, Infinity, -Infinity]) {
    expect(() => createRunStreamRng(seed)).toThrow(/finite seed/);
    expect(() => createRunRngState(seed)).toThrow(/finite seed/);
  }
  const state = createRunRngState(12.5);
  expect(createRunStreamRng(12.5)()).toBe(createRunStateRng(state, "world")());
});

it("rejects blank English alias overrides before installing a catalog", () => {
  const bundle = {
    version: 1,
    languages: ["en"],
    messages: { base: ["Base"] },
    aliases: { alias: { id: "base", english: "  " } },
  };
  expect(() => unpackCatalogs(bundle)).toThrow(/Invalid bundled localization alias/);
});
