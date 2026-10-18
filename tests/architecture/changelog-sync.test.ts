import { expect, it } from "vitest";
import { CURRENT_GAME_BUILD_VERSION } from "@/lib/validation";
import { readText } from "./helpers";

it("keeps the saved build version aligned with package.json", () => {
  const pkg = JSON.parse(readText("package.json")) as { version: string };
  expect(CURRENT_GAME_BUILD_VERSION).toBe(pkg.version);
});
