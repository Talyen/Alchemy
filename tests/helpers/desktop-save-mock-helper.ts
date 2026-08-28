import { vi } from "vitest";

export interface MockDesktopOptions {
  saveCandidates?: string[];
  steamName?: string | null;
  writeSaveSuccess?: boolean;
  cloudWriteSuccess?: boolean;
  cloudDeleteSuccess?: boolean;
  richPresenceResult?: boolean;
}

type DesktopApi = NonNullable<Window["alchemyDesktop"]>;

export interface InstallDesktopApiOptions extends MockDesktopOptions {
  overrides?: Partial<DesktopApi>;
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
    steamSetRichPresence:
      options.richPresenceResult === undefined ? vi.fn() : vi.fn().mockResolvedValue(options.richPresenceResult),
    steamCloudRead: vi.fn().mockResolvedValue(null),
    steamCloudWrite: vi.fn().mockResolvedValue(options.cloudWriteSuccess ?? true),
    steamCloudDelete: vi.fn().mockResolvedValue(options.cloudDeleteSuccess ?? true),
  };
}

function assignWindow(partial: object) {
  const globalWithWindow = globalThis as unknown as { window?: object };
  globalWithWindow.window = partial as Window;
  return globalWithWindow;
}

export function teardownMockWindow() {
  const globalWithWindow = globalThis as unknown as { window?: object };
  delete globalWithWindow.window;
}

export function setupMockWindowBrowser(localStorage: Storage) {
  assignWindow({ localStorage });
}

export function setupMockWindowDesktop(options: MockDesktopOptions = {}) {
  const mockDesktop = createMockAlchemyDesktop(options);
  assignWindow({
    localStorage: {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    } as unknown as Storage,
    alchemyDesktop: mockDesktop,
  });
  return mockDesktop;
}

export function installDesktopApi(options: InstallDesktopApiOptions = {}): DesktopApi {
  const { overrides, ...mockOptions } = options;
  const api = createMockAlchemyDesktop({
    steamName: null,
    cloudWriteSuccess: false,
    cloudDeleteSuccess: false,
    richPresenceResult: false,
    ...mockOptions,
  }) as unknown as DesktopApi;
  if (overrides) Object.assign(api, overrides);
  const globalWithWindow = globalThis as unknown as { window?: { alchemyDesktop?: DesktopApi } };
  if (!globalWithWindow.window) globalWithWindow.window = {};
  globalWithWindow.window.alchemyDesktop = api;
  return api;
}
