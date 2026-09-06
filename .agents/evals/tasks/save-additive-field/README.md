# Task: Save — defaulted preference

Use the pinned base and comparison procedure in [the evaluation guide](../../README.md). Do this only in the evaluation checkout.

## Exact request

Add a persisted boolean preference named `showEnemyIntentDetails`, defaulting to true, to the existing settings store and save pipeline. Missing or malformed values restore as true; explicit false must survive saving and loading. Expose it through the existing settings read/write pattern. This task adds no settings-screen control and changes no battle rendering.

Update the canonical schema, owning defaults, hydration/serialization and relevant fixtures together. This is a compatible additive field and must not bump the save schema version or add a migration step.

## Acceptance

- An old save lacking the field loads with true while preserving its active run.
- False round-trips through the production save pipeline and settings store.
- Malformed input recovers to true; repeated normalize/load/save is idempotent.
- Save migration guards and the task-owned changed-path check pass.

Use the actual complete changed-path set for verification.
