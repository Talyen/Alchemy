# Unsafe Escape Audit

**Goal:** Remove confirmed unsafe typing escapes in non-test, non-generated source without replacing valid invariants with vague fallbacks.

## Intent

Find unsafe escapes via TypeScript/ESLint output and targeted probes. Prefer one validation boundary (Zod) or an impossible-state model over repeated call-site guards and fallbacks. Write a plan to fix all identified unsafe typing escapes (breaking into phases if the scope is large); a clean pass is valid, and significant typing seams remain proposals.

## Hard stops

- Do not add net-new `eslint-disable` / `@ts-expect-error` without a minimal line-scoped reason.
- Do not chase every `\bany\b` or every `!` — triage from probes and diagnostics.
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

## Probe hints

- **`any`:** `rg -n '\bany\b' src --type ts -g '!*.test.*' -g '!*.spec.*'`
- **Suppressions & double casts:** `rg -n '@ts-ignore|@ts-expect-error|eslint-disable|as unknown as' src`
- **Non-null assertions:** `rg -n '!\.' src --type ts -g '!*.test.*'`
- **Unsafe assertions on persistence/battle:** focus hits in `src/features/alchemy/shared/storage/`, `src/lib/validation/save-schemas/`, `run-transitions.ts`, `src/lib/battle`
- **Raw enum / string decoding:** stringly unions without Zod or exhaustive checks at hydrate boundaries
