# Steamworks native overlay patches

Alchemy builds steamworks.js 0.4.0 from upstream commit
`fa6c6af2a40dc3923f88d41c2912aa041dfffc6f`, with two minimal patches:

- [Overlay activation callback](https://github.com/ceifa/steamworks.js/pull/205),
  commit `044f98a6920881b5dff9ce87b98900746cc194e2`.
- [Overlay availability](https://github.com/ceifa/steamworks.js/pull/203),
  commit `206fc5be6aff62eb62286c417c3547c6e8559939`. The unrelated workshop
  declaration is excluded.

Both upstream changes remained open on October 23, 2026. The source archive is
checksum-pinned; upstream's Cargo.lock pins native dependencies. The upstream MIT
license and Steam SDK redistribution files stay with the existing dependency.

`npm run steam:build-native` requires Rust/Cargo 1.90.0 (`rustup toolchain install 1.90.0 --profile minimal`)
and the platform's native linker
(MSVC on Windows, Xcode tools on macOS, or a C toolchain on Linux). It builds only
the host architecture. It runs before desktop development and packaging; Windows
depots must be packaged on Windows x64. Renderer-only builds do not need Rust.
Build output lives in a checkout-specific OS temporary directory; a binary-hash receipt
allows unchanged installations to reuse their compiled binding. Shared worktree
dependency links are never patched: install task-local dependencies first.

[The pause listener](../../desktop/steam-overlay.cjs) pauses on native activation
and leaves the menu open on deactivation under the
[demo input contract](../../Docs/STEAM_DEMO.md#input-and-release-evidence).
`steamworks.js.init()` owns callback pumping; no second timer or callback pump
is added. Electron overlay GPU setup runs before app readiness. Proton uses the
packaged Windows x64 binding.

Export qualification needs no Steam login. It proves the native capabilities are
present, not that Steam's overlay works.
[Physical Steam/controller/Deck acceptance](../../Docs/STEAM_DEMO_CHECKLIST.md#physical-steam-acceptance-evidence)
remains required before public promotion. Review/remove these patches when an
upstream release implements both capabilities; never substitute only declarations
or JavaScript for native support.
