import { isDesktopApiAvailable } from "../desktop-api";

/**
 * True when the window has a visible laid-out area. Shared by the audio-host
 * check below and the background-mute check in `useAppAudioEffects` so the
 * "minimized / zero-size window" threshold lives in one place.
 */
export function hasVisibleWindowArea(): boolean {
  if (typeof window === "undefined") return false;
  const innerW = window.innerWidth;
  const innerH = window.innerHeight;
  return Number.isFinite(innerW) && Number.isFinite(innerH) && innerW >= 2 && innerH >= 2;
}

function hasZeroOuterSize(): boolean {
  if (typeof window === "undefined") return false;
  const outerW = window.outerWidth;
  const outerH = window.outerHeight;
  return Number.isFinite(outerW) && Number.isFinite(outerH) && (outerW < 2 || outerH < 2);
}

export function isNonPlayerAudioHost(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;

  if (navigator.webdriver || navigator.userAgent.includes("HeadlessChrome")) return true;

  if (hasVisibleWindowArea() && hasZeroOuterSize()) return true;

  return navigator.userAgent.includes("Electron") && !isDesktopApiAvailable();
}
