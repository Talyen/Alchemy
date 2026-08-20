# Plans

Alchemy's documentation root is lowercase, so the canonical path is
`docs/Plans/` (not a second `Docs/` tree).

Do not keep completed implementation plans or historical rollout records here.
Durable product, architecture, testing, and workflow rules belong in their
canonical owner documents (`AGENTS.md`, `docs/ARCHITECTURE.md`,
`docs/WORKFLOWS.md`, `docs/REFERENCE.md`, or a subsystem README).

This folder holds design reference material and **active agent execution plans**
while work is in flight. Plans require front matter with:

- `type: execution-plan`
- `status: active` or `status: blocked` (`blocked` also requires `reason`)
- ISO dates for `created`, `updated`, and a future `expires`

Use `npm run new:plan -- <PlanName>` to scaffold valid metadata. Use
`npm run docs:check` during work and `npm run docs:check:final` at handoff.
Checks reject missing or malformed metadata, expired plans, and plans marked
`complete` or `cancelled`; final checks reject remaining active plans unless
the intentionally unfinished work is passed with `--keep-plan`.

When a plan is finished, delete it or fold durable rules into the canonical
documentation owner. Do not archive completed plans here: completed work lives
in git history and the handoff/PR summary.
