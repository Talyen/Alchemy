// Animation-disabled flag for e2e tests — reads localStorage, not a pure constant.
// Set localStorage["alchemy-disable-animations"]="true" before page load to collapse
// all CSS animation durations and JS setTimeout delays to near-zero. Intended for e2e
// tests that verify battle logic, not visual polish. Safe because it only accelerates
// cosmetic sequencing — no effect on combat math, card effects, or state transitions.
// Avoid using it for tests that verify layout, visual state, or animation-specific
// behaviour (draw/discard animation counts, stagger timing, page-fade screen transitions).
//
// `resolveGameDelay(ms)` collapses these waits in fast mode:
// - `VICTORY_TRANSITION_DELAY` (death hold before rewards)
// - combat-text lane/lifetime and portrait shake timers
// - `AUTO_END_TURN_DELAY` (idle auto-end)
// - `AUTOPLAY_RETRY_DELAY_MS` (blocked/retry poll; post-play remainder is already resolved)
// `NAVIGATION_DELAY_MS` stays raw so page-fade screen transitions remain measurable.
export function isAnimationDisabled(): boolean {
  if (typeof localStorage !== "undefined") {
    return localStorage.getItem("alchemy-disable-animations") === "true";
  }
  return false;
}
export const ANIMATION_DISABLED_DURATION = 1;
