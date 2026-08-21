# 15. Type Safety Audit

**Goal:** Remove confirmed unsafe typing escapes and dishonest type models without replacing valid invariants with vague fallbacks.

## Intent

Confirm unsafe escapes, unsound generics, broad records, non-exhaustive unions, invalid optional-property bags, or types that disagree with runtime presence. Prefer one validation boundary or an impossible-state model over repeated guards, and follow the model through schemas, callers, fixtures, and tests.

## Hard stops

- Do not add net-new `eslint-disable` / `@ts-expect-error` without a minimal line-scoped reason.
- Do not chase every `\bany\b` or every `!` — triage by risk and diagnostics.
- Keep Zod/validation at save/load boundaries; do not replace boundary validation with scattered casts.
- Casts on save paths: this audit owns the typing escape; silent failure / corrupt-save behavior belongs to the RuntimeCorrectness audit.
- Do not improve static appearance by widening types, adding optional properties, or inserting runtime fallbacks that make an invalid state easier to represent.

## Triage

| Priority | Examples                                                                                    |
| -------- | ------------------------------------------------------------------------------------------- |
| P0       | `as` / non-null on save, hydrate, or battle outcome paths; `as unknown as` on orchestration |
| P1       | Non-null assertion that can throw on empty/corrupt data                                     |
| P2       | `@ts-ignore` / broad `eslint-disable` hiding real mismatches                                |
| P3       | Style-only `any` / disable churn — skip unless trivial                                      |

## Domain rules

- Prefer type guards, narrowing, and discriminated unions over `as` casts.
- Replace `@ts-ignore` / `@ts-expect-error` by fixing the underlying mismatch; surviving suppresses must be line-scoped with reason.
- Replace non-null assertions (`!.`) with explicit null checks or optional chaining.
- Module / bootstrap entrypoints may keep hard failures; orchestration should not crash on corrupt input — validate at the boundary.
- `any` mainly at serialization edges; validate decoded saves via Zod schemas — not runtime casts after the fact.
- External and JSON data is `unknown` until a boundary validates it; types must not claim fields or variants that decoding does not establish.
- Prefer exhaustive switches and domain-specific unions over string bags, broad `Record<string, unknown>`, and boolean/optional-property combinations.
- Test builders used to create production state must preserve production invariants or deliberately expose an explicitly unsafe fixture boundary.
- Targets (directional, not absolute gates): `any` → 0 in non-test `src`; `@ts-expect-error` / `as unknown as` trending to 0; `!.` ≤ ~1 per 500 LOC.

## Known signals

- **Trend counts:** `node scripts/audit-type-escapes.mjs` (also via `npm run audit:all`) — per-category counts and top files; compare against the previous run to keep the directional targets ratcheting downward. Never a gate.
- **`any`:** `\bany\b` in non-test `src`.
- **Suppressions & double casts:** `@ts-ignore` / `@ts-expect-error` / `eslint-disable` / `as unknown as`.
- **Non-null assertions:** `!.` in non-test `src`.
- **Unsafe assertions on persistence/battle:** hits in `shared/storage/`, `save-schemas/`, `run-transitions.ts`, `src/lib/battle`.
- **Raw enum / string decoding:** stringly unions without Zod or exhaustive checks at hydrate boundaries.
- **Unsound generic/record models:** generic constraints, keyed writes, index signatures, or broad records permit values the runtime owner cannot handle.
- **Invalid-state bags:** several optional properties or booleans encode mutually exclusive modes without a discriminant.
- **Non-exhaustive consumption:** switches or lookup tables silently accept new variants without a compiler-enforced owner.
- **Dishonest external types:** JSON, storage, IPC, or environment values are asserted directly to a domain type without validation.
- **Fixture escapes:** shared test builders cast partial objects into production state and can conceal invalid states used by live orchestration tests.
