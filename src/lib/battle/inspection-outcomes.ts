import {
  areBattleCardEffectsEqual,
  type BattleCard,
  type BattleCardEffect,
  type BattleCardEffectKind,
} from "@/lib/game-data";
import type { RandomDecision, Rng } from "@/lib/rng";
import type { BattleResolutionObserver, ObservedAttack, ObservedDirectAmount } from "./resolution-observer";

/** Classification is exhaustive; execution, including draws and scheduling, stays with the registry. */
const INSPECTION_EFFECT_POLICY = {
  damage: "resolve",
  "random-damage": "branch",
  "self-damage": "resolve",
  "remove-enemy-armor": "resolve",
  "restore-mana": "resolve",
  "lose-mana": "resolve",
  "gain-max-mana": "resolve",
  "lose-max-mana": "resolve",
  heal: "resolve",
  "lose-health": "resolve",
  "player-status": "branch",
  "remove-harmful-status": "resolve",
  "remove-player-status": "resolve",
  "multiply-enemy-status": "resolve",
  "cleanse-player-status-to-damage": "resolve",
  "summon-companion": "resolve",
  "companion-action": "branch",
  "random-draw": "branch",
  "gain-gold": "resolve",
  wish: "branch",
  "draw-cards": "resolve",
  "next-hit-crit": "resolve",
  "next-hit-leech": "resolve",
  "play-next-card-twice": "resolve",
  "next-hit-poison": "resolve",
  "next-archery-free": "resolve",
  "dodge-next-attack": "resolve",
  chance: "branch",
  "repeat-over-turns": "deferred",
} as const satisfies Record<BattleCardEffectKind, "resolve" | "branch" | "deferred">;

type InspectedAttacks =
  | { kind: "exact"; packets: readonly ObservedAttack[] }
  | { kind: "alternatives"; outcomes: ReadonlyArray<readonly ObservedAttack[]> }
  | { kind: "unknown" };

export type InspectedPackets = InspectedAttacks & {
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
  eligible: Set<BattleCardEffect>;
  complete: boolean;
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
        const packets = outcome.packets.get(current) ?? [];
        packets.push(packet);
        outcome.packets.set(current, packets);
      },
      directFeedback: (amounts) => {
        if (current) outcome.directAmounts.set(current, amounts);
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
    const amounts = feedback[0]?.directAmounts.get(effect) ?? [];
    const feedbackKnown =
      feedback.length > 0 && feedback.every((outcome) => outcome.complete || outcome.directAmounts.has(effect));
    const feedbackExact = feedback.every((outcome) => {
      const candidate = outcome.directAmounts.get(effect) ?? [];
      return (
        candidate.length === amounts.length &&
        candidate.every((entry, index) => {
          const first = amounts[index]!;
          return (
            entry.target === first.target &&
            entry.kind === first.kind &&
            entry.stat === first.stat &&
            entry.amount === first.amount
          );
        })
      );
    });
    const directAmounts: InspectedPackets["directAmounts"] = !feedbackKnown
      ? { kind: "unknown" }
      : feedbackExact
        ? { kind: "exact", amounts }
        : { kind: "alternatives", outcomes: feedback.map((outcome) => outcome.directAmounts.get(effect) ?? []) };
    const packets: Array<readonly ObservedAttack[]> = [];
    let unknown = INSPECTION_EFFECT_POLICY[effect.kind] === "deferred";
    if (!unknown) {
      for (const outcome of outcomes) {
        if (!outcome.eligible.has(effect)) continue;
        if (!outcome.complete && !outcome.packets.has(effect)) {
          unknown = true;
          break;
        }
        packets.push(outcome.packets.get(effect) ?? []);
      }
    }
    if (unknown || packets.length === 0) {
      inspected.set(effect, { kind: "unknown", directAmounts });
      continue;
    }
    const first = packets[0] ?? [];
    const exact = packets.every(
      (candidate) =>
        candidate === first ||
        (candidate.length === first.length &&
          candidate.every((packet, index) => areBattleCardEffectsEqual(packet, first[index]!))),
    );
    inspected.set(
      effect,
      exact
        ? { kind: "exact", packets: first, directAmounts }
        : { kind: "alternatives", outcomes: packets, directAmounts },
    );
  }
  return inspected;
}
