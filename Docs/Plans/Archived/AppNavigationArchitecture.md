---
status: complete
updated: 2026-09-24
---

# App navigation module boundaries

The app navigation hook mixed screen-return policy, keyboard subscriptions, and developer actions. Separating those owners makes a change easier to locate without changing navigation behavior or app-shell imports.

Pure decisions now live in `src/app/screen-navigation-policy.ts`; keyboard and developer actions have their own hooks. The implementation commit includes focused screen-back and keyboard coverage. A formatting issue found during scoped verification was corrected.

Implementation: `c02a7f56`. Current ownership: [Architecture](../../ARCHITECTURE.md).
