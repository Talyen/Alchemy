# Documentation Staleness Audit

**Goal:** Fix misleading docs — stale paths, broken links, wrong versions, outdated claims.

## Intent

Find contradictions between live docs and sources of truth. Discover markdown mechanically (do not trust a hardcoded count), but do not load it wholesale — use capped probes and open only candidate files plus nearby source-of-truth lines. A pass with no contradiction is valid. If the Critical/Moderate drift scope is large, phase the plan.

## Hard stops

- Do not hand-edit `CHANGELOG.md` for release history (owned by sync/release scripts and pre-push).
- Do not treat dated “Last execution” / Done tables inside audits as source of truth — **delete** those tracker sections when found.
- Do not rewrite design prose for style-only preferences or turn this into a repo-wide docs rewrite.
- Historical mentions of deleted docs (e.g. old `PROMPTS.md` in `CHANGELOG.md`) are fine — fix live links only.

## Severity

| Level    | Criteria                                                                                    |
| -------- | ------------------------------------------------------------------------------------------- |
| Critical | Wrong API/path, broken link, stale architecture assumption, wrong version/engine constraint |
| Moderate | Wrong count, “in progress” for finished work, inconsistent terminology                      |
| Minor    | Typo, formatting, missing code-fence language                                               |

## Domain rules

**Sources of truth:** `package.json` (scripts, engines, deps); [ARCHITECTURE.md](../ARCHITECTURE.md) (run state, ownership); [CONTRIBUTING.md](../../CONTRIBUTING.md) (hooks, test matrix); [AGENTS.md](../../AGENTS.md) (agent guardrails); `eslint.config.js` (import boundaries); `knip.config.js` (deadcode allowlists); `playwright.config.ts` / `playwright.electron.config.ts`; Vite/Electron configs and `desktop/` for build entrypoints.

**Known drift hotspots:**

- [CONTRIBUTING.md](../../CONTRIBUTING.md) “What to run when you change…” table — test paths must stay under `tests/features/alchemy/...`
- Audit probes using invalid `rg --type tsx` (use `--type ts`)
- Live docs still linking to deleted `PROMPTS.md` instead of [Audits/README.md](README.md)

**Links:** internal `.md` links resolve **relative to the source file**; heading anchors must still exist. Recheck edited links and factual claims against their listed source of truth. External URLs: check only when changing that source and network is available — do not fail solely on an unavailable endpoint.

**Audit hygiene:** if an audit contains embedded run logs, Done tables, or “Last execution” trackers, remove them and restore guide shape per [README.md](README.md).

## Known signals

Optional discovery aids — choose your own probes.

- **Code snippet drift:** fenced `ts`/`tsx` blocks in `docs/`, `AGENTS.md`, `CONTRIBUTING.md`, READMEs whose type names and APIs no longer exist.
- **Script flag drift:** documented `npm run …` commands vs actual `package.json` scripts.
- **Architecture & directory mismatches:** claims in `ARCHITECTURE.md` vs on-disk `src/lib`, `src/features/alchemy`, `desktop/`, `tests/`.
- **Broken relative links & anchors:** markdown links and `#heading` anchors whose targets are missing.
- **Version / engine staleness:** Node engine, Electron, Playwright, Vitest versions claimed in docs vs `package.json`.
- **Audit tracker residue:** embedded run logs or dated status notes under `docs/Audits/`.
