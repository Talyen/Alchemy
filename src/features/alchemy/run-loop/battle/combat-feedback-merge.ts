import type { CombatTextEvent } from "@/lib/battle";
import { COMBAT_TEXT_MERGE_WINDOW_MS, COMBAT_TEXT_MAX_BURSTS_PER_RAIL } from "@/lib/game-constants";
import type { CombatTextBurst, FloatingCombatText } from "../../shared/types";

export function combatTextDisplay(event: CombatTextEvent): string {
  if (event.kind === "notice") return "";
  if (event.amount === 0) return "0";
  if (event.kind === "damage") return `-${event.amount}`;
  return `${event.kind === "heal" || event.kind === "status" ? "+" : ""}${event.amount}`;
}

function combinedEntry(existing: FloatingCombatText, incoming: FloatingCombatText): FloatingCombatText | undefined {
  if (existing.target !== incoming.target || existing.kind !== incoming.kind || existing.stat !== incoming.stat) return;
  if (existing.kind === "notice" && incoming.kind === "notice") {
    if (existing.signal === incoming.signal && existing.text === incoming.text) return existing;
    return;
  }
  if (existing.kind === "notice" || incoming.kind === "notice") return;
  if (
    existing.additive === false ||
    incoming.additive === false ||
    existing.impact !== incoming.impact ||
    Math.sign(existing.amount) !== Math.sign(incoming.amount)
  )
    return;
  const amount = existing.amount + incoming.amount;
  if (String(Math.abs(amount)).length > (existing.reservedDigits ?? 0)) return;
  const result = { ...existing, amount };
  return { ...result, displayText: combatTextDisplay(result) };
}

function mergeIntoExisting(current: CombatTextBurst[], burst: CombatTextBurst, now: number) {
  const bursts = [...current];
  const unmatched: FloatingCombatText[] = [];
  for (const entry of burst.entries) {
    let merged = false;
    for (let i = bursts.length - 1; i >= 0 && !merged; i -= 1) {
      const prior = bursts[i]!;
      const age = now - prior.firstShownAt;
      if (prior.target !== burst.target || age < 0 || age >= COMBAT_TEXT_MERGE_WINDOW_MS) continue;
      for (let j = prior.entries.length - 1; j >= 0; j -= 1) {
        const combined = combinedEntry(prior.entries[j]!, entry);
        if (!combined) continue;
        const entries = [...prior.entries];
        entries[j] = combined;
        bursts[i] = { ...prior, entries };
        merged = true;
        break;
      }
    }
    if (!merged) unmatched.push(entry);
  }
  return { bursts, unmatched };
}

/** Owns displayed aggregates only; neither incoming events nor original expiry are mutated. */
export function consolidateCombatBursts(
  current: CombatTextBurst[],
  incoming: CombatTextBurst[],
  now: number,
): { bursts: CombatTextBurst[]; added: CombatTextBurst[] } {
  let bursts = current.filter((burst) => now < burst.firstShownAt + burst.lifetimeMs);
  const added: CombatTextBurst[] = [];
  for (const burst of incoming) {
    let result = mergeIntoExisting(bursts, burst, now);
    if (result.unmatched.length > 0) {
      // Reserve the new burst's slot before merging so eviction cannot discard a fresh hit.
      while (bursts.filter((prior) => prior.target === burst.target).length >= COMBAT_TEXT_MAX_BURSTS_PER_RAIL) {
        const oldest = bursts.findIndex((prior) => prior.target === burst.target);
        bursts = bursts.filter((_, index) => index !== oldest);
      }
      result = mergeIntoExisting(bursts, burst, now);
    }
    bursts = result.bursts;
    if (result.unmatched.length > 0) {
      const next = { ...burst, entries: result.unmatched };
      bursts.push(next);
      added.push(next);
    }
  }
  return { bursts, added };
}
