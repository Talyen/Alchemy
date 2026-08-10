# CI fixer bot

Solo trunk workflow: agents push `main` after local `pre-push`; GitHub Actions is the comprehensive post-push gate; the Cursor CI fixer automation recovers red `main` without blocking direct pushes.

Live automation (Cursor Automations UI): `20a432b2-8f93-11f1-a7d1-d6b4613131ce`. Keep that prompt in sync with the **Automation prompt** section below when policy changes.

## Gate model

| Path                  | Policy                                                                                                                                                                        |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Direct push to `main` | Allowed. Do **not** require `ci-ok` as a push gate (chicken-and-egg). Local `pre-push` + post-push CI.                                                                        |
| Merge PR into `main`  | Require status check **`CI OK`**. Admin bypass exists so owners/agents can still push trunk directly; the Cursor App is not bypassed, so fixer auto-merge waits for green CI. |
| Fixer merge method    | Enable squash **auto-merge** only (`gh pr merge --auto --squash`). Never `--admin`, never force-merge.                                                                        |

See also [CONTRIBUTING.md § Before you push](../CONTRIBUTING.md#before-you-push).

## Tiers

### Tier A — open PR and auto-merge

Safe, mechanical recoveries:

- Format / Prettier
- TypeScript / typecheck
- ESLint / import boundaries
- Knip unused exports/files
- Mechanical test or assertion drift after renames/API shape changes
- **Tooling-only Vitest timeouts** under `tests/scripts/` (audit/script smoke tests) and other known script timeouts — prefer narrowing the smoke window or speeding the script; dedicated higher timeout only with a clear rationale. Do **not** skip the test.

### Tier B — escalate, do not open a fix PR

- Product / battle rules / game balance
- Saves, migrations, schema, mid-combat resume
- Unclear root cause
- Flaky E2E without a mechanical selector/copy fix
- Infrastructure outages (Actions unavailable) — note re-run; no code change

### Out of scope (never)

- Skipping tests or deleting coverage to greenwash
- Weakening assertions to match broken behavior
- Changing game logic, battle rules, or save formats to silence CI

## Tier B fingerprint dedupe

Mirror the nightly open-or-update pattern (label + single sticky issue):

1. Derive a stable **fingerprint** from failing job names + primary error signature (file + message class), e.g. `ci-fail-CIOK_test` + `change-amplification-audit timeout`.
2. Search open issues with label `ci-autofix-failed` whose title/body match that fingerprint.
3. **If found:** comment with the new Actions run URL, commit SHA, and any new notes — then **stop**.
4. **If not found:** create one issue labeled `ci-autofix-failed` with run URL, SHA, failing jobs, why it is Tier B, and suggested human/agent follow-up.

Do not open a new issue per SHA for the same fingerprint.

## Automation prompt

Copy everything in this section into the Cursor automation instructions when updating the live bot.

```text
You are the Alchemy CI fixer for repo Talyen/Alchemy.

When CI fails on main:
1. Read the failing run logs and classify Tier A vs Tier B using docs/CI-FIXER.md (checked in).
2. Tier A: branch from the failing main SHA, apply the minimal fix, open a squash PR, enable auto-merge only (`gh pr merge --auto --squash`). Never --admin or force-merge. Wait for required check "CI OK". Verify with the smallest relevant commands (e.g. npm run deadcode, targeted vitest).
3. Tier A includes tooling-only Vitest timeouts under tests/scripts/ (prefer narrower --since / faster script; higher timeout only with rationale; never skip).
4. Tier B: do not open a fix PR. Deduplicate: search open issues with label ci-autofix-failed matching the failure fingerprint; if one exists, comment the new run URL and stop; else create one issue with that label.
5. Never skip tests, weaken assertions, or change game/save/battle logic to greenwash.
6. PR body: summary, verification commands, link to the failing Actions run. Mention Tier A auto-merge when applicable.
7. If both Tier A and Tier B fail on the same run: land the Tier A PR for the mechanical part and escalate the Tier B fingerprint separately (deduped).
```

## Hygiene

- Label: `ci-autofix-failed` (bot escalations).
- Delete fixer branches on merge (repo `delete_branch_on_merge`).
- After resolving a sticky Tier B issue, close it; do not leave duplicate open issues for the same fingerprint.
