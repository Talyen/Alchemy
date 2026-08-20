---
name: unslop
description: Change Discipline & Token Hygiene Auditor. Auto-triggers post-edit when modifying React components, hooks, or TypeScript logic. Enforces minimal diffs, cn() usage, pure/impure separation, React Compiler rules, and strips low-value TSDoc/JSX comment bloat.
---

# Change Discipline & Unslop Audit (Alchemy)

Audit and clean up code diffs against Alchemy's change discipline, token hygiene, and React/TypeScript standards. Ensure diffs are minimal, maintainable, token-efficient, and free of speculative AI boilerplate.

## Trigger Scenarios

Auto-triggers when:

- Authoring or modifying React components/hooks, shared stores/ports, persistence contracts, or other public TypeScript boundaries.
- Reviewing a bounded diff prior to localized test verification or handoff gates. Do not inspect unrelated dirty work.

## Execution Steps

1. **Inspect Diff for AI Anti-Patterns**:
   - Review only changed paths (`git diff -- <path>`, plus explicit untracked files). Enforce [AGENTS.md § UI](../../../AGENTS.md#ui) and [AGENTS.md § Architectural invariants](../../../AGENTS.md#architectural-invariants) on that bounded diff (including `cn()`, no `React.FC`, lazy `useState(() => …)` for cosmetic RNG, and pure/impure separation).

2. **Audit TSDoc Comments & Eliminate Comment Chatter**:
   - Strip TSDoc comments that restate self-documenting TypeScript signatures (e.g. `/** @param name - The name */`).
   - Remove redundant `@returns` tags when return types are explicit and self-explanatory.
   - Delete inline comments that summarize self-evident React or TS code (e.g. `// Render container div`, `// Return true`).
   - Keep comments **only** for subtle business rules, balance formulas, RNG/seed invariants (`state.rng`, `Math.round()`), or save schema migration steps (`MIGRATIONS.md`).
   - Ensure header comments, placeholder boilerplate, and redundant file metadata are removed. Clear symbol naming is preferred over explanatory comments.

3. **Verify Linting & Compiler Rules**:
   - Run ESLint and React Compiler checks:
     ```bash
     npx eslint <changed-paths> --max-warnings=0
     ```
   - Leave full-repository linting to the handoff verifier; do not spend an iteration scanning untouched files.
   - Address any React Compiler lint errors (`react-compiler/react-compiler`) as real quality problems.

4. **Apply Minimal Diff Hierarchy**:
   - Prefer smallest surface area: `delete → reuse → simplify locally → parameterize duplicate → add abstraction` ([docs/Audits/README.md](../../../docs/Audits/README.md) right-size policy).
