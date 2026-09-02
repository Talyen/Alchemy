import { getDesktopApi, isDesktopApiAvailable } from "./desktop-api";
import type { DisplayMode } from "./settings-values";

export type { DisplayMode } from "./settings-values";

export interface SteamInitialization {
  playerName: string | null;
  cloudSyncEnabled: boolean;
}

export function isDesktop(): boolean {
  return isDesktopApiAvailable();
}

export function setDisplayMode(mode: DisplayMode): Promise<void> {
  return getDesktopApi()?.setDisplayMode(mode) ?? Promise.resolve();
}

export function quitDesktopApp(): void {
  void getDesktopApi()?.quit();
}

export async function initializeSteam(): Promise<SteamInitialization> {
  const getPlayerName = getDesktopApi()?.steamGetName;
  if (!getPlayerName) return { playerName: null, cloudSyncEnabled: false };

  try {
    const playerName = await getPlayerName();
    if (!playerName) return { playerName: null, cloudSyncEnabled: false };
    console.warn(`Steam initialized. Player: ${playerName}`);
    return { playerName, cloudSyncEnabled: true };
  } catch (error) {
    console.warn("Failed to retrieve Steam player name:", error);
    return { playerName: null, cloudSyncEnabled: false };
  }
}

export function setSteamRichPresence(key: string, value: string): Promise<boolean> {
  return getDesktopApi()?.steamSetRichPresence?.(key, value) ?? Promise.resolve(false);
}
