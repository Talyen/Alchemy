---
name: unslop
description: Bounded changed-diff quality review. Auto-triggers post-edit for React/TypeScript logic and public boundaries; removes speculative boilerplate and checks only changed paths.
---

# Bounded changed-diff review

## Trigger

Use after editing React/TypeScript logic or a public boundary. Review only changed paths and explicit untracked files; never scan unrelated dirty work.

## Steps

1. Inspect the bounded diff for accidental fan-out, copied logic, speculative abstraction, and unrelated cleanup.
2. Remove comments/TSDoc that restate names or types. Keep only subtle gameplay, RNG, save, or compatibility rationale.
3. Rely on ESLint for mechanical React/UI/compiler rules; fix its findings rather than copying those rules here.
4. Prefer `delete → reuse → local simplify → parameterize proven duplication → abstraction`.
5. Hand the changed paths to `verifier`; this skill does not own verification commands.
