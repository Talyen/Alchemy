import { vi } from "vitest";

export interface MockDesktopOptions {
  saveCandidates?: string[];
  steamName?: string | null;
  writeSaveSuccess?: boolean;
  cloudWriteSuccess?: boolean;
}

function createMockAlchemyDesktop(options: MockDesktopOptions = {}) {
  return {
    isDesktop: true,
    setDisplayMode: vi.fn(),
    quit: vi.fn(),
    listSaveCandidates: vi.fn().mockResolvedValue(options.saveCandidates ?? []),
    writeSave: vi.fn().mockResolvedValue(options.writeSaveSuccess ?? true),
    clearSave: vi.fn().mockResolvedValue(true),
    steamGetName: vi.fn().mockResolvedValue(options.steamName === undefined ? "Tester" : options.steamName),
    steamSetRichPresence: vi.fn(),
    steamCloudRead: vi.fn().mockResolvedValue(null),
    steamCloudWrite: vi.fn().mockResolvedValue(options.cloudWriteSuccess ?? true),
    steamCloudDelete: vi.fn().mockResolvedValue(true),
  };
}

export function setupMockWindowDesktop(options: MockDesktopOptions = {}) {
  const mockDesktop = createMockAlchemyDesktop(options);
  const globalWithWindow = globalThis as unknown as { window?: object };
  globalWithWindow.window = {
    localStorage: {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    } as unknown as Storage,
    alchemyDesktop: mockDesktop,
  } as unknown as Window;
  return mockDesktop;
}
