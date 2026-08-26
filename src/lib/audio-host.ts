/** Cursor/VS Code shells and undisplayed windows — not Alchemy desktop or a normal browser tab. */
export function isNonPlayerAudioHost(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;

  const innerW = window.innerWidth;
  const innerH = window.innerHeight;
  const outerW = window.outerWidth;
  const outerH = window.outerHeight;
  if (
    Number.isFinite(innerW) &&
    Number.isFinite(innerH) &&
    Number.isFinite(outerW) &&
    Number.isFinite(outerH) &&
    innerW >= 2 &&
    innerH >= 2 &&
    (outerW < 2 || outerH < 2)
  ) {
    return true;
  }

  return navigator.userAgent.includes("Electron") && window.alchemyDesktop?.isDesktop !== true;
}
