# Refactor: collapse route-command assembly indirection

Status: implemented
Owner: app routing / shell composition
Touches: `src/features/alchemy/shell/`, `src/app/screen-routes/`, `docs/ARCHITECTURE.md`, `tests/**`

Completion note: implemented in August 2026. The phased `routeCommands` contract remains
intact, but the flat `AlchemyRouteCommandDeps` bag and 194-line
`create-route-commands.ts` reconstruction module are gone. The shell controller now
assembles the final phase tree directly, and route adapters use direct phase-command type
aliases while retaining narrow outer contexts.

## Finding

The phase-scoped `routeCommands` tree is a useful boundary: screens receive commands,
screen routes read their own display data, and no broad display/controller bag crosses
the route seam. The construction path for that tree is over-engineered, however.

Today `useAlchemyRunController` flattens roughly 35 already-typed handlers from `nav`,
`battle`, `shop`, and Labyrinth routing into `AlchemyRouteCommandDeps`. The 194-line
`create-route-commands.ts` module then:

1. repeats the handler signatures in `AlchemyRouteCommandDeps`;
2. repeats most field names in three large `Pick<...>` lists;
3. copies or renames those fields into the phase tree;
4. exports the inferred result type; and
5. sends that tree through `RenderAlchemyScreen`, where phase route contexts narrow it
   with another layer of `Pick` before route adapters unwrap the same phase key.

There is only one runtime caller of `createAlchemyRouteCommands`, no independent policy
in the builder, and no builder-specific behavioral test. Adding or renaming one route
action commonly requires synchronized edits to the source controller, the flat
dependency interface, a `Pick` list, the builder mapping, and the route adapter. The
indirection therefore increases change surface without creating a reusable abstraction.

The July 2026 history explains why the current shape exists: it replaced an even broader,
flat controller surface with commands scoped by route phase. That outcome should remain.
The problem is the flatten-then-rebuild implementation, not the phased command contract.

## Target shape

- Keep `routeCommands.meta`, `runSetup`, `runLoop`, `battle`, and `runEnd` as the public
  command-only contract passed by `App`.
- Assemble that tree once, next to the domain controllers that supply it, without an
  intermediate flat dependency bag.
- Derive command types from the final tree rather than manually repeating function
  signatures.
- Keep screen display reads in screen-specific hooks. Do not move display state back into
  `useAlchemyRunController` and do not introduce React context for route bindings.
- Keep route coverage exhaustive over `Screen` and keep each phase table unable to reach
  unrelated phase commands.

## Plan

### Phase 1 — Lock the useful contracts

Before restructuring, strengthen the type contract in
`tests/types/run-architecture-contracts.test.ts`:

- assert the exact top-level keys of `routeCommands`;
- retain the existing assertion that display fields are absent from the shell controller;
- assert representative phase isolation (for example, battle commands are absent from
  `runLoop` and run-setup commands are absent from `meta`);
- keep the existing exhaustive `Screen` route check in `screen-routes/index.tsx`.

This protects the architectural result while allowing the construction mechanism to be
deleted.

### Phase 2 — Build the phase tree at the composition root

In `use-alchemy-run-controller.ts`, replace the flat
`createAlchemyRouteCommands({ ...35 fields })` call with named phase objects assembled
directly from `nav`, `battle`, `shop`, `nodeRouting`, and the small local command wrappers.
Compose those objects into the final `routeCommands` value returned by the hook.

Keep the mapping explicit where names genuinely differ at a UI boundary (for example
`shop.merchant.buyCard` to `handleBuyCard`). Do not add identity builders or generic
property-picking utilities merely to reduce line count; explicit wiring at the single
composition root is easier to audit.

Export `AlchemyRouteCommands` from the final controller return type (or from a small
declarative command-tree type if TypeScript inference becomes circular). Avoid a second
interface that restates every handler signature.

Delete `create-route-commands.ts` once `rg "createAlchemyRouteCommands|AlchemyRouteCommandDeps"`
has no callers.

Expected result: one visible source-to-route mapping instead of a call-site mapping plus
a second 194-line reconstruction module. The controller will gain straightforward object
literals, but total indirection and synchronized edit points will fall substantially.

### Phase 3 — Simplify route-side type plumbing

Preserve phase narrowing, but make the types describe the value each adapter actually
uses:

- add direct aliases such as `MetaCommands = AlchemyRouteCommands["meta"]` and
  `RunLoopCommands = AlchemyRouteCommands["runLoop"]`;
- replace expressions such as
  `RunLoopRouteCtx["routeCommands"]["runLoop"]` in component props with those aliases;
- keep the outer route-table context narrow enough that a meta route cannot access battle
  commands;
- remove `route-ctx.ts` only if the resulting local/shared aliases make it redundant.

Do not combine this with a rewrite of the screen registry or screen-data hooks. Those are
separate concerns and currently enforce useful ownership.

### Phase 4 — Update documentation and remove stale tests

Update `docs/ARCHITECTURE.md` to say that the shell composition root assembles the phased
command tree directly. Remove references that name `shell/create-route-commands.ts` as an
architectural layer.

Keep behavioral coverage at the consumer seams:

- controller hook exposes the command tree and battle refs;
- representative route tests receive the same phase commands;
- type tests enforce command-only and phase-isolated contracts.

Do not add snapshot tests for the object shape; the type contract and route behavior are
more robust than duplicating the mapping in test fixtures.

## Verification

Run the path-scoped gates for controller and UI-flow work:

1. `npm test -- tests/features/alchemy/shell/alchemy-run-controller-hook.test.ts tests/features/alchemy/app/mystery-route.test.tsx tests/types/run-architecture-contracts.test.ts`
2. `npm run typecheck:all`
3. `npm run lint`
4. `npm run lint:boundaries`
5. `npm run test:e2e:prepush`

Also run `npm run deadcode` because the refactor deletes an exported helper module and may
make type aliases or imports obsolete.

## Risks and guardrails

- **Regression to a mega display controller:** prevent with the existing forbidden-display
  type test and screen-local data hooks.
- **Loss of phase isolation:** retain phase-specific route contexts and add representative
  negative type assertions before deleting the builder.
- **Unstable callback identities:** the current builder already returns a fresh object on
  each controller render, so direct assembly does not worsen identity behavior. Do not add
  broad `useMemo` dependency lists unless profiling demonstrates a consumer problem.
- **Conflict with current in-flight work:** `use-alchemy-run-controller.ts` is currently
  modified by the run-session command-layer refactor. Land or stabilize that work first,
  then apply this plan against its final command wrappers rather than editing across it.

## Intentionally untouched

- The `routeCommands` public shape and `App` pass-through.
- Screen-specific display selectors and the no-context controller-prop data flow.
- The exhaustive static screen registry and eager route imports.
- Domain controller internals (`useRunFlowEngine`, `useBattleController`,
  `useShopController`) unless a small return-name adjustment eliminates a real adapter;
  this plan does not justify repartitioning gameplay ownership.
