import { afterEach, beforeEach } from "vitest";
import { resetStorageIoForTests } from "@/features/alchemy/shared/storage/io";
import { defaultGameSession } from "@/app/application-session";
import { setupMockWindowBrowser, teardownMockWindow } from "./desktop-save-mock-helper";

export function installStorageIoTestHooks(): void {
  beforeEach(async () => {
    await resetStorageIoForTests(defaultGameSession);
  });
}

export function installBrowserStorageIoTestHooks(): Record<string, string> {
  const storage: Record<string, string> = {};
  const localStorage = {
    getItem: (key: string) => storage[key] ?? null,
    setItem: (key: string, value: string) => {
      storage[key] = value;
    },
    removeItem: (key: string) => {
      delete storage[key];
    },
  } as Storage;
  installStorageIoTestHooks();
  beforeEach(() => {
    for (const key of Object.keys(storage)) delete storage[key];
    setupMockWindowBrowser(localStorage);
  });
  afterEach(teardownMockWindow);
  return storage;
}
