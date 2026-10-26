import { createRequire } from "node:module";
import { afterEach, expect, it, vi } from "vitest";
import { deferred } from "../helpers/deferred";

interface CloudStorage {
  read: (slot?: "recovery") => Promise<string | null>;
  write: (data: string, slot?: "recovery") => Promise<boolean>;
  remove: (slot?: "recovery") => Promise<boolean>;
}
const { createSteamCloudStorage } = createRequire(import.meta.url)("../../desktop/steam-cloud-storage.cjs") as {
  createSteamCloudStorage: (options: object) => CloudStorage;
};

afterEach(() => vi.restoreAllMocks());

function fixture() {
  const files = new Map<string, string>();
  const cloud = {
    isEnabledForAccount: () => true,
    isEnabledForApp: () => true,
    fileExists: (name: string) => files.has(name),
    readFile: vi.fn(async (name: string): Promise<Buffer | null> => Buffer.from(files.get(name)!)),
    writeFile: vi.fn(async (name: string, value: string) => {
      files.set(name, value);
      return true;
    }),
    deleteFile: vi.fn(async (name: string) => {
      files.delete(name);
      return true;
    }),
  };
  const storage = createSteamCloudStorage({
    resolveSlot: (slot?: "recovery") => ({ name: slot ?? "primary" }),
    getSteam: () => ({ cloud }),
    isSavePayload: (value: unknown) => typeof value === "string",
    stampOwner: (value: string) => value,
    maxPayloadBytes: 1000,
  });
  return { storage, cloud, files };
}

it("a replacement renderer's deletion waits for earlier uploads in either slot", async () => {
  const { storage, cloud, files } = fixture();
  const started = deferred<void>();
  const release = deferred<void>();
  cloud.writeFile.mockImplementationOnce(async (name, value) => {
    started.resolve();
    await release.promise;
    files.set(name, value);
    return true;
  });
  // These requests share no renderer-side mirror or session queue.
  const upload = storage.write("departed renderer", "recovery");
  await started.promise;
  const deletedPrimary = storage.remove();
  const deletedRecovery = storage.remove("recovery");
  const read = storage.read("recovery");
  release.resolve();
  expect(await upload).toBe(true);
  expect(await deletedPrimary).toBe(true);
  expect(await deletedRecovery).toBe(true);
  expect(await read).toBeNull();
  expect(files.size).toBe(0);
});

it("reads complete uploads and continues after asynchronous Cloud failures", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { storage, cloud } = fixture();
  const release = deferred<void>();
  cloud.writeFile.mockImplementationOnce(async () => {
    await release.promise;
    throw new Error("Steam unavailable");
  });
  const failed = storage.write("old");
  const saved = storage.write("new");
  const read = storage.read();
  release.resolve();
  expect(await failed).toBe(false);
  expect(await saved).toBe(true);
  expect(await read).toBe("new");
});

it.each([null, Buffer.alloc(1001)])("protects an existing unreadable Cloud save (%s)", async (data) => {
  const { storage, cloud, files } = fixture();
  files.set("primary", "existing");
  cloud.readFile.mockImplementationOnce(async () => data);
  await expect(storage.read()).rejects.toThrow();
  expect(await storage.read()).toBe("existing");
});

it.each(["account", "app"])(
  "does not restore, mutate or delete Cloud cache when %s Cloud is disabled",
  async (setting) => {
    const { storage, cloud, files } = fixture();
    files.set("primary", "protected Cloud progress");
    if (setting === "account") cloud.isEnabledForAccount = () => false;
    else cloud.isEnabledForApp = () => false;
    expect(await storage.read()).toBeNull();
    expect(await storage.write("local progress")).toBe(true);
    expect(await storage.remove()).toBe(true);
    expect(cloud.readFile).not.toHaveBeenCalled();
    expect(cloud.writeFile).not.toHaveBeenCalled();
    expect(cloud.deleteFile).not.toHaveBeenCalled();
    expect(files.get("primary")).toBe("protected Cloud progress");
    cloud.isEnabledForAccount = () => true;
    cloud.isEnabledForApp = () => true;
    expect(await storage.read()).toBe("protected Cloud progress");
  },
);
