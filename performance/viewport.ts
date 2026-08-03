/**
 * Perf harness viewport — MacBook Air 13" logical size (16:10) so the headed
 * Chromium window fits on the display. Keep Chromium and Electron reports on
 * this same size when comparing.
 */
export const PERF_VIEWPORT = { width: 1440, height: 900 } as const;

/** Matches MBA 13" aspect; injected into save so VR stage fills the viewport. */
export const PERF_ASPECT_RATIO = "16:10" as const;
