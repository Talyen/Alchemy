/** CI gate on every push (~60-80 tests, ≤3 min). Covers core user paths per area without slow tests. */
export const critical = { tag: "@critical" } as const;
/**
 * Fast subset of @critical for lefthook pre-push (boot + one battle canary).
 * Always includes @critical so @prepush ⊆ @critical.
 */
export const prepush = { tag: ["@critical", "@prepush"] } as const;
/** Quick boot/menu checks (alchemy boot + electron boot). */
export const smoke = { tag: "@smoke" } as const;
/** Intentionally slow specs (drag, animation, viewport loops). Not excluded from full E2E; useful for filtering. */
export const slow = { tag: "@slow" } as const;
/** Desktop-only Electron specs excluded from web E2E runs. */
export const desktop = { tag: "@desktop" } as const;
/** Armory screen / gear interaction specs. Overlaps with critical and slow on per-test basis. */
export const armory = { tag: "@armory" } as const;
