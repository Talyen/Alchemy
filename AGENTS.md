# Alchemy Agent Rules

Alchemy is a fantasy roguelite deckbuilder.

## Working Style

- Start code tasks with `git status --porcelain`. Treat existing changes as in-flight work: understand them before editing, preserve user intent, and improve them when they intersect with the task.
- Optimize for quality, simplicity, robustness, scalability, and maintainability. Development cost is secondary.
- Prefer honest judgment over compliance. Challenge weak ideas, including user requests, and recommend the strongest architecture or product direction you see.
- If the same approach fails three times, stop, reassess with the relevant docs or audits, and ask rather than continuing speculative fixes.

## Docs

- For non-trivial work, discover relevant docs with `rg --files -g '*.md'` and `rg <topic>`. Read only what matches the task; prefer specific subsystem docs over broad assumptions.

## Verification

- Start from an E2E-verifiable user flow whenever possible, then use focused tests to cover the implementation details.
- Treat lint failures, test failures, and flaky tests as real quality problems, not noise.

## UI

- Be exacting about UI/UX polish: native feel, smooth motion, visual balance, spacing, alignment, and responsive behavior.
- If something looks off, fix it before calling the work done.
- Aim for crafted, artisanal software: every interaction should feel intentional.

## Reporting

- Report what changed, what verification ran, and anything intentionally left untouched.
