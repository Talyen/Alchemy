import { readActiveRun, readRunProfile } from "@/features/alchemy/shared/stores/session/run-reads";
import type { GameSession } from "@/features/alchemy/shared/stores/session/game-session-types";
import type { BrewingObservation, BrewingOpportunity } from "./brewing-offers";
import type { CareerResult, PlayerChoice } from "./types";

export interface BrewingVisitEvidence {
  run: number;
  room: number;
  activity: BrewingObservation["activity"];
  opportunities: Array<Omit<BrewingOpportunity, "reason"> & { reasons: string[] }>;
  decisions: Array<{
    step: number;
    kind: string;
    id: string;
    score: number;
    goldSpent: number;
    deckDelta: number;
    result?: string[];
  }>;
  omittedDecisions: number;
}

export function recordBrewingObservation(result: CareerResult, observation: BrewingObservation | null, run: number) {
  if (!observation) return undefined;
  const visits = (result.telemetry.brewing ??= []);
  let visit = visits.find((v) => v.run === run && v.room === observation.room && v.activity === observation.activity);
  if (!visit) {
    if (visits.length >= 512) {
      result.telemetry.brewingTruncated = true;
      return undefined;
    }
    visit = {
      run,
      room: observation.room,
      activity: observation.activity,
      opportunities: [],
      decisions: [],
      omittedDecisions: 0,
    };
    visits.push(visit);
  }
  for (const opportunity of observation.opportunities) {
    let current = visit.opportunities.find((o) => o.kind === opportunity.kind);
    if (!current) {
      const { reason: _reason, ...counts } = opportunity;
      current = { ...counts, reasons: [] };
      visit.opportunities.push(current);
    }
    // Per-visit maxima describe exposure; repeated observations never add visits.
    for (const field of ["eligible", "affordable", "beneficial"] as const)
      current[field] = Math.max(current[field], opportunity[field]);
    if (!current.reasons.includes(opportunity.reason)) current.reasons.push(opportunity.reason);
  }
  return visit;
}

export function recordBrewingCommit(
  visit: BrewingVisitEvidence | undefined,
  step: number,
  choice: PlayerChoice,
  before: { gold: number; deckSize: number },
  value: unknown,
  gameSession: GameSession,
) {
  if (!visit) return;
  if (visit.decisions.length >= 32) {
    visit.omittedDecisions++;
    return;
  }
  const result =
    value && typeof value === "object" && "descriptionLines" in value && Array.isArray(value.descriptionLines)
      ? (value.descriptionLines as string[])
      : undefined;
  visit.decisions.push({
    step,
    kind: choice.kind,
    id: choice.id,
    score: choice.score,
    goldSpent: Math.max(0, before.gold - readRunProfile(gameSession).gold),
    deckDelta: readActiveRun(gameSession).runDeck.length - before.deckSize,
    ...(result ? { result } : {}),
  });
}

export function summarizeBrewing(careers: CareerResult[]) {
  const services = ["mix", "distill", "campfire-new", "campfire-mix", "purchase", "refresh"] as const;
  const summaries = new Map<
    string,
    {
      eligibleVisits: number;
      affordableVisits: number;
      beneficialVisits: number;
      reasons: Map<string, number>;
    }
  >();
  const decisions = new Map<string, number>();
  let recordedCareers = 0;
  let truncated = false;
  let shopVisits = 0;
  let campfireVisits = 0;
  let goldSpent = 0;
  for (const career of careers) {
    if (career.telemetry.brewing !== undefined) recordedCareers++;
    if (career.telemetry.brewingTruncated) truncated = true;
    for (const visit of career.telemetry.brewing ?? []) {
      if (visit.omittedDecisions > 0) truncated = true;
      if (visit.activity === "alchemist") shopVisits++;
      if (visit.activity === "campfire") campfireVisits++;
      for (const opportunity of visit.opportunities) {
        let summary = summaries.get(opportunity.kind);
        if (!summary) {
          summary = { eligibleVisits: 0, affordableVisits: 0, beneficialVisits: 0, reasons: new Map() };
          summaries.set(opportunity.kind, summary);
        }
        if (opportunity.eligible > 0) summary.eligibleVisits++;
        if (opportunity.affordable > 0) summary.affordableVisits++;
        if (opportunity.beneficial > 0) summary.beneficialVisits++;
        for (const reason of new Set(opportunity.reasons))
          summary.reasons.set(reason, (summary.reasons.get(reason) ?? 0) + 1);
      }
      for (const decision of visit.decisions) {
        goldSpent += decision.goldSpent;
        decisions.set(decision.kind, (decisions.get(decision.kind) ?? 0) + 1);
      }
    }
  }
  return {
    recordedCareers,
    missingCareers: careers.length - recordedCareers,
    truncated,
    shopVisits,
    campfireVisits,
    goldSpent,
    services: services.map((kind) => {
      const summary = summaries.get(kind);
      const actionKind = kind === "purchase" ? "buy-potion" : kind === "refresh" ? "alchemist-refresh" : kind;
      return {
        kind,
        eligibleVisits: summary?.eligibleVisits ?? 0,
        affordableVisits: summary?.affordableVisits ?? 0,
        beneficialVisits: summary?.beneficialVisits ?? 0,
        used: decisions.get(actionKind) ?? 0,
        reasons: Object.fromEntries(summary?.reasons ?? []),
      };
    }),
  };
}
