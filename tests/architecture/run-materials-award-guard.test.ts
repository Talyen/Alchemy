import { describe, expect, it } from "vitest";
import { AWARD_MATERIALS_CALL_SITES } from "@/features/alchemy/run-loop/run/run-materials";
import { listNonTestSourceFiles, matchingFiles } from "./helpers";

// Positive counterpart to the alchemy/no-run-earned-add-materials lint (which
// bans addMaterialsToStockpile outside its owners): run-earned materials must
// flow through awardMaterialsDuringRun so the run tally stays accurate, and
// the tally itself must only be written inside the run-session write port.
// The canonical site list lives in run-materials.ts; adding a grant path
// means updating it deliberately.
const AWARD_CALL_SITES: readonly string[] = AWARD_MATERIALS_CALL_SITES;

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

  it("writes the salvaged-currency tally only inside the run-session write port", () => {
    const writers = matchingFiles(listNonTestSourceFiles(), /runCurrenciesEarned\s*=/);
    expect(writers).toEqual([WRITE_PORT]);
  });
});
