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
      "src/features/alchemy/shared/stores/ports",
    ];
    const offenders = callerRoots.flatMap(sourceFiles).filter((path) => {
      const source = read(path);
      return source.includes("runSessionTransaction") || source.includes("run-session-transaction");
    });

    expect(offenders).toEqual([]);
  });

  it("exports the command API without leaking the coordinator", () => {
    const command = read("src/features/alchemy/shared/stores/run-session-command.ts");
    expect(command).toContain("export function dispatchRunSessionCommand");
    expect(command).toContain('from "./run-session-transaction"');
  });

  it("keeps focused session write ports inside the same command boundary", () => {
    for (const path of sourceFiles("src/features/alchemy/shared/stores/ports")) {
      expect(read(path), path).toContain("dispatchRunSessionCommand");
    }
  });

  it("keeps the battle read port data-only", () => {
    const readPort = read("src/features/alchemy/shared/stores/run-session-read-port.ts");
    const writePort = read("src/features/alchemy/shared/stores/ports/run-battle-write-port.ts");
    expect(readPort).toContain("getBattleReadView");
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

  it("keeps run-flow cross-concern calls typed and one-way", () => {
    const context = read("src/features/alchemy/run-loop/run/run-flow-context.ts");
    const handlers = read("src/features/alchemy/run-loop/run/run-flow-handlers.ts");

    expect(context).toContain("export type RunFlowContinuation");
    expect(context).toContain("dispatchContinuation");
    expect(context).not.toContain("completeRunVictory:");
    expect(context).not.toContain("advanceToNextDestination:");
    expect(handlers).toContain("createRunFlowContext(deps, dispatchContinuation)");
    expect(handlers).not.toContain("ctx.completeRunVictory");
    expect(handlers).not.toContain("ctx.advanceToNextDestination");
  });
});
