# Plans

Use a plan when work benefits from a persistent implementation outline; ordinary
changes do not need one. Keep active execution plans in this directory.

Durable product, architecture,
testing, and workflow rules belong in their canonical owner documents
(`AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/WORKFLOWS.md`, `docs/REFERENCE.md`,
or a subsystem README) — never only in a plan.

Plans require minimal front matter:

- `status: active` (or `blocked`, which also requires `reason`)
- ISO date for `updated`

Use `npm run new:plan -- <PlanName>` to scaffold valid metadata. Use
`npm run plans:check` while working; it warns when a plan has not been updated
recently. `npm run docs:check` adds repository-wide link, path, command, anchor,
and document-reachability contracts.

## Task handoff

1. Mark only the task-owned plan complete or cancelled and refresh its date.
2. Run `npm run archive:plans -- PlanName.md` for that plan (multiple filenames
   are supported). Add `--dry-run` to preview. Without filenames the command
   moves every terminal plan, so use that form only for repository-wide cleanup.
   Update relative links after moving a plan.
3. Confirm your plan is archived and run `npm run docs:check`, or the task-scoped
   `npm run check -- <paths>` that includes it. Include the moved plan and
   updated links in the task-owned paths.

Other tasks' active or blocked plans may remain. Do not mark them finished,
cancel them, or change their metadata to make this task's handoff pass.

`npm run docs:check:final` is a non-mutating, repository-wide closure check that
requires no active plans. Use it only when intentionally closing all plans;
it neither archives plans nor replaces the ordinary task handoff gate.

Archiving remains explicit because tooling cannot reliably infer that
implementation work is finished; CI validates the contract but does not modify
the working tree. Retention rules live in [Archived](./Archived/README.md).
