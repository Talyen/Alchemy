import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

function read(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf8");
}

function sourceFiles(relativeDirectory: string): string[] {
  const absoluteDirectory = join(ROOT, relativeDirectory);
  return readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = join(relativeDirectory, entry.name);
    if (entry.isDirectory()) return sourceFiles(relativePath);
    return /\.(ts|tsx)$/.test(entry.name) ? [relativePath] : [];
  });
}

describe("run-session command boundary", () => {
  it("keeps gameplay mutation callers off the low-level transaction coordinator", () => {
    const callerRoots = [
      "src/features/alchemy/meta",
      "src/features/alchemy/run-loop",
      "src/features/alchemy/run-setup",
      "src/features/alchemy/shell",
    ];
    const offenders = callerRoots.flatMap(sourceFiles).filter((path) => {
      const source = read(path);
      return source.includes("runSessionTransaction") || source.includes("run-session-transaction");
    });

    expect(offenders).toEqual([]);
  });

  it("exports the command API as a self-contained module", () => {
    const command = read("src/features/alchemy/shared/stores/run-session-command.ts");
    const aggregate = read("src/features/alchemy/shared/stores/gameplay-state-store.ts");
    expect(command).toContain("export function dispatchRunSessionCommand");
    expect(command).toContain("produce(base");
    expect(command).toContain("applyGameplayStateUpdate(next, true)");
    // Commands do not nest or maintain a second transaction/effect coordinator.
    expect(command).not.toContain("beginGameplayTransaction");
    expect(command).not.toContain("commitGameplayTransaction");
    expect(command).not.toContain("transactionDepth");
    expect(command).not.toContain("transactionEffects");
    expect(command).not.toContain("transactionFailed");
    expect(command).not.toContain("getGameplayDraft");
    expect(command).not.toContain("installGameplayDraft");
    expect(aggregate).not.toContain("activeGameplayDraft");
    expect(aggregate).not.toContain("getGameplayDraft");
    expect(aggregate).not.toContain("installGameplayDraft");
  });

  it("keeps all session write commands accessible through a single barrel", () => {
    const writePort = read("src/features/alchemy/shared/stores/run-session-write-port.ts");
    // Core sample of every domain section to confirm it's all present. Simple
    // forwards are bound via `bindDraftAction` (`export const`); compound writes
    // stay `export function`.
    const exported = (name: string) => new RegExp(`export (?:function|const) ${name}`).test(writePort);
    for (const name of [
      "setRunDeck",
      "setBattleState",
      "commitBattleTransition",
      "setShopState",
      "setMysteryEvent",
      "setLabyrinthMap",
      "setRewardState",
      "applyRunStartSnapshot",
      "addMaterials",
    ]) {
      expect(exported(name), `write-port must export ${name}`).toBe(true);
    }
    expect(writePort).toContain("bindDraftAction");
    expect(writePort).not.toContain("bindWriteAction");
  });

  it("keeps feature-facing read ports free of aggregate actions", () => {
    const readPort = read("src/features/alchemy/shared/stores/run-session-read-port.ts");
    const profilePort = read("src/features/alchemy/shared/stores/profile-store.ts");
    const reactPorts = read("src/features/alchemy/shared/stores/run-session-react-ports.ts");
    const actionSelector = read("src/features/alchemy/shared/stores/store-actions.ts");

    expect(readPort).not.toMatch(/runActions|runProfileActions|createRunRandomSource|\.set[A-Z]/);
    expect(profilePort).toContain("readProfileStore(): ProfileReadView");
    expect(reactPorts).not.toMatch(
      /snapshot\.(domain|transient|battle|runProfile)\.[A-Za-z]+(?:set|add|award|clear|reset|next)/,
    );
    expect(actionSelector).not.toContain("runProfileActions");
  });

  it("keeps feature callers off mutators exposed by imperative reads", () => {
    const callerRoots = [
      "src/features/alchemy/meta",
      "src/features/alchemy/run-loop",
      "src/features/alchemy/run-setup",
      "src/features/alchemy/shell",
    ];
    const offenders = callerRoots.flatMap(sourceFiles).filter((path) => {
      const source = read(path);
      return /read(?:ActiveRun|RunProfile|RunSession)\(\)\.(?:set|add|award|clear|reset|next)[A-Z]/.test(source);
    });

    expect(offenders).toEqual([]);
  });

  it("keeps the battle read port data-only", () => {
    const readPort = read("src/features/alchemy/shared/stores/run-session-read-port.ts");
    const writePort = read("src/features/alchemy/shared/stores/run-session-write-port.ts");
    expect(readPort).toContain("readBattle");
    expect(readPort).not.toMatch(/set(?:SyncedBattleState|PendingBattleTransition|DisplayOverrides|HasActiveBattle)/);
    expect(writePort).toContain("dispatchRunSessionCommand");
    expect(writePort).toContain("commitBattleTransition");

    const battleCallers = sourceFiles("src/features/alchemy/run-loop/battle");
    const offenders = battleCallers.filter((path) => {
      const source = read(path);
      return /(?:readBattle\(\)|getStore\(\)|getBattleSessionStore\(\))\.(?:set|clear|initialize)/.test(source);
    });
    expect(offenders).toEqual([]);
  });

  it("keeps run-flow cross-concern calls as direct sibling handler invocations", () => {
    const handlers = read("src/features/alchemy/run-loop/run/run-flow-handlers.ts");
    const deps = read("src/features/alchemy/run-loop/run/run-flow-handler-deps.ts");
    const progression = read("src/features/alchemy/run-loop/run/run-flow-progression.ts");

    expect(deps).toContain("export interface RunFlowSiblingHandlers");
    expect(handlers).toContain("createProgressionHandlers(deps, sibling)");
    expect(handlers).toContain("createRewardHandlers(deps, sibling)");
    expect(handlers).toContain("createDestinationScreenHandlers(deps, sibling)");
    expect(progression).toContain("handlers.prepareDestinationScreen()");
    expect(progression).toContain("handlers.completeRunVictory(");
    expect(handlers).not.toContain("dispatchContinuation");
    expect(handlers).not.toContain("RunFlowContinuation");
  });
});
