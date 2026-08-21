# Plans

Keep active execution plans in this directory. Durable product, architecture,
testing, and workflow rules belong in their canonical owner documents
(`AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/WORKFLOWS.md`, `docs/REFERENCE.md`,
or a subsystem README) — never only in a plan.

Plans require minimal front matter:

- `status: active` (or `blocked`, which also requires `reason`)
- ISO date for `updated`

Use `npm run new:plan -- <PlanName>` to scaffold valid metadata. Use
`npm run docs:check` while working; it warns when a plan has not been updated
recently. When the work ends, simply **delete the plan file** — git history
retains it — then run `npm run docs:check:final`, which requires none to
remain.
