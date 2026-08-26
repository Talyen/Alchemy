import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  hasTestOwner,
  isCheckableSourceFile,
  parseTestOwnerArgs,
  unownedAddedSourceFiles,
} from "../../scripts/check-test-owners.mjs";
import { formatRouteHintLine, routeHintForPath } from "../../scripts/lib/route-hints.mjs";

describe("check-test-owners", () => {
  it("skips generated files, type modules, and screens", () => {
    expect(isCheckableSourceFile("src/lib/game-data/assets.generated.ts")).toBe(false);
    expect(isCheckableSourceFile("src/lib/gear/types.ts")).toBe(false);
    expect(isCheckableSourceFile("src/features/alchemy/run-loop/screens/destination-screen.tsx")).toBe(false);
    expect(isCheckableSourceFile("src/lib/battle/damage-calc.ts")).toBe(true);
  });

  it("requires a basename-mirrored test for src/lib files", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "test-owners-"));
    try {
      fs.mkdirSync(path.join(root, "tests/lib/battle"), { recursive: true });
      fs.writeFileSync(path.join(root, "tests/lib/battle/damage-calc.test.ts"), "export {}");
      expect(hasTestOwner("src/lib/battle/new-helper.ts", root)).toBe(false);
      fs.writeFileSync(path.join(root, "tests/lib/battle/new-helper.test.ts"), "export {}");
      expect(hasTestOwner("src/lib/battle/new-helper.ts", root)).toBe(true);
      expect(unownedAddedSourceFiles(["src/lib/brand-new/mod.ts", "src/lib/battle/new-helper.ts"], root)).toEqual([
        "src/lib/brand-new/mod.ts",
      ]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("treats a mirrored test directory as an owner outside src/lib", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "test-owners-"));
    try {
      fs.mkdirSync(path.join(root, "tests/features/alchemy/run-loop/shop"), { recursive: true });
      fs.writeFileSync(
        path.join(root, "tests/features/alchemy/run-loop/shop/create-shop-actions.test.ts"),
        "export {}",
      );
      expect(hasTestOwner("src/features/alchemy/run-loop/shop/new-helper.ts", root)).toBe(true);
      expect(hasTestOwner("src/features/alchemy/run-loop/other/mod.ts", root)).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("parses base and head flags", () => {
    expect(parseTestOwnerArgs(["--base", "abc", "--head", "def"])).toEqual({ base: "abc", head: "def", help: false });
  });
});

describe("route hints", () => {
  it("names save and shop focused E2E from changed paths", () => {
    const save = routeHintForPath("src/features/alchemy/shared/storage/io.ts");
    expect(save.focusedE2E).toContain("save");
    expect(formatRouteHintLine(save)).toContain("CI focused E2E: save");

    const shop = routeHintForPath("src/features/alchemy/run-loop/screens/alchemist-shop-screen.tsx");
    expect(shop.focusedE2E).toContain("shop");

    const shopDomain = routeHintForPath("src/features/alchemy/run-loop/shop/create-shop-actions.ts");
    expect(shopDomain.focusedE2E).toContain("shop");
  });
});
