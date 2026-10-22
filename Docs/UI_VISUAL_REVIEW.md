# Visual acceptance

This is the acceptance contract for player-facing UI, layout, visual polish,
interaction feedback, and artwork. [UI](./UI.md) owns the visual system;
[asset workflows](./WORKFLOWS-ASSETS.md#art-style-and-generation-prompts) own art
style and importing. Use the [frontend design skill](../.agents/skills/frontend-design/SKILL.md)
for design work, including small polish and copy-density changes.

## Required workflow

1. **Inspect the starting point.** Capture the affected screen before editing.
   Record route, reproducible game/save state, locale, viewport, and relevant
   settings. Use real game content. Identify the player's main decision and the
   information needed for it; do not put this design brief into the game.
2. **Choose a reference.** Inspect the [current reference set](./design/visual-references.md).
   Name the specific qualities to borrow: composition, artwork scale, type
   hierarchy, density, palette or materials. Existing code and screenshots are
   baseline evidence, not automatically approved examples. Preserve functional
   contracts; replacing a weak visual treatment is allowed within the task.
3. **Explore consequential composition choices.** For a new screen or major
   redesign, produce two materially different layouts using real content before
   committing to detailed polish. Different color or border treatments do not
   count. Render both candidates, explain the selection in the review, and use
   a simple screenshot A/B choice when user preference is consequential. Routine
   spacing, state fixes and established-pattern work need no alternatives.
4. **Implement and subtract.** Use existing owners and primitives. Check every
   added permanent text block against the copy test below. Fix weak hierarchy,
   crop and spacing before adding effects or decorative frames.
5. **Review the rendered result.** Capture the final version under the baseline
   conditions. Inspect the whole screen at normal viewing size, then details.
   Cover resting, focus/selection, unavailable, and resulting action states
   relevant to the change; include long/localized content and short windows when
   affected. New screens use the prior route/flow as the baseline, identified
   explicitly. Loading screens and source inspection are not visual evidence.
6. **Critique appearance and interaction separately.** Start a distinct review
   pass from the screenshots, reference and player task before rereading the
   implementation rationale. Record concrete visible defects, fix them and
   recapture. A separate reviewer is useful when available and authorized; no
   delegation is required. Scores, "looks polished", and successful tests do not
   substitute for observations. Record what was exercised and what remains
   unverified. Unresolved visual defects keep acceptance pending.
7. **Check evidence before integration.** Complete the local receipt below and
   run the task-scoped check. Report implementation checks and visual acceptance
   separately. Promote a screenshot into the approved reference set only with
   explicit user approval of that image and its intended use.

## Copy test

For each added or substantially rewritten helper paragraph, subtitle,
instructional banner, or success message, record the player mistake it prevents
and why labels, visible state, placement, or existing inspection cannot prevent
it. If no concrete necessary decision depends on the text, remove it. Review
unchanged text in the affected composition too; keep removals task-scoped.

Keep essential card rules, accessible names, cost/consequence information and
specific errors. Secondary details belong in existing inspection reachable by
keyboard and pointer; do not hide information needed to choose an action.
A resulting card, selected tab or updated resource can provide feedback without
another message. Do not add microcopy merely to fill space. Update translations
in the same task under the [localization workflow](./LOCALIZATION.md#agent-workflow).

## Appearance and artwork criteria

Check hierarchy (one clear emphasis for the main decision), alignment, spacing,
type scale, contrast, artwork prominence, and density against the named reference.
Justify additional panels, borders, glows, badges and particles by information or
interaction meaning. Preserve intentional game ornament; reducing text does not
require a generic flat interface.

For art, compare silhouette, palette, lighting, shading, edge treatment and detail
density with the approved art references. Inspect at actual display size and crop
inside the destination screen, alongside neighboring assets and overlaid UI.
Reject unreadable subjects, clipped focal points, competing backgrounds, and
inconsistent materials before importing a revision. A full-resolution image or
prompt match alone cannot pass. Record artwork review as not applicable with a
reason when the change does not affect art, framing, or its surroundings.

## Browser authorization

Player-facing UI/UX, layout, visual polish, and art tasks authorize the bounded
local rendered review needed above, including starting a development preview and
using `npm run agent:browser`. Reuse a suitable running preview; never terminate
another task's server or occupied lane. Use the [managed browser workflow](../CONTRIBUTING.md#agent-preview-ownership),
1920 × 1080 by default. Deliberate responsive checks can use other dimensions.
This standing authorization covers interactive review and focused browser checks
of affected flows. Broad browser suites, Electron, production builds, profiling,
coverage and publication retain their separate execution permissions.

If a preview cannot run, retain evidence and mark acceptance pending. Do not
silently waive rendered review or call the visual work complete. A user may
explicitly waive a task's visual gate; report that decision and the missing
coverage rather than manufacture a pass.

## Local evidence gate

`npm run check` checks a local visual receipt for every selected non-Markdown runtime path under
`src/`, the HTML entry point, public images/fonts, and art-selection manifests.
The broad source scope catches UI behavior and content implemented in plain
TypeScript. Pure gameplay, persistence, generated-only or mechanical changes may
use a specific nonvisual rationale only when they cannot affect presentation or
interaction. A visible copy edit or behavior fix is not nonvisual.

Initialize the receipt **after the final source edit**; capture baseline images
before editing and keep them for the comparison:

```sh
npm run visual:review -- --init <task-owned paths>
npm run visual:review -- <task-owned paths>
npm run check -- <task-owned paths>
```

Fill `reports/visual-review/review.json`. Initialization refuses to overwrite an
existing receipt. After further runtime changes, preserve useful observations,
remove only that task's receipt, and initialize again after reviewing the changed
result. The source digest covers the full runtime inventory, art manifests and
dependency/build inputs; commits alone do not invalidate it. Source changes from
merging main require renewed review. It is deliberately more conservative than
an import graph.

The initialized visual receipt requires:

- `task`: player decision and necessary information.
- `references`: nonempty descriptions naming images/paths and borrowed qualities.
- `majorRedesign`: boolean; when true, also supply `alternatives` (two rendered
  candidate image paths) and `selection` (chosen composition, reason, selector).
- `comparisons`: before/after raster image paths relative to the task checkout,
  `viewport` as `[width, height]`, and `state` describing reproducible capture
  conditions. Different dimensions need `viewportReason`. Identical screenshot
  pixels require `unchangedAppearanceReason` explaining the interaction coverage;
  before/after must still use separate capture paths. Capture every relevant
  affected screen; add state comparisons as needed, including interaction outcomes.
- `appearance`, `copy`, `interaction`, `artwork`: specific observations, corrections,
  coverage and limitations. For copy, justify retained new explanatory text or
  state that none was added. For interaction, record actual pointer/keyboard
  outcomes and relevant mute/reduced-motion checks.
- `acceptance`: `passed` only after the required reviews pass; otherwise `pending`.

For genuinely nonvisual edits, retain `version`, `source`, and `paths`, set `kind`
to `nonvisual`, and provide `reason` identifying the changed behavior and why it
cannot affect presentation/interaction. Do not use this for blocked previews.
For an explicit user waiver use `kind: waived` and `reason` quoting the user's
instruction and stating the unverified scope; only the human can authorize it.

The gate rejects missing/stale evidence, uncovered paths, pending acceptance,
missing findings, and missing/invalid or mismatched before/after images. It runs
inside local integration through the existing locked check. Ordinary outgoing
push checks do not demand another checkout's disposable review artifacts; CI
retains its functional gates. This is evidence and attestation validation, not an
automated judge of taste, screenshot authenticity, completeness or reviewer honesty.

Keep captures and receipts in ignored reports/output during the task. They are
working evidence, not a committed design archive. Inspect/report relevant captures
before task-worktree cleanup. Approved current references are the only enduring
visual examples; keep their images in the source library or the curated reference
set, and remove superseded examples when approval changes.

## Calibrate on one screen

The next new-screen or substantial-redesign task is the pilot: complete this loop
on one representative problem screen and obtain the user's screenshot selection
before propagating its treatment to other screens or shared primitives. Do not
claim that a process-only change establishes an accepted UI direction. Record
only the current approved reference and reusable decisions after selection;
experiments and completed task reports remain disposable.
