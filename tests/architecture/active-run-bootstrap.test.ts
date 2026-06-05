import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

function read(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf8");
}

describe("active run bootstrap", () => {
  it("applies persisted currentScreen during domain restore", () => {
    const source = read("src/features/alchemy/shared/stores/run-transitions.ts");
    expect(source).toContain("activeRun?.currentScreen");
    expect(source).toContain("store.setScreen(activeRun.currentScreen");
  });

  it("restores active run before paint in the run controller", () => {
    const source = read("src/features/alchemy/shell/use-alchemy-run-controller.ts");
    expect(source).toContain("useLayoutEffect");
    expect(source).toMatch(/useLayoutEffect\([\s\S]*restoreActiveRunToStores/);
  });
});
