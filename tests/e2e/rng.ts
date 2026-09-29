import type { Page } from "@playwright/test";

const LCG_MULTIPLIER = 1664525;
const LCG_INCREMENT = 1013904223;

export async function seedRandom(page: Page, seed = 42) {
  await page.addInitScript(
    ({ s, mult, inc }) => {
      let _seed = s;
      const nextWord = () => {
        _seed = (_seed * mult + inc) & 0x7fffffff;
        return _seed;
      };
      Math.random = () => nextWord() / 0x7fffffff;
      if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
        crypto.getRandomValues = ((array: ArrayBufferView) => {
          const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
          for (let i = 0; i < view.length; i++) {
            view[i] = nextWord() & 0xff;
          }
          return array;
        }) as typeof crypto.getRandomValues;
      }
    },
    { s: seed, mult: LCG_MULTIPLIER, inc: LCG_INCREMENT },
  );
}
