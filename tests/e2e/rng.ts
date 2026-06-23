// Deterministic RNG helpers for E2E destination forcing and seeded flows.
import type { Page } from "@playwright/test";
import { LCG_INCREMENT, LCG_MULTIPLIER } from "../fixtures/rng";
import { DESTINATION_RANDOM_VALUES, type DestinationName } from "./types";

export async function seedRandom(page: Page, seed = 42) {
  await page.addInitScript(
    ({ s, mult, inc }) => {
      let _seed = s;
      Math.random = () => {
        _seed = (_seed * mult + inc) & 0x7fffffff;
        return _seed / 0x7fffffff;
      };
    },
    { s: seed, mult: LCG_MULTIPLIER, inc: LCG_INCREMENT },
  );
}

interface DestinationRngArgs {
  value: number;
  mult: number;
  inc: number;
}

function installDestinationRng({ value, mult, inc }: DestinationRngArgs) {
  let seed = 42;
  window.disableForceDestination = false;
  Math.random = () => {
    if (window.disableForceDestination) {
      seed = (seed * mult + inc) & 0x7fffffff;
      return seed / 0x7fffffff;
    }
    return value;
  };
}

export async function forceNextDestinationChoice(page: Page, destination: DestinationName) {
  const randomValue = DESTINATION_RANDOM_VALUES[destination];
  await page.addInitScript(installDestinationRng, {
    value: randomValue,
    mult: LCG_MULTIPLIER,
    inc: LCG_INCREMENT,
  });
}

/** Pin the next destination roll mid-test (after the page is already loaded). */
export async function pinDestinationChoice(page: Page, destination: DestinationName) {
  const randomValue = DESTINATION_RANDOM_VALUES[destination];
  await page.evaluate(installDestinationRng, {
    value: randomValue,
    mult: LCG_MULTIPLIER,
    inc: LCG_INCREMENT,
  });
}
