export const critical = { tag: "@critical" } as const;
/** Fast, high-signal subset for lefthook pre-push (full @critical still runs in CI). */
export const prepush = { tag: "@prepush" } as const;
export const smoke = { tag: "@smoke" } as const;
export const slow = { tag: "@slow" } as const;
export const desktop = { tag: "@desktop" } as const;
