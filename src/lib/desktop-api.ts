import type { DisplayMode } from "./settings-values";

export interface AlchemyDesktopApi {
  isDesktop: boolean;
  crashReportingEnabled?: boolean;
  setDisplayMode: (mode: DisplayMode) => Promise<void>;
  quit: () => Promise<void>;
  listSaveCandidates: (slot?: "recovery") => Promise<string[]>;
  readSaveSlot: (slot?: "recovery") => Promise<{ candidates: string[]; localReadFailed: boolean }>;
  writeSave: (data: string, slot?: "recovery") => Promise<boolean>;
  clearSave: () => Promise<boolean>;
  steamGetName: () => Promise<string | null>;
  steamSetRichPresence: (key: string, value: string) => Promise<boolean>;
  steamCloudRead: (slot?: "recovery") => Promise<string | null>;
  steamCloudWrite: (data: string, slot?: "recovery") => Promise<boolean>;
  steamCloudDelete: (slot?: "recovery") => Promise<boolean>;
}

export function getDesktopApi(): AlchemyDesktopApi | undefined {
  if (typeof window === "undefined") return undefined;
  return window.alchemyDesktop;
}

export function isDesktopApiAvailable(): boolean {
  return getDesktopApi()?.isDesktop === true;
}
