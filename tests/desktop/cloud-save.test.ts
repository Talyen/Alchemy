import { createRequire } from "node:module";
import { expect, it, vi } from "vitest";
const require = createRequire(import.meta.url);
const { readCloudSave } = require("../../desktop/cloud-save.cjs");
it.each([null, Buffer.from("oversized")])(
  "reports an existing unreadable Cloud save instead of pretending it is absent (%s)",
  async (data) => {
    const client = { cloud: { fileExists: () => true, readFile: vi.fn(async () => data) } };
    await expect(readCloudSave(client, "save.json", 3)).rejects.toThrow();
  },
);
it("distinguishes a missing Cloud file from an unreadable one", async () => {
  const readFile = vi.fn();
  expect(await readCloudSave({ cloud: { fileExists: () => false, readFile } }, "save.json", 3)).toBeNull();
  expect(readFile).not.toHaveBeenCalled();
});
