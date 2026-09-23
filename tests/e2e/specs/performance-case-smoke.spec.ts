import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test, expect } from "../../fixtures/e2e";
import { slow } from "../../playwright-tags";
import { injectExactSave } from "../save-injection";
import { BattlePage } from "../../pages/battle-page";
import { assertJourneyCase } from "../../../performance/journey-types";

test("generated performance checkpoint resumes and replays a visible card action", slow, async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const caseDir = testInfo.outputPath("generated-case");
  execFileSync(process.execPath, ["scripts/prepare-performance-cases.mjs", caseDir, "campaign-early"], {
    cwd: process.cwd(),
    timeout: 30_000,
  });
  const value: unknown = JSON.parse(readFileSync(path.join(caseDir, "campaign-early.case.json"), "utf8"));
  assertJourneyCase(value);
  expect(value.coverage.cards).toContain("shield-bash");
  expect(value.coverage.enemy).toBe("skeleton");

  const playFromCheckpoint = async (requestedLabel?: string) => {
    await injectExactSave(page, value.initialSave);
    await page.goto("/");
    const battle = new BattlePage(page);
    await battle.waitForOpeningHand();
    await expect(page.getByTestId("battle-enemy-art-panel").locator("img")).toHaveJSProperty("complete", true);
    const label = requestedLabel ?? (await battle.hand.filter({ visible: true }).first().getAttribute("aria-label"));
    if (!label) throw new Error("Playable card has no label");
    await page.getByRole("button", { name: label, exact: true }).first().click();
    await expect(battle.endTurnBtn).toBeVisible();
    return label;
  };

  const recordedLabel = await playFromCheckpoint();
  expect(await playFromCheckpoint(recordedLabel)).toBe(recordedLabel);
});
