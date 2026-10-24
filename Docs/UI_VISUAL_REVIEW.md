# Visual review

UI, layout, polish and artwork changes must improve on the current implementation.
[UI](./UI.md) owns the interface system; [asset workflows](./WORKFLOWS-ASSETS.md#art-style-and-generation-prompts)
own illustration style and importing.

## Improve on what exists

- Avoid taglines, avoid helper text, avoid secondary labels - if a screen needs them to make sense, fix the layout instead.
- Identify a concrete visible or interaction defect before changing the design.
  Repeated cards, small artwork or empty space alone do not establish a problem.
  Understand what the current screen does well and preserve those strengths.
- Start by removing or simplifying. Review the visual weight of existing labels,
  badges, statistics, frames and effects as well as new copy. More emphasis,
  larger art and a different arrangement must earn their place in the whole screen.
- Preserve access to essential mechanics, accessible names and useful feedback.
  Use existing inspection for secondary details without hiding costs or
  consequences needed to choose an action. Keep translations current when text changes.
- Use references relevant to the actual problem. Illustration references guide
  art treatment; screen references guide composition. Existing successful screens
  are useful standards. A reference catalog or approval record is not required.
- Compare the original and candidate in the renderer under the same viewport,
  game state and settings; use 1920 × 1080 by default. Judge overall clarity,
  restraint, cohesion and ease of use, then exercise the affected interactions.
  Inspect other states, sizes and localized content where the change affects them.
  Review artwork inside its destination screen at the intended size and crop.
- Explore alternatives when useful or requested. Distinctness alone has no value.
  Reject unsuccessful experiments before asking the user to choose; when no
  candidate convincingly improves the original, keep the original and report
  the unsuccessful attempt. Discard rejected directions rather than polish them.

Use screenshots to inspect rendering and tests to protect behavior; assess visual
quality through the comparison itself. Report concrete improvements, affected
interaction checks and any missing validation briefly. Keep temporary captures
in ignored reports/output.

## Browser authorization

[CONTRIBUTING](../CONTRIBUTING.md#what-to-run-when-you-change) owns execution permissions. Use its [managed preview workflow](../CONTRIBUTING.md#agent-preview-ownership), reusing a suitable preview and preserving other tasks' servers, browsers and occupied lanes.

Complete rendered review for visible changes. If rendering is blocked, report
that limitation; source inspection and passing tests establish only their own
scope. Other source changes follow the ordinary task gate.

## Reproducible scenarios

Use `npm run visual:scenario -- --list` to discover seeded browser checkpoints:
menu, Options, Homestead, Battle, card inspection and card rewards. For example:

```sh
npm run visual:scenario -- battle --label before
npm run visual:scenario -- battle --label after
npm run visual:scenario -- options --label after --locale de --viewport 1280x720
```

Run the original capture before editing, then repeat the same scenario, seed,
locale, edition, viewport and mode after editing. Use the same OS and installed
Chromium version. The default seed is 42, viewport 1920 × 1080, and language English.
The command starts its own current-source development server on port 4179; use
`--port <free-port>` for concurrent checkouts. Occupied ports fail without reusing
or terminating another server. `--mode preview` requires a fresh web build.
`--headed` shows the temporary browser; its profile is isolated from player data.

Each invocation writes a unique directory under `reports/visual-review/<label>/`
with `screen.png`, seeded browser `storage.json`, `capture.json` recording the
actual browser version and headings, and `scenario.json` identifying
settings, commit, dirty paths and success/failure. Failed runs retain available
diagnostics and must not be used as accepted captures. Task finishing preserves this
review evidence. These are opt-in captures, not new automatic pixel baselines.

The runner uses existing save fixtures, seeded cosmetic randomness, a fixed clock,
muted audio, reduced motion and disabled battle animations. It waits for settled
layout before capture. Compare the images, then exercise affected interactions;
a settled capture does not establish real animation timing or visual quality.
Add new checkpoints to the existing scenario owner with explicit readiness rather
than duplicating save bootstrapping or adding production-only debug routes.
