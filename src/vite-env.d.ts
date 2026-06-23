/// <reference types="vite/client" />

interface Window {
  alchemyDesktop?: {
    isDesktop: boolean;
    setDisplayMode: (mode: "windowed" | "borderless-fullscreen" | "fullscreen") => Promise<void>;
    quit: () => Promise<void>;
    listSaveCandidates: () => Promise<string[]>;
    writeSave: (data: string) => Promise<boolean>;
    clearSave: () => Promise<boolean>;
    steamGetName: () => Promise<string | null>;
    steamSetRichPresence: (key: string, val: string) => Promise<boolean>;
    steamCloudRead: () => Promise<string | null>;
    steamCloudWrite: (data: string) => Promise<boolean>;
    steamCloudDelete: () => Promise<boolean>;
  };
}
