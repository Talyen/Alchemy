# Plans

Use a plan when work benefits from a persistent implementation outline; ordinary
changes do not need one. Keep only active or blocked execution plans here.

Durable product, architecture, testing and workflow rules belong in their
canonical owner document, never only in a plan. Completed task records belong
in the handoff and Git history rather than a checkout archive.

Plans require front matter with `status: active` (or `blocked`, which also
requires `reason`) and an ISO date for `updated`. Use
`npm run new:plan -- <PlanName>` to scaffold metadata. `npm run plans:check`
warns about stale plans; `npm run docs:check` also checks links, paths, commands,
anchors and document reachability.

## Task handoff

1. Move any enduring rules or rationale into their current owner and repair links
   that pointed to the plan. Preserve unresolved work and pending approvals.
2. Mark only task-owned plans complete or cancelled and refresh their date.
3. Run `npm run finish:plans -- PlanName.md` (multiple names are supported).
   `--dry-run` previews deletion. The command requires named terminal plans and
   validates the entire selection before removing any file.
4. Run `npm run docs:check` and the task-scoped `npm run check -- <paths>`, including
   deleted plans and repaired links in the task-owned paths.

Other tasks' active or blocked plans may remain. Do not cancel them or change
their metadata to make a handoff pass. `npm run docs:check:final` is an explicit,
non-mutating repository-wide closure check requiring no active plans. It does
not delete plans or replace ordinary handoff checks.
