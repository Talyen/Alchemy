# UI Contributing Guide

Use this guide when creating or editing UI.

## Core References
- Rules: `docs/ui_rules.md`
- Primitives: `src/ui/primitives`
- Debug tooling: `src/ui/debug`
- Static checks: `src/ui/guardrails`

## Workflow For New UI
1. Start with primitives (`Panel`, `Stack`, `Row`, `Grid`) for structure.
2. Add interaction controls (`Button`, `Input`) with built-in sizing and states.
3. Use `Modal`, `Toolbar`, `Sidebar`, `Card` for common shells.
4. Run app in development and check UI diagnostics output.
5. Test the layout at small/medium/large resolutions.

## Primitive Usage
- `Stack`: vertical layout with controlled gap/alignment.
- `Row`: horizontal layout that can wrap safely.
- `Grid`: responsive grid with auto-fit columns.
- `Panel`: constrained surface with overflow clipping.
- `Card`: content surface with internal spacing and wrapping.
- `Modal`: centered overlay with proper containment and close handling.
- `Toolbar`: action row with wrapping + spacing rules.
- `Sidebar`: constrained side panel with internal scrolling.
- `Button`: minimum 44px target and motion-safe states.
- `Input`: full-width, contained, and focus-visible defaults.

## Correct vs Incorrect Patterns

Correct
```tsx
<Panel className="w-full max-w-5xl">
  <Stack gap="md">
    <Row justify="between" align="center" wrap>
      <h2>Deck Builder</h2>
      <Toolbar>
        <Button>Save</Button>
        <Button variant="secondary">Cancel</Button>
      </Toolbar>
    </Row>
    <Grid minColumnWidth="16rem">
      {cards.map((card) => <Card key={card.id}>{card.name}</Card>)}
    </Grid>
  </Stack>
</Panel>
```

Incorrect
```tsx
<div style={{ position: 'absolute', left: 273, top: 119 }}>
  <button style={{ width: 26, height: 26 }}>X</button>
</div>
```

## Absolute Positioning Exception
If absolute/fixed layout is necessary (overlay/effect only):
- Add source annotation: `/* ui-allow-absolute */`
- Keep it out of primary document flow.
- Ensure parent container is explicitly bounded.

## Debug Mode
Enable by setting `UI_DEBUG=true` (or `VITE_UI_DEBUG=true`) in environment.

Debug mode provides:
- container outlines
- overflow highlight
- hidden-element reveal markers
- console diagnostics for overlap and out-of-screen rendering

## Enforcement Commands
- `npm run build:ui-strict`: enables strict UI guardrails and fails on unresolved static violations.
- `npm run test:ui-guardrails`: verifies no runtime `[ui-layout]` diagnostics for core menu/character-select flow at small/medium/large resolutions.

## Validation Checklist
- [ ] No primary layout via absolute/fixed positioning
- [ ] No hardcoded pixel offsets for layout spacing
- [ ] Text wraps and media scales inside containers
- [ ] Click targets are >=44x44
- [ ] Small/medium/large resolutions are validated
- [ ] No runtime diagnostics warnings for new screens
