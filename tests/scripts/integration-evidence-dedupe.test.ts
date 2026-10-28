import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { evidenceDeduplicator } from "../../scripts/agent-worktree.mjs";

it("clones matching evidence into independent files and leaves trailer or unsupported copies alone", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "alchemy-evidence-dedupe-"));
  try {
    const first = path.join(root, "first.zip");
    const second = path.join(root, "second.zip");
    const trailer = path.join(root, "trailer.zip");
    const bytes = Buffer.alloc(300_000, 0x42);
    for (const file of [first, second, trailer]) fs.writeFileSync(file, bytes);
    let clones = 0;
    const deduplicate = evidenceDeduplicator({
      platform: "darwin",
      attributes: () => true,
      clone(source, target) {
        clones++;
        fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
      },
    });
    deduplicate(first, fs.statSync(first), "reports/first.zip");
    deduplicate(second, fs.statSync(second), "reports/second.zip");
    deduplicate(trailer, fs.statSync(trailer), "reports/trailer.zip");
    expect(clones).toBe(1);
    fs.writeFileSync(first, "changed");
    expect(fs.readFileSync(second)).toEqual(bytes);
    expect(fs.readFileSync(trailer)).toEqual(bytes);
    const fallback = evidenceDeduplicator({
      platform: "darwin",
      attributes: () => true,
      clone() {
        throw new Error("unsupported");
      },
    });
    fallback(second, fs.statSync(second), "reports/second.zip");
    fallback(trailer, fs.statSync(trailer), "reports/another.zip");
    expect(fs.readFileSync(trailer)).toEqual(bytes);
    expect(fs.readdirSync(root).sort()).toEqual(["first.zip", "second.zip", "trailer.zip"]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}, 15_000);

it("does not replace byte-identical files with different or unknown metadata", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "alchemy-evidence-metadata-"));
  try {
    const first = path.join(root, "first");
    const second = path.join(root, "second");
    for (const file of [first, second]) fs.writeFileSync(file, Buffer.alloc(300_000, 0x42));
    let clones = 0;
    const deduplicate = evidenceDeduplicator({
      platform: "darwin",
      attributes: (file) => file === first,
      clone() {
        clones++;
      },
    });
    deduplicate(first, fs.statSync(first), "reports/first");
    deduplicate(second, fs.statSync(second), "reports/second");
    expect(clones).toBe(0);
    expect(fs.readFileSync(second)).toEqual(fs.readFileSync(first));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
