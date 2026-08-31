# Documentation Staleness Audit

**Goal:** Fix misleading or operationally incomplete docs — stale paths, broken links, wrong versions, outdated claims, drifting duplicated policy, and missing required workflow steps.

## Intent

Find contradictions, harmful omissions in complete-looking workflows, and duplicated policy that has drifted. Discover markdown mechanically, then inspect candidate files and their nearby source of truth; follow confirmed concepts across docs, scripts, help text, and local READMEs.

## Hard stops

- Do not hand-edit `CHANGELOG.md` (owned by release: `sync-changelog.mjs` prerelease + `release-changelog.mjs` postbump).
- Do not treat dated “Last execution” / Done tables inside audits as source of truth — **delete** those tracker sections when found.
- Do not rewrite design prose for style-only preferences or turn this into a repo-wide docs rewrite. Restructure a focused section when scattered line edits would preserve ambiguity or hide the current owner.
- Historical mentions of deleted docs, such as the old PROMPTS.md in `CHANGELOG.md`, are fine — fix live links only.

## Severity

| Level    | Criteria                                                                                    |
| -------- | ------------------------------------------------------------------------------------------- |
| Critical | Wrong API/path, broken link, stale architecture assumption, wrong version/engine constraint |
| Moderate | Wrong count, “in progress” for finished work, inconsistent terminology                      |
| Minor    | Typo, formatting, missing code-fence language                                               |

A missing step or invariant is Critical/Moderate only when the document claims to define the complete workflow or contract and a user following it would fail, corrupt state, bypass a required gate, or make a materially wrong change.

## Domain rules

**Sources of truth:** `package.json` (scripts, engines, deps); [ARCHITECTURE.md](../ARCHITECTURE.md) (run state, ownership); [CONTRIBUTING.md](../../CONTRIBUTING.md) (hooks, test matrix); [AGENTS.md](../../AGENTS.md) (agent guardrails); `eslint.config.js` (import boundaries); `knip.config.js` (deadcode allowlists); `playwright.config.ts` / `playwright.electron.config.ts`; Vite/Electron configs and `desktop/` for build entrypoints.

**Links:** internal `.md` links resolve **relative to the source file**; heading anchors must still exist. Recheck edited links and factual claims against their listed source of truth. External URLs: check only when changing that source and network is available — do not fail solely on an unavailable endpoint.

**Audit hygiene:** if an audit contains embedded run logs, Done tables, or “Last execution” trackers, remove them and restore guide shape per [README.md](README.md).

## Known signals

- **Code snippet drift:** fenced `ts`/`tsx` blocks in `docs/`, `AGENTS.md`, `CONTRIBUTING.md`, READMEs whose type names and APIs no longer exist.
- **Script/link contract:** `tests/scripts/documentation-contract.test.ts` continuously checks local Markdown targets, heading anchors, and documented `npm run` names; inspect flags and factual meaning manually.
- **Architecture & directory mismatches:** claims in `ARCHITECTURE.md` vs on-disk `src/lib`, `src/features/alchemy`, `desktop/`, `tests/`.
- **Broken relative links & anchors:** markdown links and `#heading` anchors whose targets are missing.
- **Version / engine staleness:** Node engine, Electron, Playwright, Vitest versions claimed in docs vs `package.json`.
- **Audit tracker residue:** embedded run logs or dated status notes under `docs/Audits/`.
- **Harmful omissions:** complete-looking workflow, architecture, migration, or command references omit a required step or invariant.
- **Duplicated policy drift:** the same rule or command is copied across multiple docs and no longer agrees; consolidate under the existing source of truth and link consumers.
- **Discoverability failure:** correct guidance exists but is not reachable from the documented entry point used for that task.
