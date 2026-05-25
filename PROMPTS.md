You are a senior software engineer conducting a two-phase codebase analysis.

Phase 1 — Triage
Given the code or file information I provide, identify the 2–3 files or modules most worth scrutinizing using these signals:

Churn indicators — Layered patches, inconsistent style, or comments suggesting repeated under-pressure edits
Complexity indicators — Deeply nested logic, long functions, high conditional count, or tight coupling
Bug-magnet patterns — Swallowed errors, implicit state, optimistic assumptions, or logic that's hard to follow at a glance
Blast radius — How central is this file? The more things depend on it, the higher the priority
Boundary risk — Entry points, external integrations, and auth/permissions layers carry the highest cost of failure

For each of your 2–3 picks, state:

The file or module name
The specific signals that flagged it
The risk in one sentence


Phase 2 — Pragmatic Review
For each file identified in Phase 1, conduct a structured review across these dimensions:

DRY violations — Duplicated logic, data, or knowledge; missing single source of truth
Broken windows — Commented-out code, rotting TODOs, inconsistent naming, unexplained hacks
Orthogonality — Tight coupling, hidden dependencies, or violations of single responsibility
Fragility & reversibility — Hardcoded values, rigid assumptions, or decisions that will be painful to change
Error handling & early crashes — Swallowed exceptions, missing assertions, silent propagation of bad state
Automation gaps — Manual steps that should be scripted, repeated patterns suggesting a missing abstraction
Testability — Untested assumptions, low observability, or structure that makes unit testing difficult
Plain text & transparency — Opaque or binary formats where human-readable alternatives would be more robust

For each issue found:

Reference the specific code
Name the principle it violates
Explain the practical risk
Suggest a concrete fix



General Cleanup & Refactoring

Review this codebase and identify dead code, unused variables, redundant imports, and unreachable logic. Remove them and explain what was cut and why.
Refactor this code to follow the Single Responsibility Principle. Each function should do exactly one thing. Split any functions longer than 30 lines into smaller, named helpers.
Identify any "magic numbers" or hardcoded strings in this game code and replace them with named constants. Group related constants into a CONFIG or CONSTANTS object.

Comments & Readability

Add comments to any complex function/class. For game logic specifically, explain the "why" not just the "what" — include notes on game mechanics, edge cases, and any non-obvious decisions.
Add a top-of-file summary comment to each module explaining: what it does, what it depends on, and what depends on it. Keep each summary under 5 lines.
Audit this file for any logic that would confuse an LLM or future developer reading it cold. Add inline comments to clarify game-state assumptions, coordinate systems, timing dependencies, or any stateful side effects.

Modularization

Analyze this file and split it into focused modules. Separate concerns like: rendering, game state, input handling, physics/collision, audio, and UI. Export only what other modules need.
Game logic should not be mixed with rendering code. Separate them: create a pure game state layer with no DOM/canvas references, and a renderer that reads from state and draws — no game logic in the renderer.
Identify any repeated code patterns across this codebase and extract them into shared utility functions in a utils.js or helpers.js module.

Reducing Bloat

This code is verbose. Simplify it: remove unnecessary abstractions, collapse one-liner wrappers, and prefer native browser APIs over custom re-implementations where appropriate. Don't over-engineer.
Look for any overly nested code (3+ levels of indentation) and flatten it using early returns, guard clauses, or helper functions. Prioritize readability.
Identify any dependencies or utility functions that are only used once and are simple enough to inline. Remove the abstraction and inline the logic.
Look for 'conceptual duplication' where the same concept has been re-implemented multiple times independently in different parts of the codebase in slightly different ways, likely accidentally, and propose standardization/shared components.

Test Coverage

Write unit tests for all pure functions in this codebase that need them. Focus on game logic. Mock any DOM or canvas dependencies.
Identify the 5 highest-risk functions in this game (most complex, most depended-on, or most likely to break). Write thorough tests for those first, including edge cases.
Add integration tests that simulate a full game loop: initialization → player input → state update → render cycle. Assert on game state, not DOM output where possible.

Browser Game–Specific

Audit this game loop for performance issues: unnecessary allocations, missing cleanup, unthrottled listeners, or DOM reads inside the render loop. Fix what you find.
Review all listeners in this codebase. Ensure they are added once, properly removed on game reset/destroy, and not causing memory leaks.
Standardize how game state is stored and mutated. Identify any globals or scattered state and consolidate into a single state object or store pattern.
