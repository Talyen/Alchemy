import { describe, expect, it } from "vitest";
import { AWARD_MATERIALS_CALL_SITES } from "@/features/alchemy/run-loop/run/run-materials";
import { listNonTestSourceFiles, matchingFiles } from "./helpers";

// Positive counterpart to the alchemy/no-run-earned-add-materials lint (which
// bans addMaterialsToStockpile outside its owners): run-earned materials must
// flow through awardMaterialsDuringRun so the run tally stays accurate, and
// the tally itself must only be written inside the run-session write seam.
// The canonical site list lives in run-materials.ts; adding a grant path
// means updating it deliberately.
const AWARD_CALL_SITES: readonly string[] = AWARD_MATERIALS_CALL_SITES;

// The write seam is the run-session-write-port barrel plus its domain
// implementations under write/ (see Docs/ARCHITECTURE.md commands and writes).
const WRITE_SEAM_BARREL = "src/features/alchemy/shared/stores/run-session-write-port.ts";
const WRITE_SEAM_DIR = "src/features/alchemy/shared/stores/write/";

function isWriteSeam(path: string): boolean {
  return path === WRITE_SEAM_BARREL || path.startsWith(WRITE_SEAM_DIR);
}

describe("run materials award guard", () => {
  it("routes every run-earned material grant through the known award call sites", () => {
    const callers = matchingFiles(listNonTestSourceFiles(), /awardMaterialsDuringRun\s*\(/).filter(
      (path) => !isWriteSeam(path),
    );
    expect([...callers].sort()).toEqual([...AWARD_CALL_SITES].sort());
  });

  it("writes the run tally only inside the run-session write port", () => {
    // Assignment writes only; initial construction (run-init.ts object
    // literals, run-state-init defaults) is covered by the write seam owning
    // those initializers.
    const writers = matchingFiles(listNonTestSourceFiles(), /runMaterialsEarned\s*=/);
    expect(writers).toEqual([`${WRITE_SEAM_DIR}run-progress.ts`]);
  });

  it("writes the salvaged-currency tally only inside the run-session write port", () => {
    const writers = matchingFiles(listNonTestSourceFiles(), /runCurrenciesEarned\s*=/);
    expect(writers).toEqual([`${WRITE_SEAM_DIR}run-progress.ts`]);
  });
});
