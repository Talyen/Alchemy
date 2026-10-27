import { expect, it } from "vitest";
import { taskCheckIsCurrent } from "../../scripts/lib/agent/task-evidence.mjs";

it("only treats an exact task receipt as current", () => {
  const current = { main: "main-a", digest: { head: "task-a", hash: "source-a" }, selected: ["a", "b"] };
  const receipt = {
    selection: "task",
    status: "passed",
    mainHead: "main-a",
    sourceHead: "task-a",
    sourceDigest: "source-a",
    selectedPaths: ["b", "a"],
  };
  expect(taskCheckIsCurrent(receipt, current)).toBe(true);
  expect(taskCheckIsCurrent({ ...receipt, status: "failed" }, current)).toBe(true);
  for (const stale of [
    { ...receipt, mainHead: "main-old" },
    { ...receipt, sourceHead: "task-old" },
    { ...receipt, sourceDigest: "source-old" },
    { ...receipt, selectedPaths: ["a"] },
    { ...receipt, selection: "other" },
    { ...receipt, status: undefined },
  ])
    expect(taskCheckIsCurrent(stale, current)).toBe(false);
});
