---
status: complete
updated: 2026-09-24
---

# Startup loading ownership

A pure startup state owner now decides when the opening screen may reveal. The browser hook owns timers, preloads, and React publication. This keeps failures and late callbacks from changing a newer mount while preserving the minimum display time, progress behavior, and background Gear art warming.

The implementation commit includes startup readiness and preload tests; this archive does not retain a separate gate result.

Implementation: `81132e6c`. Current ownership: [Boot and loading](../../ARCHITECTURE.md#boot-and-loading).
