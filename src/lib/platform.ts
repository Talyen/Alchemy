// Narrow renderer bridge for desktop-only window and Steam capabilities.
// Save persistence uses platform-save-backend.ts instead of this runtime API.

export type DisplayMode = "windowed" | "borderless-fullscreen" | "fullscreen";

export interface SteamInitialization {
  playerName: string | null;
  cloudSyncEnabled: boolean;
}

function desktopApi(): Window["alchemyDesktop"] | undefined {
  return window.alchemyDesktop;
}

export function isDesktop(): boolean {
  return desktopApi()?.isDesktop === true;
}

export function setDisplayMode(mode: DisplayMode): Promise<void> {
  return desktopApi()?.setDisplayMode(mode) ?? Promise.resolve();
}

export function quitDesktopApp(): void {
  void desktopApi()?.quit();
}

export async function initializeSteam(): Promise<SteamInitialization> {
  const getPlayerName = desktopApi()?.steamGetName;
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
  return desktopApi()?.steamSetRichPresence?.(key, value) ?? Promise.resolve(false);
}
