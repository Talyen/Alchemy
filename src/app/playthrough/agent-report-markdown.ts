import type { AgentPlaythroughSummary } from "./agent-report-types";

function markdownText(value: string): string {
  return value.replace(/[`\r\n]/g, " ").trim();
}

export function renderAgentPlaythroughSummaryMarkdown(summary: AgentPlaythroughSummary): string {
  const lines = [
    "# Agent playthrough brief",
    "",
    `- Careers: ${summary.completed}/${summary.planned} completed; ${summary.incomplete} incomplete`,
    `- Cohorts: ${summary.cohorts.length}`,
    "- Balance findings are observations and hypotheses, not calibrated pass/fail gates.",
    "",
    "## Findings",
    "",
  ];
  if (!summary.findings.length) lines.push("No findings were generated.", "");
  for (const finding of summary.findings) {
    lines.push(`### [${finding.priority.toUpperCase()}] ${finding.title}`);
    lines.push(`- Claim: ${markdownText(finding.claim)}`);
    lines.push(`- Confidence: ${finding.confidence}`);
    lines.push(
      `- Evidence: ${Object.entries(finding.evidence)
        .map(([key, value]) => `${key}=${markdownText(String(value))}`)
        .join("; ")}`,
    );
    lines.push(`- Interpretation: ${markdownText(finding.interpretation)}`);
    lines.push(`- Next step: ${markdownText(finding.nextStep)}`);
    if (finding.selector) lines.push(`- Evidence selector: \`${JSON.stringify(finding.selector)}\``);
    lines.push("");
  }
  lines.push("## Cohort metrics", "");
  for (const cohort of summary.cohorts) {
    lines.push(`### ${cohort.cohort}`);
    lines.push(
      `- Runs: ${cohort.runs}; terminal rooms mean/median: ${cohort.terminalRooms.mean ?? "n/a"}/${cohort.terminalRooms.median ?? "n/a"}; range: ${cohort.terminalRooms.min ?? "n/a"}-${cohort.terminalRooms.max ?? "n/a"}`,
    );
    const survivalCheckpoints = [12, 16, 20]
      .map((room) => cohort.survivalByRoom.find((point) => point.room === room))
      .filter((point): point is NonNullable<typeof point> => point !== undefined)
      .map((point) => `room ${point.room}: ${point.reached}/${point.denominator} (${point.rate}%)`);
    if (survivalCheckpoints.length) lines.push(`- Survival checkpoints: ${survivalCheckpoints.join("; ")}`);
    if (cohort.runOutcomes.length)
      lines.push(
        `- Victory by run: ${cohort.runOutcomes.map((run) => `R${run.run} ${run.victories}/${run.runs} (${run.victoryRate}%)`).join("; ")}`,
      );
    const firstVictory = Object.entries(cohort.firstVictoryRun)
      .map(([run, count]) => `R${run}=${count}`)
      .join(", ");
    if (firstVictory || cohort.neverWon)
      lines.push(`- First victories: ${firstVictory || "none"}; never won: ${cohort.neverWon}`);
    if (cohort.deckCohesion.samples)
      lines.push(
        `- Deck cohesion: ${cohort.deckCohesion.dominantKeywordShare ?? "n/a"}% dominant keyword share; hero-keyword share ${cohort.deckCohesion.heroKeywordShare ?? "n/a"}%`,
      );
    lines.push(
      `- Battles: ${cohort.battles.victories}/${cohort.battles.encounters} victories (${cohort.battles.winRate}%); bosses: ${cohort.battles.bosses.victories}/${cohort.battles.bosses.encounters} (${cohort.battles.bosses.winRate}%)`,
    );
    lines.push(
      `- Progression: first-to-final room delta ${cohort.progression.meanRoomDelta ?? "n/a"}; improved/worsened/tied ${cohort.progression.improved}/${cohort.progression.worsened}/${cohort.progression.tied}`,
    );
    lines.push("");
  }
  lines.push(
    "## Recommended next experiments",
    "",
    ...summary.recommendations.map((recommendation) => `- ${markdownText(recommendation)}`),
    "",
  );
  lines.push(
    "## Evidence artifacts",
    "",
    `- Summary JSON: \`${summary.artifacts.summaryJson}\``,
    `- Detailed JSON: \`${summary.artifacts.reportJson}\``,
    `- Interactive report: \`${summary.artifacts.reportHtml}\``,
    `- Raw career bundles: \`${summary.artifacts.careerBundles}\``,
    `- Raw journals: \`${summary.artifacts.journals}\``,
    "",
  );
  return `${lines.join("\n")}\n`;
}
