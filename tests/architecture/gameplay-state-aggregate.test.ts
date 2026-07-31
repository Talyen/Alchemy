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
    expect(aggregate).toContain("run: RunDomainDataState");
    expect(aggregate).toContain("session: RunSessionFields");
    expect(aggregate).toContain("battle: RunDomainBattleState");
    expect(aggregate).toContain("runProfile: PermanentProgressFields");
    expect(aggregate).not.toMatch(/activeRun:\s*RunDomainData/);

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

  it("keeps the committed compatibility snapshot projected from nested domains", () => {
    const transaction = read("src/features/alchemy/shared/stores/run-session-transaction.ts");
    const queries = read("src/features/alchemy/shared/stores/run-session-queries.ts");
    expect(transaction).toContain("createRunSessionStoreSnapshot");
    expect(queries).toContain("projectRunDomain");
    expect(queries).toContain("projectTransient");
    expect(queries).toContain("projectBattle");
    expect(transaction).not.toContain("domain: state as");
    expect(transaction).not.toContain("transient: state as");
  });

  it("centralizes Gear-to-active-run health synchronization", () => {
    const armory = read("src/features/alchemy/meta/screens/armory/use-armory-controller.ts");
    const command = read("src/features/alchemy/shared/stores/gear-session-command.ts");
    expect(armory).toContain("dispatchGearMutationWithRunHealthSync");
    expect(armory).not.toContain("syncRunMaxHealthFromGearMutation");
    expect(command).toContain("syncRunMaxHealthFromGearMutation");
  });
});
