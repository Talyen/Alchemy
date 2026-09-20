import { careerCohort, summarizeProgress } from "./progress-telemetry";
import type { AgentPlaythroughSummary } from "./agent-report";
import { escapeHtml, renderReportPage } from "@/lib/balance/report-layout";
import type { CareerResult } from "./types";

function renderAgentBrief(summary: AgentPlaythroughSummary): string {
  const findings = summary.findings
    .map(
      (finding) =>
        `<details><summary>${escapeHtml(`[${finding.priority.toUpperCase()}] ${finding.title}`)}</summary><p><strong>Claim:</strong> ${escapeHtml(finding.claim)}</p><p><strong>Confidence:</strong> ${escapeHtml(finding.confidence)}</p><p><strong>Evidence:</strong> ${escapeHtml(JSON.stringify(finding.evidence))}</p><p><strong>Interpretation:</strong> ${escapeHtml(finding.interpretation)}</p><p><strong>Next step:</strong> ${escapeHtml(finding.nextStep)}</p>${finding.selector ? `<p><strong>Evidence selector:</strong> <code>${escapeHtml(JSON.stringify(finding.selector))}</code></p>` : ""}</details>`,
    )
    .join("");
  return `<section><h2>Agent insight brief</h2><p>${summary.completed}/${summary.planned} careers completed; ${summary.incomplete} incomplete. Findings are observations and hypotheses, not calibrated pass/fail gates.</p>${findings || "<p>No findings were generated.</p>"}<h3>Recommended next experiments</h3><ul>${summary.recommendations.map((recommendation) => `<li>${escapeHtml(recommendation)}</li>`).join("")}</ul></section>`;
}

export function renderPlaythroughReport(
  results: CareerResult[],
  planned = results.length,
  workerFailures: string[] = [],
  agentSummary?: AgentPlaythroughSummary,
): string {
  const completed = results.filter((result) => result.status === "completed").length;
  const rows = results
    .map(
      (result) =>
        `<tr><td>${escapeHtml(result.cohort)}</td><td>${escapeHtml(`${result.config.hero}/${result.config.mode}/${result.config.policy}`)}</td><td>${result.config.seed}</td><td>${escapeHtml(result.status)}</td><td>${result.outcomes.filter((outcome) => outcome.outcome === "victory").length}/${result.outcomes.length}</td><td>${result.journal.length}</td><td>${Math.round(result.elapsedMs)}</td></tr>`,
    )
    .join("");
  const details = results
    .map(
      (result) =>
        `<details><summary>${escapeHtml(`${result.config.hero} ${result.config.mode} seed ${result.config.seed}`)}</summary><h3>Reached choices</h3><pre>${escapeHtml(JSON.stringify(result.coverage, null, 2))}</pre><h3>Economy and progression</h3><table><tr><th>Run</th><th>Rooms</th><th>Gold</th><th>Materials</th><th>Deck</th></tr>${result.telemetry.economy.map((point) => `<tr><td>${point.run + 1}</td><td>${point.rooms}</td><td>${point.gold}</td><td>${point.materials}</td><td>${point.deckSize}</td></tr>`).join("")}</table><h3>Card opportunities</h3><p>Observed and playable counts are decision opportunities, not distinct draws. Repeated observations count separately; passive item triggers are not measured.</p><pre>${escapeHtml(JSON.stringify(result.telemetry.cards, null, 2))}</pre><h3>Combat maxima (advisory)</h3><pre>${escapeHtml(JSON.stringify(result.telemetry.anomalies, null, 2))}</pre><h3>Milestones (zero-based run index)</h3><pre>${escapeHtml(JSON.stringify(result.telemetry.milestones, null, 2))}</pre></details>`,
    )
    .join("");
  const progress = summarizeProgress(results)
    .map(
      (group) =>
        `<details><summary>${escapeHtml(group.cohort)}: ${group.completed}/${group.planned} careers completed</summary><h3>Observed survival by rooms reached</h3><p>Denominator: ${group.runs} ended runs from completed careers. Runs within a career are correlated.</p><table><tr><th>Room</th><th>Reached</th><th>Defeats here</th></tr>${group.mortality.map((point) => `<tr><td>${point.room}</td><td><meter min="0" max="${Math.max(1, point.denominator)}" value="${point.reached}"></meter> ${point.reached}/${point.denominator}</td><td>${point.defeats}</td></tr>`).join("")}</table><h3>Boss reach and conditional outcomes</h3><table><tr><th>Boss</th><th>Careers reaching boss</th><th>Victories / encounters</th></tr>${group.bosses.map((boss) => `<tr><td>${escapeHtml(boss.enemy)}</td><td>${boss.reachedCareers}/${boss.careers}</td><td>${boss.victories}/${boss.encounters}</td></tr>`).join("")}</table><h3>Progression opportunities reached</h3><table><tr><th>Milestone</th><th>Reached / careers</th><th>Unreached</th><th>Mean first run among reached</th></tr>${group.milestones.map((milestone) => `<tr><td>${escapeHtml(milestone.kind)}</td><td>${milestone.reached}/${milestone.careers}</td><td>${milestone.unreached}</td><td>${milestone.meanFirstRunAmongReached ?? "not reached"}</td></tr>`).join("")}</table></details>`,
    )
    .join("");
  return renderReportPage({
    title: "Headless playthroughs",
    body: `<h1>Headless playthroughs</h1><p>${completed}/${planned} careers completed. Incomplete careers fail the correctness gate.</p><p>Targeted fixtures do not establish earned progression. Balance findings remain advisory; small samples cannot establish win rates or economic deadlocks. Unlisted choices and milestones were not reached.</p>${agentSummary ? renderAgentBrief(agentSummary) : ""}<ul>${workerFailures.map((error) => `<li class="neg">${escapeHtml(error)}</li>`).join("")}${results
      .filter((result) => result.error)
      .slice(0, 3)
      .map((result) => `<li class="neg">${escapeHtml(result.error ?? "")}</li>`)
      .join(
        "",
      )}</ul><table><tr><th>Cohort</th><th>Strategy</th><th>Seed</th><th>Status</th><th>Victories / ended runs</th><th>Actions</th><th>Runtime ms</th></tr>${rows}</table><h2>Cohort progression</h2>${progress}<h2>Career details</h2>${details}`,
  });
}

/** Paired career means keep correlated battles/runs out of the sample denominator. */
export function comparePlaythroughReports(baseline: CareerResult[], current: CareerResult[]) {
  const manifest = (results: CareerResult[]) => results.map(({ config }) => JSON.stringify(config));
  if (JSON.stringify(manifest(baseline)) !== JSON.stringify(manifest(current)))
    throw new Error("Comparison requires the same ordered scenario manifest (including fixtures and policies)");
  if ([...baseline, ...current].some((result) => result.status !== "completed"))
    throw new Error("Cannot compare balance with incomplete careers");
  const metrics = {
    victoryFraction: (result: CareerResult) =>
      result.outcomes.filter((outcome) => outcome.outcome === "victory").length / result.outcomes.length,
    rooms: (result: CareerResult) =>
      result.outcomes.reduce((sum, outcome) => sum + outcome.rooms, 0) / result.outcomes.length,
    combatTurns: (result: CareerResult) =>
      result.telemetry.battles.reduce((sum, battle) => sum + battle.turns, 0) /
      Math.max(1, result.telemetry.battles.length),
    finalGold: (result: CareerResult) => result.finalSave.gold,
  };
  const cohorts = new Map<string, number[]>();
  current.forEach((result, index) => {
    const key = careerCohort(result);
    const indices = cohorts.get(key) ?? [];
    indices.push(index);
    cohorts.set(key, indices);
  });
  return [...cohorts].map(([cohort, indices]) => ({
    cohort,
    metrics: Object.entries(metrics).map(([metric, measure]) => {
      const deltas = indices.map((index) => measure(current[index]!) - measure(baseline[index]!));
      const n = deltas.length;
      const meanDelta = deltas.reduce((a, b) => a + b, 0) / n;
      const standardError =
        n > 1 ? Math.sqrt(deltas.reduce((sum, delta) => sum + (delta - meanDelta) ** 2, 0) / (n - 1) / n) : null;
      return { metric, careers: n, meanDelta, standardError, interpretation: "advisory; thresholds uncalibrated" };
    }),
  }));
}
