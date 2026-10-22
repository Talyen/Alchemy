# Visual review

UI, layout, polish and artwork changes must improve on the current implementation.
[UI](./UI.md) owns the interface system; [asset workflows](./WORKFLOWS-ASSETS.md#art-style-and-generation-prompts)
own illustration style and importing.

## Improve on what exists

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

Screenshots establish what rendered. Tests establish protected behavior. Neither
establishes aesthetic quality. Keep review findings brief and concrete; no visual
receipt, score, mandatory pilot, reference registry or per-text-block report is required.
Temporary captures belong in ignored reports/output; do not create design archives.

## Browser authorization

Player-facing UI/UX, layout, visual polish and artwork tasks authorize the bounded
local rendered review and focused browser checks needed for the affected flows,
including starting a development preview. Use `npm run agent:browser` under
[managed preview ownership](../CONTRIBUTING.md#agent-preview-ownership); reuse a
suitable preview and preserve other tasks' servers, browsers and occupied lanes.
Broad browser suites, Electron, production builds, profiling, coverage and
publication retain their separate execution permissions.

Visual work needs rendered review before it can be called complete. If rendering
is blocked, report the missing review and its limits; do not claim visual
validation from source or passing tests. Ordinary local checks do not require
visual receipts or nonvisual declarations for source changes.
