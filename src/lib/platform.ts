import { getDesktopApi, isDesktopApiAvailable } from "./desktop-api";
import type { DisplayMode } from "./settings-values";

export type { DisplayMode } from "./settings-values";

export function isDesktop(): boolean {
  return isDesktopApiAvailable();
}

export function setDisplayMode(mode: DisplayMode): Promise<void> {
  return getDesktopApi()?.setDisplayMode(mode) ?? Promise.resolve();
}

export function quitDesktopApp(): void {
  void getDesktopApi()?.quit();
}

export function openFullGameWishlist(): void {
  void getDesktopApi()?.openWishlist?.();
}

export async function initializeSteamCloudSync(): Promise<boolean> {
  const getPlayerName = getDesktopApi()?.steamGetName;
  if (!getPlayerName) return false;

  try {
    if (!(await getPlayerName())) return false;
    return (await getDesktopApi()?.steamIsCloudEnabled?.()) === true;
  } catch (error) {
    console.warn("Failed to initialize Steam Cloud:", error);
    return false;
  }
}

export function setSteamRichPresence(key: string, value: string): Promise<boolean> {
  return getDesktopApi()?.steamSetRichPresence?.(key, value) ?? Promise.resolve(false);
}
