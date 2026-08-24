# Plans

Keep active execution plans in this directory. Durable product, architecture,
testing, and workflow rules belong in their canonical owner documents
(`AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/WORKFLOWS.md`, `docs/REFERENCE.md`,
or a subsystem README) — never only in a plan.

Plans require minimal front matter:

- `status: active` (or `blocked`, which also requires `reason`)
- ISO date for `updated`

Use `npm run new:plan -- <PlanName>` to scaffold valid metadata. Use
`npm run plans:check` while working; it warns when a plan has not been updated
recently. `npm run docs:check` adds repository-wide link, path, command, anchor,
and document-reachability contracts. When the work ends, update its date and set
`status: complete` (or `cancelled`), then run `npm run docs:check:final`. The
command automatically moves terminal plans into [`Archived/`](./Archived/) and
requires no active plans to remain.

`npm run archive:plans` performs only the archive step when final handoff is not
yet appropriate. Automation remains explicit because tooling cannot reliably
infer that implementation work is finished; CI validates the contract but does
not modify the working tree.
