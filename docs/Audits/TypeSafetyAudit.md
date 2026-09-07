# Type Safety Audit

**Goal:** Remove confirmed unsafe typing escapes and dishonest type models without replacing valid invariants with vague fallbacks.

## Intent

Confirm unsafe escapes, unsound generics, broad records, non-exhaustive unions, invalid optional-property bags, or types that disagree with runtime presence. Prefer one validation boundary or an impossible-state model over repeated guards, and follow the model through schemas, callers, fixtures, and tests.

## Hard stops

- Do not add net-new `eslint-disable` / `@ts-expect-error` without a minimal line-scoped reason.
- Do not chase every `\bany\b` or every `!` — triage by risk and diagnostics.
- Keep Zod/validation at save/load boundaries; do not replace boundary validation with scattered casts.
- Casts on save paths: this audit owns the typing escape; silent failure / corrupt-save behavior belongs to the RuntimeCorrectness audit.
- Do not improve static appearance by widening types, adding optional properties, or inserting runtime fallbacks that make an invalid state easier to represent.

## Investigation and evidence

For an escape or suspect model, trace where the value originates, what runtime validation establishes, and what consumers assume. Show a value or future supported variant the type accepts incorrectly, or an invariant the model repeatedly forces callers to bypass. A cast on a critical path warrants inspection, not automatic severity.

Prefer a remedy at the producer or validation boundary when that establishes the invariant for all consumers. Keep a justified assertion when TypeScript cannot express a proven relationship and alternatives obscure it. Negative type tests may intentionally use `@ts-expect-error`; removing them would weaken coverage.

Verify the compiler rejects the invalid construction or requires handling the relevant variant, and verify runtime decoding still enforces the same boundary. Type checking alone cannot establish safe handling of external input. Preserve valid-save compatibility and existing failure semantics.

## Domain rules

- Prefer type guards, narrowing, and discriminated unions over `as` casts.
- Fix mismatches hidden by suppressions when they are unsound; retain intentional negative type tests and justified tool directives under repository rules.
- Establish why a value is present before removing a non-null assertion. Narrow at the owner or handle absence according to the domain contract; optional chaining that silently drops required work is not a fix.
- Module / bootstrap entrypoints may keep hard failures; orchestration should not crash on corrupt input — validate at the boundary.
- `any` mainly at serialization edges; validate decoded saves via Zod schemas — not runtime casts after the fact.
- External and JSON data is `unknown` until a boundary validates it; types must not claim fields or variants that decoding does not establish.
- Prefer exhaustive switches and domain-specific unions over string bags, broad `Record<string, unknown>`, and boolean/optional-property combinations.
- Test builders used to create production state must preserve production invariants or deliberately expose an explicitly unsafe fixture boundary.
- Judge success by stronger truthful invariants and clearer consumers, not declining escape counts. Enforced compiler and lint gates remain authoritative.

## Known signals

- **Trend counts:** `node scripts/audit-type-escapes.mjs` (also via `npm run audit:all`) — per-category counts and top files; use counts to locate changes worth inspecting, not to demand a downward trend. Never a gate.
- **`any`:** `\bany\b` in non-test `src`.
- **Suppressions & double casts:** `@ts-expect-error` / `eslint-disable` / `as unknown as`. `@ts-ignore` in `src` is an ESLint error (`@typescript-eslint/ban-ts-comment`).
- **Non-null assertions:** `!.` in non-test `src`.
- **Unsafe assertions on persistence/battle:** hits in `shared/storage/`, `save-schemas/`, `screen-transition-policy.ts`, `use-screen-transitions.ts`, battle transition modules, and `src/lib/battle`.
- **Raw enum / string decoding:** stringly unions without Zod or exhaustive checks at hydrate boundaries.
- **Unsound generic/record models:** generic constraints, keyed writes, index signatures, or broad records permit values the runtime owner cannot handle.
- **Invalid-state bags:** several optional properties or booleans encode mutually exclusive modes without a discriminant.
- **Non-exhaustive consumption:** switches or lookup tables silently accept new variants without a compiler-enforced owner.
- **Dishonest external types:** JSON, storage, IPC, or environment values are asserted directly to a domain type without validation.
- **Fixture escapes:** shared test builders cast partial objects into production state and can conceal invalid states used by live orchestration tests.
