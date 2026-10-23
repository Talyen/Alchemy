# Documentation Staleness Audit

**Goal:** Fix misleading or operationally incomplete docs — stale paths, broken links, wrong versions, outdated claims, drifting duplicated policy, and missing required workflow steps.

## Intent

Find contradictions, harmful omissions in complete-looking workflows, and duplicated policy that has drifted. Use discovery tools and task entry points to locate candidate files, then inspect their nearby source of truth; follow confirmed concepts across docs, scripts, help text, and local READMEs.

## Hard stops

- Do not hand-edit `CHANGELOG.md` (owned by release: `sync-changelog.mjs` prerelease + `release-changelog.mjs` postbump).
- Do not rewrite design prose for style-only preferences or turn this into a repo-wide docs rewrite. Restructure a focused section when scattered line edits would preserve ambiguity or hide the current owner.
- Historical mentions of deleted docs, such as the old PROMPTS.md in `CHANGELOG.md`, are fine — fix live links only.

## Investigation and evidence

Walk the entry point for a real task, comparing instructions with current owners
and executable behavior. Check hidden prerequisites, recovery steps and unreachable
owners as well as false statements. Explain what a reader would do incorrectly
and its consequence; prioritize data risk, bypassed gates and blocked work.

Verify changed claims, snippets and commands at their owners. Exercise the workflow
where safe; never publish or run destructive commands merely to check prose.
Use a contextual link instead of copying a rule. Apply the
[shared confirmation contract](README.md#discover-and-confirm) when implementation
and documentation disagree or a statement is accurate only historically.

## Investigation leads

| Signal                                               | Verify against                                                                                                 |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Wrong scripts, engines or dependency versions        | `package.json`; flags and factual meaning still require source review                                          |
| Ownership/layout mismatch                            | [Architecture](../ARCHITECTURE.md) and current `src/lib`, `src/features/alchemy`, `desktop` and `tests` owners |
| Conflicting workflow policy                          | [Contributing](../../CONTRIBUTING.md) and [AGENTS.md](../../AGENTS.md); keep one owner and link consumers      |
| Boundary/dead-code claims                            | `oxlint.config.ts` and `knip.config.js`                                                                        |
| Browser/build setup                                  | Playwright/Vite/Electron configuration and `desktop/` entrypoints                                              |
| Stale TypeScript snippets                            | Current types, APIs and their consumers                                                                        |
| Missing prerequisites/recovery, unreachable guidance | Walk the task from its documented entrypoint; check harmful omissions as well as false statements              |
| Audit logs or dated completed trackers               | Remove under the [shared finish contract](README.md#finish)                                                    |

`npm run docs:check` checks Markdown targets, heading anchors and documented npm
names through `scripts/check-documentation-contract.mjs`; it does not establish
semantic accuracy. Internal links resolve relative to their source. Verify edited
claims and links at their owners. Check external URLs when changing that source
and network is available; an unavailable endpoint alone does not fail the review.
