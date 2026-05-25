/// <reference types="vite/client" />

interface Window {
  alchemyDesktop?: {
    isDesktop: boolean;
    setDisplayMode: (mode: "windowed" | "borderless-fullscreen" | "fullscreen") => Promise<void>;
    quit: () => Promise<void>;
    loadSave: () => Promise<string | null>;
    writeSave: (data: string) => Promise<boolean>;
    clearSave: () => Promise<boolean>;
    steamGetName: () => Promise<string | null>;
    steamUnlockAchievement: (id: string) => Promise<boolean>;
    steamSetRichPresence: (key: string, val: string) => Promise<boolean>;
  };
}
