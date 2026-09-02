import type { DisplayMode } from "./settings-values";

export interface AlchemyDesktopApi {
  isDesktop: boolean;
  crashReportingEnabled?: boolean;
  setDisplayMode: (mode: DisplayMode) => Promise<void>;
  quit: () => Promise<void>;
  listSaveCandidates: () => Promise<string[]>;
  writeSave: (data: string) => Promise<boolean>;
  clearSave: () => Promise<boolean>;
  steamGetName: () => Promise<string | null>;
  steamSetRichPresence: (key: string, value: string) => Promise<boolean>;
  steamCloudRead: () => Promise<string | null>;
  steamCloudWrite: (data: string) => Promise<boolean>;
  steamCloudDelete: () => Promise<boolean>;
}

export function getDesktopApi(): AlchemyDesktopApi | undefined {
  return window.alchemyDesktop;
}

export function isDesktopApiAvailable(): boolean {
  return getDesktopApi()?.isDesktop === true;
}
