import { describe, expect, it } from "vitest";
import { readText } from "./helpers";

// Meaning guards for doc facts that link/path checks cannot see. Each phrase
// below drifted silently at least once while `docs:check` stayed green; keep
// the phrases (not the exact sentences) stable or update this test with them.
describe("docs semantic contract", () => {
  it("pins the clear-save deletion modes in the save contract", () => {
    const migrations = readText("src/features/alchemy/shared/storage/MIGRATIONS.md");
    for (const mode of ['"default"', '"localWipe"', '"wipeForReload"']) {
      expect(migrations, mode).toContain(mode);
    }
  });

  it("keeps the Armory randomness exception next to the run-stream rule", () => {
    const architecture = readText("Docs/ARCHITECTURE.md");
    expect(architecture).toContain("Armory crafting and dev spawning");
    expect(architecture).toContain("`Math.random`");
    expect(architecture).toContain("ARMORY.md#write-paths");
  });

  it("keeps the shop transaction atomicity rule", () => {
    expect(readText("Docs/ARCHITECTURE.md")).toContain("commit together");
  });

  it("keeps the chance branch-traversal order in the handler contract", () => {
    expect(readText("src/lib/game-data/effects/BATTLE_HANDLERS.md")).toContain(
      "success effects followed by failure effects",
    );
  });

  it("keeps a valid command example in the gameplay boundary workflow", () => {
    const workflows = readText("Docs/WORKFLOWS.md");
    for (const symbol of ["dispatchRunSessionCommand", "awardMaterialsDuringRun", "afterCommit"]) {
      expect(workflows, symbol).toContain(symbol);
    }
  });

  it("single-sources the changelog policy in the release guide", () => {
    expect(readText("AGENTS.md")).toContain("RELEASE.md#changelog-release-time-only");
  });
});
