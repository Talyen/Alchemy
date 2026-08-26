/** CI gate on every push. Covers representative core user paths without the slow tier; live reports own count/timing. */
export const critical = { tag: "@critical" } as const;
/**
 * Fast local hook subset: boot, battle animation canary, and SFX smoke.
 * Tag tests individually — a describe-level tag is inherited by every child,
 * including journeys marked @slow or @critical. The critical command includes
 * this tag explicitly so Playwright output does not duplicate @critical on
 * pre-push-only tests.
 */
export const prepush = { tag: "@prepush" } as const;
/** Intentionally slow specs (drag, animation, viewport loops). Not excluded from full E2E; useful for filtering. */
export const slow = { tag: "@slow" } as const;
/** Desktop-only Electron specs excluded from web E2E runs. */
export const desktop = { tag: "@desktop" } as const;
