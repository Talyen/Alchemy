interface Window {
  alchemyDesktop?: {
    isDesktop: boolean;
    setDisplayMode: (mode: string) => Promise<void>;
    quit: () => void;
    loadSave: () => Promise<unknown>;
    writeSave: (data: unknown) => Promise<boolean>;
    backupSave: () => Promise<boolean>;
    clearSave: () => Promise<void>;
    clearAllSaves: () => Promise<void>;
    getPendingSave: () => string | null;
    hasPendingSave: () => boolean;
    markPendingSave: () => void;
    clearPendingSave: () => void;
    setAutoSaveInterval: (ms: number) => void;
    onBeforeQuit: (callback: () => void) => void;
    canQuit: () => boolean;
    steamCloudSave: (data: string) => Promise<boolean>;
    steamCloudLoad: () => Promise<string | null>;
    steamCloudDelete: () => Promise<void>;
    steamGetName: () => string;
    steamSetRichPresence: (key: string, value: string) => void;
  };
}
