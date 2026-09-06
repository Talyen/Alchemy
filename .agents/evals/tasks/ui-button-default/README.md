# Task: UI — safe default button type

Use the pinned base and comparison procedure in [the evaluation guide](../../README.md). Do this only in the evaluation checkout.

## Exact request

Make the shared Button default to native `type="button"` when it renders a button, including its wrapper branch. Explicit `submit` and `reset` values must retain their meaning. The `asChild` branch must not inject a button type into an anchor or overwrite a child button's explicit type. Preserve appearance, ref forwarding and the existing props interface.

## Acceptance

- Clicking a default Button inside a form does not submit it, with and without a wrapper.
- An explicit submit Button submits once; reset remains a native reset control.
- An `asChild` anchor receives no injected type; a child submit button retains submit behavior.
- Focused [Button tests](../../../../tests/components/button.test.tsx) and the full task-owned changed-path check pass.

This is an interaction change; the existing DOM tests exercise the native form behavior without introducing a browser suite solely for the evaluation.
