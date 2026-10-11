import { readActiveRun, readRunProfile } from "@/features/alchemy/shared/stores/run-reads";
import type { GameSession } from "@/features/alchemy/shared/stores/game-session-types";
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
  const visits = careers.flatMap((c) => c.telemetry.brewing ?? []);
  const decisions = visits.flatMap((v) => v.decisions);
  const services = ["mix", "distill", "campfire-new", "campfire-mix", "purchase", "refresh"] as const;
  return {
    recordedCareers: careers.filter((c) => c.telemetry.brewing !== undefined).length,
    missingCareers: careers.filter((c) => c.telemetry.brewing === undefined).length,
    truncated: careers.some((c) => c.telemetry.brewingTruncated) || visits.some((v) => v.omittedDecisions > 0),
    shopVisits: visits.filter((v) => v.activity === "alchemist").length,
    campfireVisits: visits.filter((v) => v.activity === "campfire").length,
    goldSpent: decisions.reduce((sum, d) => sum + d.goldSpent, 0),
    services: services.map((kind) => {
      const opportunities = visits.flatMap((v) => v.opportunities.filter((o) => o.kind === kind));
      const actionKind = kind === "purchase" ? "buy-potion" : kind === "refresh" ? "alchemist-refresh" : kind;
      return {
        kind,
        eligibleVisits: opportunities.filter((o) => o.eligible > 0).length,
        affordableVisits: opportunities.filter((o) => o.affordable > 0).length,
        beneficialVisits: opportunities.filter((o) => o.beneficial > 0).length,
        used: decisions.filter((d) => d.kind === actionKind).length,
        reasons: Object.fromEntries(
          [...new Set(opportunities.flatMap((o) => o.reasons))].map((reason) => [
            reason,
            opportunities.filter((o) => o.reasons.includes(reason)).length,
          ]),
        ),
      };
    }),
  };
}
