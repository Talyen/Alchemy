import type { Page } from "@playwright/test";
import { LCG_INCREMENT, LCG_MULTIPLIER } from "../fixtures/rng";

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
