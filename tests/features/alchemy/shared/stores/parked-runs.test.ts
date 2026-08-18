import { describe, expect, it } from "vitest";
import {
  emptyParkedRuns,
  mostRecentResumableMode,
  omitParkedMode,
  touchRunRecency,
  removeRunRecency,
} from "@/features/alchemy/shared/stores/parked-runs";
import { makeActiveRunData } from "./active-run-data-fixture";

describe("parked run recency", () => {
  it("prefers the most recently touched live or parked mode", () => {
    const parked = emptyParkedRuns();
    parked.labyrinth = makeActiveRunData({ contentSystemType: "labyrinth" });
    const recency = touchRunRecency(touchRunRecency([], "labyrinth"), "campaign");
    expect(mostRecentResumableMode(recency, "campaign", parked, true)).toBe("campaign");
    expect(mostRecentResumableMode(["labyrinth"], null, parked, false)).toBe("labyrinth");
  });

  it("drops a mode from recency when its slot is cleared", () => {
    expect(removeRunRecency(["wildwood", "campaign"], "wildwood")).toEqual(["campaign"]);
  });

  it("omits a parked slot without mutating the source map", () => {
    const parked = emptyParkedRuns();
    parked.labyrinth = makeActiveRunData({ contentSystemType: "labyrinth" });
    parked.campaign = makeActiveRunData({ contentSystemType: "campaign" });
    const next = omitParkedMode(parked, "labyrinth");
    expect(next.labyrinth).toBeUndefined();
    expect(next.campaign).toBe(parked.campaign);
    expect(parked.labyrinth).toBeDefined();
  });
});
