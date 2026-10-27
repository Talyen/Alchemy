import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { readBalanceShards } from "../../scripts/lib/balance-shards.mjs";

it("combines complete shards and rejects missing, duplicate, and incompatible inputs", () => {
  const root = mkdtempSync(join(tmpdir(), "alchemy-shards-"));
  const identity = { version: 1, sourceHash: "abc", options: { mode: "full" } };
  const write = (dir: string, path: string, value: unknown) =>
    writeFileSync(join(root, dir, path), JSON.stringify(value));
  try {
    for (const index of [0, 1]) {
      const dir = `shard-${index}`;
      mkdirSync(join(root, dir, "core"), { recursive: true });
      mkdirSync(join(root, dir, "boons"));
      write(dir, "manifest.json", identity);
      write(dir, "shard.json", { index, count: 2, commit: "commit-1" });
    }
    write("shard-0", "core/0.json", { value: 0 });
    write("shard-1", "core/1.json", { value: 1 });
    write("shard-0", "boons/0.json", { value: 2 });
    const expected = [
      ["core", 2],
      ["boons", 1],
    ] as const;
    expect(
      readBalanceShards(root, identity, expected, "commit-1").map((group: { value: unknown }) => group.value),
    ).toEqual([{ value: 0 }, { value: 2 }, { value: 1 }]);
    rmSync(join(root, "shard-0", "boons/0.json"));
    expect(() => readBalanceShards(root, identity, expected, "commit-1")).toThrow(/missing or unexpected/);
    write("shard-0", "boons/0.json", { value: 2 });
    write("shard-1", "shard.json", { index: 0, count: 2, commit: "commit-1" });
    expect(() => readBalanceShards(root, identity, expected, "commit-1")).toThrow(/duplicate shard/);
    write("shard-1", "shard.json", { index: 1, count: 2, commit: "commit-1" });
    write("shard-1", "manifest.json", { ...identity, sourceHash: "different" });
    expect(() => readBalanceShards(root, identity, expected, "commit-1")).toThrow(/source or options differ/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
