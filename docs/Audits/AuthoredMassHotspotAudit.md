# Authored Mass Hotspot Audit

**Goal:** Reduce expensive authored maintenance surface by confirming live mass hotspots — not per-change deltas and not unused symbols alone.

Per-change amplification and co-touch friction belong to `ChangeLocalityContextEfficiencyAudit.md` (and optional `npm run audit:all` / `audit-change-amplification.mjs`). This audit inventories retrospective accumulated live surface relative to peers / shipping behavior — not `git log` LOC rates and not per-diff amplification counts. `DeadCodeRatioAudit.md` removes unused symbols; `InelegantSlopAudit.md` removes ceremony; neither ranks live file or folder hotspots.

## Intent

Confirm authored production or test hotspots whose size or mixed jobs cost more to read, edit, or verify than the behavior warrants, then shrink them through an existing owner. Historical churn may surface candidates only; it is not confirming evidence — do not use `git log` LOC rates or blame churn to confirm a finding. A successful fix shrinks the hotspot and removes avoidable mass (prefer net authored LOC / declarations down). Moving mass without removing the old path is not success. A clean pass is valid. Planning and phasing: [README.md](README.md).

Wrong Architecture owner — even in a huge file — belongs to `StateGravityOwnershipAudit.md`. This audit owns correct-owner (or intentional co-location) surfaces whose cost is mixed jobs / avoidable mass. File or folder mass with mixed jobs → this audit; function complexity or nesting without file/folder mass → `InelegantSlopAudit.md`.

## What counts as a mass hotspot

| Tell                                                                                                                       | Why it is a finding candidate                                                              |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Large authored file with mixed jobs                                                                                        | Review and agent context pay for unrelated concerns in one surface                         |
| Folder-level mass dominated by parallel scaffolding or accumulated helpers that do not express distinct shipping behaviors | Surface grew without matching distinct product jobs — still requires the full evidence bar |
| Fat mapping / normalizer / session / presentation files that force unrelated code prereads because of mixed jobs           | One change requires reading load-bearing neighbors it does not own                         |
| Harness-heavy test support whose LOC dwarfs unique assertions                                                              | Candidate only — hand off portfolio fit to `UnitTestAudit.md` / `E2ETestQualityAudit.md`   |

| Not this audit                                         | Prefer                                        |
| ------------------------------------------------------ | --------------------------------------------- |
| Unused symbols                                         | `DeadCodeRatioAudit.md`                       |
| Single-path ceremony with correct ownership            | `InelegantSlopAudit.md`                       |
| Function-level complexity without file/folder mass     | `InelegantSlopAudit.md`                       |
| Copy-paste UI shells                                   | `DuplicateFeatureSurfaceAudit.md`             |
| Wrong semantic owner (including huge misplaced files)  | `StateGravityOwnershipAudit.md`               |
| Retained parallel live implementations / shims         | `DualPathRetentionAudit.md`                   |
| Recurring co-touch / routing / guidance duplication    | `ChangeLocalityContextEfficiencyAudit.md`     |
| Test-matrix / harness portfolio fit as the primary hit | `UnitTestAudit.md` / `E2ETestQualityAudit.md` |

## Hard stops

- Do not treat file length alone as a finding. Size is a candidate signal until an avoidable cause and smaller shape are confirmed. Cite 2–3 peer files in the same owner class (screen / store / `src/lib` / test support); do not invent repo-wide LOC thresholds or CI ratchets.
- Do not hand-edit generated output (`assets.generated.ts`, `metadata.generated.ts`, other sync products), `dist/`, or build artifacts. Exclude them from hotspot inventory. Do not treat generated asset/catalog volume as authored TypeScript mass — fix sources and regenerate via the owning sync script.
- Do not rewrite allowlisted load-bearing complexity “to split files”: battle damage/turn pipeline math, save wire format / normalizer invariants that must stay co-located, asset/codegen boundaries, intentional Armory drag FSM / battle presentation / Motion juice when product behavior requires them, `screen-routes/` composition tables, or large authored catalogs under `src/lib/game-data` when the job _is_ the catalog.
- Do not invent absolute LOC or coverage % CI gates. Prefer evidence and local reduction over ratchets.
- Prefer the owning audit when the hit is primarily dead code, slop ceremony, dual-path retention, duplicate UI, state ownership, change locality / routing friction, or unit/E2E test portfolio fit.

## Evidence bar

All of:

- **Hotspot:** an authored production or test surface that is large relative to peers in its owner class (cite 2–3 peers), or that routinely forces unrelated code prereads because of mixed jobs in one file
- **Avoidable cause:** mixed jobs, parallel scaffolding, or accumulated helpers without a second need — not inherent domain density
- **Existing home:** `src/lib` owner, store slice / facade method, shell controller, `shared/ui` / `src/components/ui` shell, or existing test owner that can absorb the split or collapse
- **Measurable direction:** prefer net authored LOC / declarations down while behavior and required coverage stay intact. The hotspot file must shrink and mixed jobs must leave it. Architecture-expected hub splits may be LOC-neutral or increase file count only when mass moves into **existing** owners and no parallel path remains. Moving mass while leaving the old path is not success.

## Domain rules

Inventory authored TypeScript under `src/` and `tests/`; count production and test separately. Skip generated output, build artifacts, and checked-in asset/catalog volume. Allowlist justified density (battle rule pipelines, save graph mapping when co-location is the invariant, intentional spectacle / drag / motion surfaces, route composition tables, authored game-data catalogs). Prefer collapse/delete → move jobs to the existing owner → split a hub only when [ARCHITECTURE.md](../ARCHITECTURE.md) hub containment already expects handlers, slices, facade methods, or controllers and the local move removes mixed jobs.

Successful fixes leave a smaller hotspot or delete the avoidable portion; proposals for significant hub splits follow the README right-size policy.

## Known signals

Optional discovery aids — choose your own probes.

- **Outlier file size:** authored `.ts` / `.tsx` files large relative to peers in the same owner (screens, stores, `src/lib` modules, test support). Optional peer line-count inventory under `src/` and `tests/` (production vs test separately) — candidate only.
- **Mixed-job mega-modules:** one file owning navigation + rewards + persistence + presentation, or schema + migration + UI bindings together.
- **Folder scaffolding mass:** many near-identical helpers under one feature folder without distinct product jobs.
- **Harness-heavy tests:** support files / matrices whose LOC dwarf unique assertions — hand off portfolio fit to unit/E2E audits; do not treat as an AuthoredMass finding when the hit is primarily portfolio ownership.
- **Length probe as candidate only:** ESLint `max-lines-per-function` via `npm run audit:all` may surface mass candidates; confirm mixed jobs and an existing home before treating as a finding. Function complexity alone stays with `InelegantSlopAudit.md`.
- **Not confirming evidence:** `git log` LOC rates or blame churn (history may surface candidates only).
