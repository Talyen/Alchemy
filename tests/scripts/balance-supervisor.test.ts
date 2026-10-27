import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

it("retries a timed out lease, completes, and releases its own supervisor lock", () => {
  const root = mkdtempSync(join(tmpdir(), "alchemy-supervisor-"));
  const fakeLane = join(root, "lane.py");
  const counter = join(root, "count");
  writeFileSync(
    fakeLane,
    `import pathlib, sys\np = pathlib.Path(${JSON.stringify(counter)})\nif not p.exists():\n p.write_text('1')\n sys.exit(124)\nprint('Balance report complete: test')\n`,
  );
  try {
    const result = spawnSync(process.execPath, ["scripts/run-balance-supervisor.mjs"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ALCHEMY_ALLOW_HEAVY_LOCAL: "1",
        ALCHEMY_HEAVY_LANE: fakeLane,
        ALCHEMY_BALANCE_CHECKPOINT: root,
      },
      encoding: "utf8",
      timeout: 5000,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toContain("retrying with the same deadline");
    expect(readFileSync(counter, "utf8")).toBe("1");
    expect(existsSync(join(root, ".supervisor.lock"))).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
