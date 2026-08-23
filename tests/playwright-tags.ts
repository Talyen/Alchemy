/** CI gate on every push. Covers representative core user paths without the slow tier; live reports own count/timing. */
export const critical = { tag: "@critical" } as const;
/**
 * Fast subset of the CI critical gate for lefthook pre-push (boot + one battle
 * canary). The critical command includes this tag explicitly so Playwright
 * output does not duplicate @critical on pre-push tests.
 */
export const prepush = { tag: "@prepush" } as const;
/** Intentionally slow specs (drag, animation, viewport loops). Not excluded from full E2E; useful for filtering. */
export const slow = { tag: "@slow" } as const;
/** Desktop-only Electron specs excluded from web E2E runs. */
export const desktop = { tag: "@desktop" } as const;
