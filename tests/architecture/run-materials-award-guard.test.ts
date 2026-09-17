import { describe, expect, it } from "vitest";
import { listNonTestSourceFiles, matchingFiles } from "./helpers";

// Positive counterpart to the alchemy/no-run-earned-add-materials lint (which
// bans addMaterialsToStockpile outside its owners): run-earned materials must
// flow through awardMaterialsDuringRun so the run tally stays accurate, and
// the tally itself must only be written inside the run-session write port.
// Adding a grant path means updating AWARD_CALL_SITES deliberately.
const AWARD_CALL_SITES = [
  "src/features/alchemy/run-loop/navigation/mystery-flow.ts",
  "src/features/alchemy/run-loop/run/reward-commands.ts",
  "src/features/alchemy/run-loop/run/victory-commands.ts",
  "src/features/alchemy/shared/stores/gear-session-command.ts",
];

const WRITE_PORT = "src/features/alchemy/shared/stores/run-session-write-port.ts";

describe("run materials award guard", () => {
  it("routes every run-earned material grant through the known award call sites", () => {
    const callers = matchingFiles(listNonTestSourceFiles(), /awardMaterialsDuringRun\s*\(/).filter(
      (path) => path !== WRITE_PORT,
    );
    expect([...callers].sort()).toEqual([...AWARD_CALL_SITES].sort());
  });

  it("writes the run tally only inside the run-session write port", () => {
    const writers = matchingFiles(listNonTestSourceFiles(), /runMaterialsEarned\s*=/);
    expect(writers).toEqual([WRITE_PORT]);
  });
});
