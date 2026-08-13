import { afterEach, beforeEach } from "vitest";

const DISABLE_ANIMATIONS_KEY = "alchemy-disable-animations";

/** Collapse cosmetic JS delays for behavior tests that do not assert animation timing. */
export function installDisabledAnimationsForTests(): void {
  let previousValue: string | null = null;

  beforeEach(() => {
    previousValue = localStorage.getItem(DISABLE_ANIMATIONS_KEY);
    localStorage.setItem(DISABLE_ANIMATIONS_KEY, "true");
  });

  afterEach(() => {
    if (previousValue === null) localStorage.removeItem(DISABLE_ANIMATIONS_KEY);
    else localStorage.setItem(DISABLE_ANIMATIONS_KEY, previousValue);
  });
}
