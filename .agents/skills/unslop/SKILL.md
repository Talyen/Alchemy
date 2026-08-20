---
name: unslop
description: Change Discipline & Token Hygiene Auditor. Auto-triggers post-edit when modifying React components, hooks, or TypeScript logic. Enforces minimal diffs, cn() usage, pure/impure separation, React Compiler rules, and strips low-value TSDoc/JSX comment bloat.
---

# Change Discipline & Unslop Audit (Alchemy)

Audit and clean up code diffs against Alchemy's Change Discipline, token hygiene, and React/TypeScript standards. Ensure diffs are minimal, maintainable, token-efficient, and free of speculative AI boilerplate.

## Trigger Scenarios

Auto-triggers when:

- Authoring or modifying `.ts` or `.tsx` files.
- Code edits or new React components/hooks have been generated or written.
- Reviewing diffs prior to localized test verification or handoff gates.

## Execution Steps

1. **Inspect Diff for AI Anti-Patterns**:
   - Review active diff (`git diff HEAD`) and enforce Alchemy UI & architectural rules:
     - **Tailwind Class Concatenation**: Ensure conditional styles use `cn(...)` from `@/lib/utils`. No string template literals in `className`.
     - **Component Props & Functions**: Use plain function components with explicit `Props` types (`function MyComponent(props: Props)`), **never** `React.FC`.
     - **State & Memoization Discipline**: Initialize cosmetic randomness lazily via `useState(() => ...)`. Avoid speculative `useMemo` for cheap calculations.
     - **Pure / Impure Separation**: Keep pure logic out of screens/components and side effects out of pure modules.

2. **Audit TSDoc Comments & Eliminate Comment Chatter**:
   - Strip TSDoc comments that restate self-documenting TypeScript signatures (e.g. `/** @param name - The name */`).
   - Remove redundant `@returns` tags when return types are explicit and self-explanatory.
   - Delete inline comments that summarize self-evident React or TS code (e.g. `// Render container div`, `// Return true`).
   - Keep comments **only** for subtle business rules, balance formulas, RNG/seed invariants (`state.rng`, `Math.round()`), or save schema migration steps (`MIGRATIONS.md`).
   - Ensure header comments, placeholder boilerplate, and redundant file metadata are removed. Clear symbol naming is preferred over explanatory comments.

3. **Verify Linting & Compiler Rules**:
   - Run ESLint and React Compiler checks:
     ```bash
     npm run lint
     ```
   - Address any React Compiler lint errors (`react-compiler/react-compiler`) as real quality problems.

4. **Apply Minimal Diff Hierarchy**:
   - Prefer smallest surface area: `delete → reuse → simplify locally → parameterize duplicate → add abstraction`.
