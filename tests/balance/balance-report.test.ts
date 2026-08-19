import { describe, expect, it } from "vitest";
import {
  buildBalanceReport,
  evaluateBalanceFindings,
  formatFindingObserved,
  renderBalanceFindingsHtml,
  renderBalanceFindingsJson,
  renderBalanceReportHtml,
  renderBalanceReportJson,
  appliesFightPacingFromEnv,
  type BalanceLoadoutMode,
  type BalancePlayPolicy,
} from "@/lib/balance";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const shouldRunBalanceReport = process.env.ALCHEMY_BALANCE_SIM === "1";
const describeBalance = shouldRunBalanceReport ? describe : describe.skip;
const iterations = Number.parseInt(process.env.ALCHEMY_BALANCE_ITERATIONS ?? "100", 10);
const trinketIterations = Math.max(20, Math.floor(iterations / 2));
const cardIterations = Math.max(30, Math.floor(iterations / 3));
const deckSeeds = Number.parseInt(process.env.ALCHEMY_BALANCE_DECK_SEEDS ?? "3", 10);
const policy = (process.env.ALCHEMY_BALANCE_POLICY ?? "random-playable") as BalancePlayPolicy;
const loadoutMode = (process.env.ALCHEMY_BALANCE_LOADOUT ?? "typical") as BalanceLoadoutMode;
const appliesFightPacing = appliesFightPacingFromEnv();

const reportDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "reports");
const fullDir = join(reportDir, "balance-full");
const htmlFile = join(fullDir, "matrix.html");
const jsonFile = join(fullDir, "matrix.json");
const findingsHtmlFile = join(reportDir, "balance-findings.html");
const findingsJsonFile = join(reportDir, "balance-findings.json");

describeBalance("balance report", () => {
  it("prints battle balance metrics", { timeout: 1_800_000 }, () => {
    const options = {
      iterations,
      trinketIterations,
      cardIterations,
      policy,
      loadoutMode,
      deckSeeds,
      appliesFightPacing,
    };
    const model = buildBalanceReport(options);
    const findings = evaluateBalanceFindings(model);

    console.info(
      `Balance simulation policy=${policy} loadout=${loadoutMode} iterations=${iterations} trinketIterations=${trinketIterations} cardIterations=${cardIterations} deckSeeds=${deckSeeds}`,
    );
    console.info(
      `Findings ${findings.findings.length}/${findings.totalBeforeCap} (omitted ${findings.omitted}). Grouped by issue type. Recommendations are discussion-only.`,
    );
    for (const finding of findings.findings) {
      const cluster = finding.clusterSize && finding.clusterSize > 1 ? ` cluster=${finding.clusterSize}` : "";
      console.info(
        `[${finding.severity}] ${finding.bucket} ${finding.tier} ${finding.scope} ${finding.title} ${finding.metric}=${formatFindingObserved(finding.metric, finding.observed)} band=${finding.band}${cluster} · ${finding.worstScenario}`,
      );
    }

    mkdirSync(fullDir, { recursive: true });
    writeFileSync(htmlFile, renderBalanceReportHtml(model, options), "utf-8");
    writeFileSync(jsonFile, renderBalanceReportJson(model, options), "utf-8");
    writeFileSync(findingsHtmlFile, renderBalanceFindingsHtml(findings, model), "utf-8");
    writeFileSync(findingsJsonFile, renderBalanceFindingsJson(findings, model, options), "utf-8");
    console.info(`Findings HTML written to ${findingsHtmlFile}`);
    console.info(`Findings JSON written to ${findingsJsonFile}`);

    expect(model.enemies.length).toBeGreaterThan(0);
    expect(model.classes).toHaveLength(8);
    expect(findings.findings.every((finding) => finding.recommendation.length > 0)).toBe(true);
  });
});
