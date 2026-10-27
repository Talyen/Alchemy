import { areBattleCardEffectsEqual, type BattleCard, type BattleCardEffect } from "@/lib/game-data";
import type { RandomDecision, Rng } from "@/lib/rng";
import type {
  BattleResolutionObserver,
  ObservedAttack,
  ObservedDirectAmount,
  ObservedMagnitudeField,
} from "./resolution-observer";

type InspectedAttacks =
  | { kind: "exact"; packets: readonly ObservedAttack[] }
  | { kind: "alternatives"; outcomes: ReadonlyArray<readonly ObservedAttack[]> }
  | { kind: "unknown" };

export type InspectedPackets = InspectedAttacks & {
  magnitudes: ReadonlyMap<ObservedMagnitudeField, number>;
  directAmounts:
    | { kind: "exact"; amounts: readonly ObservedDirectAmount[] }
    | { kind: "alternatives"; outcomes: ReadonlyArray<readonly ObservedDirectAmount[]> }
    | { kind: "unknown" };
};

const MAX_REPLAYS = 128;
const MAX_DECISIONS = 64;
const MAX_STEPS = 4096;
class UnresolvedInspection extends Error {}
class ForkInspection extends Error {
  constructor(readonly size: number) {
    super("Unresolved finite decision");
  }
}

function walk(effects: readonly BattleCardEffect[], visit: (effect: BattleCardEffect) => void): void {
  for (const effect of effects) {
    visit(effect);
    // Delayed repeats remain opaque; chance children keep success/failure order.
    if (effect.kind === "chance") {
      walk(effect.successEffects, visit);
      walk(effect.failureEffects, visit);
    }
  }
}

interface Outcome {
  packets: Map<BattleCardEffect, ObservedAttack[]>;
  directAmounts: Map<BattleCardEffect, readonly ObservedDirectAmount[]>;
  magnitudes: Map<BattleCardEffect, Map<ObservedMagnitudeField, number>>;
  eligible: Set<BattleCardEffect>;
  complete: boolean;
}

type Collected<T> =
  | { kind: "exact"; values: readonly T[] }
  | { kind: "alternatives"; outcomes: ReadonlyArray<readonly T[]> }
  | { kind: "unknown" };

/** An interrupted world is usable only when it already observed this effect. */
function collectObserved<T>(
  feedback: readonly Outcome[],
  read: (outcome: Outcome) => ReadonlyMap<BattleCardEffect, readonly T[]>,
  effect: BattleCardEffect,
  equal: (a: T, b: T) => boolean,
): Collected<T> {
  if (!feedback.length || feedback.some((outcome) => !outcome.complete && !read(outcome).has(effect)))
    return { kind: "unknown" };
  const first = read(feedback[0]!).get(effect) ?? [];
  let exact = true;
  for (const outcome of feedback) {
    const observations = read(outcome);
    const candidate = observations.get(effect) ?? [];
    if (candidate.length !== first.length || candidate.some((entry, index) => !equal(entry, first[index]!))) {
      exact = false;
      break;
    }
  }
  return exact
    ? { kind: "exact", values: first }
    : { kind: "alternatives", outcomes: feedback.map((outcome) => read(outcome).get(effect) ?? []) };
}

/** Replay whole correlated worlds. Missing alternatives never become concrete starting values. */
export function inspectResolutionOutcomes(
  card: BattleCard,
  execute: (rng: Rng, observer: BattleResolutionObserver) => void,
): ReadonlyMap<BattleCardEffect, InspectedPackets> {
  const sources = new Set<BattleCardEffect>();
  walk(card.effects, (effect) => sources.add(effect));
  const pending: number[][] = [[]];
  const outcomes: Outcome[] = [];
  let runs = 0;
  let steps = 0;
  while (pending.length > 0) {
    const choices = pending.pop()!;
    const outcome: Outcome = {
      packets: new Map(),
      directAmounts: new Map(),
      magnitudes: new Map(),
      eligible: new Set(sources),
      complete: false,
    };
    let decisionIndex = 0;
    let current: BattleCardEffect | undefined;
    const entered = new Set<BattleCardEffect>();
    const observer: BattleResolutionObserver = {
      step: () => {
        if (++steps > MAX_STEPS) throw new UnresolvedInspection("Resolution work budget exceeded");
      },
      unknownDraw: () => {
        throw new UnresolvedInspection("Drawn card identities are unknown");
      },
      effect: (owner, effect, resolve) => {
        const previous = current;
        // A description reports the first application. Companion and repeated
        // actions still execute, but do not add packets to the original line.
        current = owner === card && sources.has(effect) && !entered.has(effect) ? effect : undefined;
        if (current) entered.add(current);
        try {
          return resolve();
        } finally {
          current = previous;
        }
      },
      branch: (effect, success) => {
        if (current !== effect) return;
        walk(success ? effect.failureEffects : effect.successEffects, (nested) => outcome.eligible.delete(nested));
      },
      attack: (packet) => {
        if (!current) return;
        let packets = outcome.packets.get(current);
        if (!packets) {
          packets = [];
          outcome.packets.set(current, packets);
        }
        packets.push(packet);
      },
      directFeedback: (amounts) => {
        if (current) outcome.directAmounts.set(current, amounts);
      },
      descriptionMagnitude: (field, amount, source = current) => {
        if (!source || !sources.has(source)) return;
        let magnitudes = outcome.magnitudes.get(source);
        if (!magnitudes) {
          magnitudes = new Map<ObservedMagnitudeField, number>();
          outcome.magnitudes.set(source, magnitudes);
        }
        magnitudes.set(field, amount);
      },
    };
    const decide = (decision: RandomDecision): number => {
      // Offensive inspection has always excluded random critical strikes and Dodge.
      // Prepared critical flags still resolve normally through the live rules.
      if (decision.kind === "chance" && decision.purpose !== "effect") return 0;
      const size = decision.kind === "chance" ? 2 : decision.size;
      if (size === 1) return 0;
      if (decisionIndex >= MAX_DECISIONS) throw new UnresolvedInspection("Decision depth exceeded");
      const choice = choices[decisionIndex++];
      if (choice === undefined) throw new ForkInspection(size);
      return choice;
    };
    const rng: Rng = Object.assign(
      () => {
        throw new UnresolvedInspection("Unclassified random sampling");
      },
      { decide },
    );
    runs++;
    try {
      execute(rng, observer);
      outcome.complete = true;
    } catch (error) {
      if (error instanceof ForkInspection && runs + pending.length + error.size <= MAX_REPLAYS) {
        for (let choice = error.size - 1; choice >= 0; choice--) pending.push([...choices, choice]);
        continue;
      }
      if (!(error instanceof ForkInspection) && !(error instanceof UnresolvedInspection)) throw error;
    }
    outcomes.push(outcome);
  }

  const inspected = new Map<BattleCardEffect, InspectedPackets>();
  for (const effect of sources) {
    const feedback = outcomes.filter((outcome) => outcome.eligible.has(effect));
    const magnitudes = new Map<ObservedMagnitudeField, number>();
    for (const [field, amount] of feedback[0]?.magnitudes.get(effect) ?? []) {
      if (feedback.every((outcome) => outcome.magnitudes.get(effect)?.get(field) === amount))
        magnitudes.set(field, amount);
    }
    const direct = collectObserved(
      feedback,
      (outcome) => outcome.directAmounts,
      effect,
      (a, b) => a.target === b.target && a.kind === b.kind && a.stat === b.stat && a.amount === b.amount,
    );
    const directAmounts: InspectedPackets["directAmounts"] =
      direct.kind === "exact" ? { kind: "exact", amounts: direct.values } : direct;
    // Scheduling resolves now, but future-turn packets remain authored values.
    const attacks =
      effect.kind === "repeat-over-turns"
        ? { kind: "unknown" as const }
        : collectObserved<ObservedAttack>(feedback, (outcome) => outcome.packets, effect, areBattleCardEffectsEqual);
    inspected.set(effect, {
      ...(attacks.kind === "exact" ? { kind: "exact", packets: attacks.values } : attacks),
      directAmounts,
      magnitudes,
    });
  }
  return inspected;
}
