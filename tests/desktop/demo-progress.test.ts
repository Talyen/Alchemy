import { createRequire } from "node:module";
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
const require = createRequire(import.meta.url);
const { createDemoProgressBridge, stampSaveOwner } = require("../../desktop/demo-progress.cjs");
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});
async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), "alchemy-full-"));
  const demoDirectory = await mkdtemp(path.join(tmpdir(), "alchemy-demo-"));
  directories.push(directory, demoDirectory);
  const files = new Map<string, string>();
  const client = {
    localplayer: { getSteamId: () => ({ steamId64: 123n }) },
    cloud: {
      isEnabledForAccount: () => true,
      isEnabledForApp: () => true,
      fileExists: (name: string) => files.has(name),
      readFile: async (name: string) => Buffer.from(files.get(name)!),
      writeFile: vi.fn(async (name: string, data: string) => {
        files.set(name, data);
        return true;
      }),
    },
  };
  const bridge = createDemoProgressBridge({
    directory,
    demoDirectory,
    getSteam: () => client,
    isSavePayload: (data: string) => data.length < 10000,
    edition: "full",
    platform: "win32",
  });
  return { directory, demoDirectory, files, client, bridge };
}
describe("desktop demo transfer isolation", () => {
  it("reads owned demo cloud and local backups and excludes another account", async () => {
    const f = await fixture();
    f.files.set("demo-save.json", JSON.stringify({ steamAccountId: "123", gold: 21 }));
    f.files.set("demo-save-recovery.json", JSON.stringify({ steamAccountId: "999", gold: 90 }));
    await writeFile(path.join(f.demoDirectory, "save.json.bak.1"), JSON.stringify({ steamAccountId: "123", gold: 19 }));
    const source = await f.bridge.readSource();
    expect(source.readFailed).toBe(false);
    expect(source.candidates.map((data: string) => JSON.parse(data).gold)).toEqual([21, 19]);
  });
  it("protects any existing full save including malformed data and temporary writes", async () => {
    const f = await fixture();
    await writeFile(path.join(f.directory, "save.json.tmp"), "broken");
    expect((await f.bridge.readSource()).fullSaveExists).toBe(true);
  });
  it("protects a cloud-only full save", async () => {
    const f = await fixture();
    f.files.set("save-recovery.json", "broken");
    expect((await f.bridge.readSource()).fullSaveExists).toBe(true);
  });
  it("retains a receipt outside progress and never alters demo files", async () => {
    const f = await fixture();
    const data = JSON.stringify({ steamAccountId: "123", gold: 15 });
    await writeFile(path.join(f.demoDirectory, "save.json"), data);
    expect(await f.bridge.complete()).toBe(true);
    expect((await f.bridge.readSource()).initialized).toBe(true);
    expect(f.files.has("full-demo-initialization.json")).toBe(true);
    expect(await readFile(path.join(f.demoDirectory, "save.json"), "utf8")).toBe(data);
  });
  it("treats cloud failures as unverified rather than a fresh profile", async () => {
    const f = await fixture();
    f.client.cloud.fileExists = () => {
      throw new Error("offline");
    };
    expect((await f.bridge.readSource()).readFailed).toBe(true);
  });
  it.each(["rejected", "thrown"])("preserves a local wipe receipt when Cloud writes are %s", async (failure) => {
    const f = await fixture();
    f.client.cloud.writeFile.mockImplementation(async () => {
      if (failure === "thrown") throw new Error("offline");
      return false;
    });
    expect(await f.bridge.complete({ localOnly: true })).toBe(true);
    expect(await readFile(path.join(f.directory, "demo-initialization.json"), "utf8")).toBe("initialized");
    expect((await f.bridge.readSource()).initialized).toBe(true);
    expect(await f.bridge.complete()).toBe(false);
  });
  it("stamps the current account into disk and cloud snapshots", async () => {
    const f = await fixture();
    expect(JSON.parse(stampSaveOwner('{"gold":9}', f.client))).toEqual({ gold: 9, steamAccountId: "123" });
  });
});
