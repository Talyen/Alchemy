import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- scripts are JS without declarations
// @ts-ignore no types for vite-aliases.mjs
import { SSR_OPTIMIZE_INCLUDE } from "../../scripts/lib/vite-aliases.mjs";

const ROOT = join(import.meta.dirname, "../..");

describe("vite alias sync guard", () => {
  it("vitest.config.ts SSR include stays in sync with scripts/lib/vite-aliases.mjs", () => {
    const vitestConfig = readFileSync(join(ROOT, "vitest.config.ts"), "utf8");
    expect(SSR_OPTIMIZE_INCLUDE.length, "SSR_OPTIMIZE_INCLUDE must not be empty").toBeGreaterThan(0);
    // Canonical form is `include: [...SSR_OPTIMIZE_INCLUDE]` so literals are not duplicated.
    if (vitestConfig.includes("...SSR_OPTIMIZE_INCLUDE")) {
      expect(vitestConfig).toContain("SSR_OPTIMIZE_INCLUDE");
      expect(vitestConfig).toContain('from "./scripts/lib/vite-aliases.mjs"');
      return;
    }
    for (const entry of SSR_OPTIMIZE_INCLUDE) {
      expect(vitestConfig, `missing SSR_OPTIMIZE_INCLUDE entry: ${entry}`).toContain(`"${entry}"`);
    }
    // Ensure vitest.config does not contain extra entries beyond the shared list
    const includeMatch = vitestConfig.match(/include:\s*\[([\s\S]*?)\]/);
    expect(includeMatch).toBeTruthy();
    const quoted = [...(includeMatch![1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    const extra = quoted.filter((q) => q.startsWith("@/") && !SSR_OPTIMIZE_INCLUDE.includes(q));
    expect(extra, `vitest.config has extra SSR include not in vite-aliases.mjs: ${extra.join(", ")}`).toEqual([]);
  });
});
