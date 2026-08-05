import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

describe("gameplay aggregate boundary", () => {
  it("keeps one authoritative root and no duplicate run-lifetime stores", () => {
    const aggregate = read("src/features/alchemy/shared/stores/gameplay-state-store.ts");
    expect(aggregate).toContain("create<GameplayState>()");
    expect(aggregate).toContain("subscribeGameplayCommits");
    expect(aggregate).toContain("run: RunDomainDataState");
    expect(aggregate).toContain("session: RunSessionFields");
    expect(aggregate).toContain("battle: RunDomainBattleState");
    expect(aggregate).toContain("runProfile: PermanentProgressFields");
    expect(aggregate).not.toMatch(/activeRun:\s*RunDomainData/);

    for (const path of [
      "run-domain-store.ts",
      "run-profile-store.ts",
      "run-transient-store.ts",
      "run-battle-domain-store.ts",
      "run-session-queries.ts",
    ]) {
      expect(existsSync(join(ROOT, `src/features/alchemy/shared/stores/${path}`)), path).toBe(false);
    }
    for (const path of ["profile-store.ts", "gear-store.ts"]) {
      expect(read(`src/features/alchemy/shared/stores/${path}`), path).toContain("useGameplayStateStore");
      expect(read(`src/features/alchemy/shared/stores/${path}`), path).not.toContain("create<");
    }
  });

  it("keeps transaction coordination separate from aggregate reads", () => {
    const transaction = read("src/features/alchemy/shared/stores/run-session-command.ts");
    const readPort = read("src/features/alchemy/shared/stores/run-session-read-port.ts");
    expect(transaction).not.toContain("createRunSessionStoreSnapshot");
    expect(transaction).not.toContain("useRunSessionCommitStore");
    expect(readPort).toContain("readGameplayState");
    expect(readPort).not.toContain("run-session-queries");
  });

  it("centralizes Gear-to-active-run health synchronization", () => {
    const armory = read("src/features/alchemy/meta/screens/armory/use-armory-controller.ts");
    const command = read("src/features/alchemy/shared/stores/gear-session-command.ts");
    expect(armory).toContain("dispatchGearMutationWithRunHealthSync");
    expect(armory).not.toContain("syncRunMaxHealthFromGearMutation");
    expect(command).toContain("syncRunMaxHealthFromGearMutation");
  });
});
