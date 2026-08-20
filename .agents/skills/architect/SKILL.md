---
name: architect
description: Type, Port, & Controller Specification Guard. Auto-triggers when adding new types, capability ports, Zustand stores, or screen controllers in Alchemy. Ensures TypeScript interfaces, store state schemas, and port signatures are drafted before concrete React or handler implementation.
---

# Type, Port, & Controller Specification Guard

Draft minimal, robust TypeScript interfaces, store schemas, and capability port function signatures before authoring concrete React view code or dispatch logic.

## Trigger Scenarios

Auto-triggers when:

- Defining or modifying a public capability port (`run-session-react-ports`, `run-session-read-port`, `run-session-write-port`, `run-session-lifecycle-port`), Zustand domain store schema, persistence contract, or screen/controller route.
- Adding a new public TypeScript contract that will be imported across a feature boundary.
- Do not trigger for a private helper, test-only module, or ordinary implementation file; use the normal changed-path verifier for those.

## Execution Steps

1. **Draft Public Types & Port Signatures First**:
   - Write out TypeScript `interface` and `type` declarations, store state contracts, and port function signatures with concise doc comments.
   - Avoid writing concrete React component views or complex event handlers in this initial step.

2. **Verify Architectural Invariants**:
   - Enforce Alchemy layer constraints (per `docs/ARCHITECTURE.md`):
     - Feature code outside `shared/stores/` accesses run state strictly through capability ports or domain modules—never `run-transitions` directly.
     - Screens receive data via controller props from `screen-routes/` or shell controllers—no direct React Context bindings.
     - Gameplay writes go through `run-session-write-port.ts` and `dispatchRunSessionCommand()`.

3. **Check Downstream Impact (`blast-radius`)**:
   - Evaluate symbol usage and store boundary constraints (`npm run lint:boundaries` / `dependency-cruiser`) before finalizing types.

4. **Proceed to Implementation**:
   - Once type contracts and boundary checks are solid, implement concrete logic in the smallest suitable scope.
