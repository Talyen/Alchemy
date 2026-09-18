import { isDesktopApiAvailable } from "../desktop-api";

/** Minimum laid-out window size that counts as visible (minimized / zero-size windows stay silent). */
const MIN_VISIBLE_WINDOW_PX = 2;

/**
 * True when the window has a visible laid-out area. Shared by the audio-host
 * check below and the background-mute wiring so the threshold lives in one place.
 */
export function hasVisibleWindowArea(): boolean {
  if (typeof window === "undefined") return false;
  const innerW = window.innerWidth;
  const innerH = window.innerHeight;
  return (
    Number.isFinite(innerW) &&
    Number.isFinite(innerH) &&
    innerW >= MIN_VISIBLE_WINDOW_PX &&
    innerH >= MIN_VISIBLE_WINDOW_PX
  );
}

function hasZeroOuterSize(): boolean {
  if (typeof window === "undefined") return false;
  const outerW = window.outerWidth;
  const outerH = window.outerHeight;
  return (
    Number.isFinite(outerW) &&
    Number.isFinite(outerH) &&
    (outerW < MIN_VISIBLE_WINDOW_PX || outerH < MIN_VISIBLE_WINDOW_PX)
  );
}

export function isNonPlayerAudioHost(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;

  if (navigator.webdriver || navigator.userAgent.includes("HeadlessChrome")) return true;

  if (hasVisibleWindowArea() && hasZeroOuterSize()) return true;

  return navigator.userAgent.includes("Electron") && !isDesktopApiAvailable();
}

export interface AppBackgroundInput {
  hidden: boolean;
  eventType?: string | undefined;
  hasFocus: boolean;
  hasVisibleArea: boolean;
}

/**
 * Pure background decision shared by the audio-host check and the
 * background-mute wiring.
 */
export function shouldTreatAsBackground(input: AppBackgroundInput): boolean {
  if (input.hidden) return true;
  if (input.eventType === "blur") return true;
  if (input.eventType === "focus") return false;
  if (!input.hasVisibleArea) return true;
  return !input.hasFocus;
}

/** DOM-reading wrapper for app lifecycle wiring. Pure logic lives in `shouldTreatAsBackground`. */
export function isAppInBackground(event?: Pick<Event, "type">): boolean {
  if (typeof document === "undefined") return false;
  return shouldTreatAsBackground({
    hidden: document.hidden,
    eventType: event?.type,
    hasFocus: typeof document.hasFocus === "function" ? document.hasFocus() : true,
    hasVisibleArea: hasVisibleWindowArea(),
  });
}
