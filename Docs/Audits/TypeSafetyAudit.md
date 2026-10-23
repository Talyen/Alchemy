# Type Safety Audit

**Goal:** Remove confirmed unsafe typing escapes and dishonest type models without replacing valid invariants with vague fallbacks.

## Intent

Confirm unsafe escapes, unsound generics, broad records, non-exhaustive unions, invalid optional-property bags, or types that disagree with runtime presence. Prefer one validation boundary or an impossible-state model over repeated guards, and follow the model through schemas, callers, fixtures, and tests.

## Hard stops

- Do not add net-new `oxlint-disable` / `@ts-expect-error` without a minimal line-scoped reason.
- Do not chase every `\bany\b` or every `!` — triage by risk and diagnostics.
- Keep Zod/validation at save/load boundaries; do not replace boundary validation with scattered casts.
- Casts on save paths: this audit owns the typing escape; silent failure / corrupt-save behavior belongs to the RuntimeCorrectness audit.
- Do not improve static appearance by widening types, adding optional properties, or inserting runtime fallbacks that make an invalid state easier to represent.

## Investigation and evidence

Trace value origin, runtime validation and consumer assumptions. Show an invalid
value or supported future variant the type wrongly accepts, or an invariant that
repeatedly forces escapes. Fix the producer or validation boundary when possible;
retain justified assertions when TypeScript cannot express a proven relationship.
Intentional negative type tests may use `@ts-expect-error`.

Verify that compilation rejects the invalid construction or requires the missing
variant, and that decoding still enforces the runtime boundary. Preserve valid-save
compatibility and failure semantics. The [shared evidence contract](README.md#discover-and-confirm)
applies to suspicious casts as to other candidates.

## Investigation leads

Prioritize battle, persistence, hydration and screen-transition boundaries. These
signals require a traced invalid value or dishonest invariant under the shared contract.

| Signal                                              | Question and remedy                                                                                                                                                                     |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `any`, double casts, suppressions                   | Does validation establish the claimed type? External/JSON values start as `unknown`; fix the producer/boundary rather than casting. Retain justified directives and negative type tests |
| Non-null assertions (`!.`)                          | Why is the value present? Narrow at its owner or handle absence under the domain contract; optional chaining must not silently discard required work                                    |
| Generic constraints, keyed writes, broad records    | Can an unsupported value reach a consumer? Prefer truthful domain types and narrowing                                                                                                   |
| Boolean/optional-property bags, incomplete switches | Can invalid states be constructed or new variants silently ignored? Prefer discriminated unions and exhaustive consumers                                                                |
| Raw string/enum decoding                            | Do runtime schemas enforce every claimed variant? Keep Zod at save/load boundaries                                                                                                      |
| Fixture casts                                       | Do builders preserve production invariants or expose a deliberate unsafe boundary?                                                                                                      |
| Hard failures                                       | Entrypoints/bootstrap may fail loudly; orchestration validates corrupt external input rather than crashing                                                                              |

`node scripts/audit-type-escapes.mjs` (also `npm run audit:all`) locates category
trends and top files; counts are advisory, never a reduction target or gate.
`@ts-ignore` in `src` is already an Oxlint error. Judge results by truthful
invariants and clearer consumers; compiler/lint gates remain authoritative.
