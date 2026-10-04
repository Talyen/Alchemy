# Desktop layout review

This opt-in screenshot review uses a freshly built production renderer in real
Electron, isolated temporary saves, muted audio, and hidden windows.
Native page capture keeps the window hidden and normalizes Retina bitmaps to CSS
viewport dimensions; the native content bounds and renderer viewport must match.
It never requests native fullscreen or brings a window forward. Run browser,
Electron, and full unit batches separately. Local builds and screenshot suites
require an explicit execution request under [Contributing](../../CONTRIBUTING.md#what-to-run-when-you-change);
the compact runner below participates in the shared local test lane.

```sh
npm run build:desktop
node scripts/run-compact.mjs playwright test --config playwright.layout-review.config.ts
LAYOUT_REVIEW_PASS=stress LAYOUT_REVIEW_STRESS=1 node scripts/run-compact.mjs playwright test --config playwright.layout-review.config.ts --grep 'size and aspect ratio stress'
node tests/layout-review/report.mjs
```

The preview server defaults to port 4277. Set `PLAYWRIGHT_ELECTRON_PREVIEW_PORT`
to use a different free port; existing servers are never reused or stopped.

The gallery is `reports/layout-review/index.html`; `coverage.json` records each
capture's renderer viewport, DPR, native-window state, and potential clipping.
Contact sheets group each state across eleven desktop/laptop viewports. Scrollable
states also receive bottom captures. Hover panels and dropdowns are reopened after
resizing. Clipping diagnostics are advisory: offscreen items in intentional scroll
containers and overlapping battle cards require visual interpretation.

Use `LAYOUT_REVIEW_PASS=after` for verification captures. `LAYOUT_REVIEW_STATES`
accepts a regular expression to restrict captured states while retaining their
setup journey. `LAYOUT_REVIEW_VIEWPORTS=3840x2160` restricts the default matrix
for focused recaptures. Use Playwright `--grep` to restrict setup groups. Test saves are
seeded through existing production save adapters; normal player profiles and Steam
Cloud are excluded.

For other agent Electron work, set `ALCHEMY_ELECTRON_BACKGROUND=1` before launching
existing tests, or pass `{ background: true }` to `launchElectronApp`. Background
mode suppresses native display-mode changes and keeps the hidden renderer active.
`{ offscreen: true }` enables an optional offscreen renderer for composition
comparison. Layout review uses native capture rather than DevTools screenshots:
large emulated viewports produced intermittent missing artwork in DevTools captures. Native fullscreen tests require a visible launch
and explicit user authorization when they would interrupt the user's desktop.

The baseline covers every route, major meta/Options tabs, reward variants, all
Talent trees, dense battle and inventory states, card/boon/enemy inspection,
removal and corruption pickers, Mystery choices and summaries, confirmations,
loading, and run outcomes. Stress coverage exercises battle hands/tooltips and
deck inspection at 80/120% Game Size, 125% Tooltip Size, and every supported
aspect ratio on small, 16:10, and ultrawide viewports. Captures are review evidence,
not automatic pixel baselines; add focused assertions for confirmed defects.

The seven primary monitor sizes come from [Steam’s August 2026 survey](https://store.steampowered.com/hwsurvey/); four additional logical viewport sizes cover scaled desktops and the MacBook reference. Physical display resolution and logical game viewport are recorded separately.
