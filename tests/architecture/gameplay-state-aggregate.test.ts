import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

describe("gameplay aggregate boundary", () => {
  it("keeps one authoritative root and compatibility slices over it", () => {
    const aggregate = read("src/features/alchemy/shared/stores/gameplay-state-store.ts");
    expect(aggregate).toContain("create<GameplayState>()");
    expect(aggregate).toContain("subscribeGameplayCommits");

    for (const path of [
      "profile-store.ts",
      "gear-store.ts",
      "run-domain-store.ts",
      "run-profile-store.ts",
      "run-transient-store.ts",
      "run-battle-domain-store.ts",
    ]) {
      expect(read(`src/features/alchemy/shared/stores/${path}`), path).toContain("createSliceStore");
      expect(read(`src/features/alchemy/shared/stores/${path}`), path).not.toContain("create<");
    }
  });

  it("centralizes Gear-to-active-run health synchronization", () => {
    const armory = read("src/features/alchemy/meta/screens/armory/use-armory-controller.ts");
    const command = read("src/features/alchemy/shared/stores/gear-session-command.ts");
    expect(armory).toContain("dispatchGearMutationWithRunHealthSync");
    expect(armory).not.toContain("syncRunMaxHealthFromGearMutation");
    expect(command).toContain("syncRunMaxHealthFromGearMutation");
  });
});
