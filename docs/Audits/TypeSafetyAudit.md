# Unsafe Escape Audit

**Goal:** Remove confirmed unsafe typing escapes in non-test, non-generated source without replacing valid invariants with vague fallbacks.

## Intent

Find unsafe escapes and fix them. Prefer one validation boundary (Zod) or an impossible-state model over repeated call-site guards and fallbacks. A clean pass is valid; significant typing seams remain proposals. If the scope is large, phase the plan.

## Hard stops

- Do not add net-new `eslint-disable` / `@ts-expect-error` without a minimal line-scoped reason.
- Do not chase every `\bany\b` or every `!` — triage by risk and diagnostics.
- Keep Zod/validation at save/load boundaries; do not replace boundary validation with scattered casts.
- Casts on save paths: this audit owns the typing escape; silent failure / corrupt-save behavior belongs to `BehaviorHardeningAudit.md`.

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
- Targets (directional, not absolute gates): `any` → 0 in non-test `src`; `@ts-expect-error` / `as unknown as` trending to 0; `!.` ≤ ~1 per 500 LOC.

## Known signals

Optional discovery aids — choose your own probes.

- **`any`:** `\bany\b` in non-test `src`.
- **Suppressions & double casts:** `@ts-ignore` / `@ts-expect-error` / `eslint-disable` / `as unknown as`.
- **Non-null assertions:** `!.` in non-test `src`.
- **Unsafe assertions on persistence/battle:** hits in `shared/storage/`, `save-schemas/`, `run-transitions.ts`, `src/lib/battle`.
- **Raw enum / string decoding:** stringly unions without Zod or exhaustive checks at hydrate boundaries.
