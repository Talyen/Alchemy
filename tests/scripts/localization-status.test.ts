import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

it("preserves external packet evidence and quotes local packet paths in recovery guidance", () => {
  const external = mkdtempSync(join(tmpdir(), "alchemy-localization-"));
  const reports = join(process.cwd(), "reports");
  mkdirSync(reports, { recursive: true });
  const local = mkdtempSync(join(reports, "localization-status-"));
  try {
    const externalPacket = join(external, "packet.json");
    const localPacket = join(local, "packet with spaces.json");
    for (const packet of [externalPacket, localPacket]) writeFileSync(packet, "[]\n");
    const status = (packet: string) =>
      execFileSync(process.execPath, ["scripts/localization.mjs", "status", packet], { encoding: "utf8" });
    expect(status(externalPacket)).toContain("copy this packet into the task checkout");
    expect(readFileSync(externalPacket, "utf8")).toBe("[]\n");
    expect(status(localPacket)).toContain(`'${localPacket}'`);
    expect(readFileSync(localPacket, "utf8")).toBe("[]\n");
  } finally {
    rmSync(external, { recursive: true, force: true });
    rmSync(local, { recursive: true, force: true });
  }
}, 20000);
