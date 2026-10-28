import { canMergeCombatText, mergeCombatText, type CombatTextEvent } from "@/lib/battle";
import { COMBAT_TEXT_MERGE_WINDOW_MS } from "@/lib/game-constants";
import type { CombatTextBurst, FloatingCombatText } from "../../shared/types";

export function combatTextDisplay(event: CombatTextEvent): string {
  if (event.kind === "notice") return "";
  if (event.amount === 0) return "0";
  if (event.kind === "damage") return `-${event.amount}`;
  return `${event.kind === "heal" || event.kind === "status" ? "+" : ""}${event.amount}`;
}

function combinedEntry(existing: FloatingCombatText, incoming: FloatingCombatText): FloatingCombatText | undefined {
  if (!canMergeCombatText(existing, incoming)) return;
  if (existing.kind === "notice" && incoming.kind === "notice") return existing;
  if (existing.kind === "notice" || incoming.kind === "notice") return;
  const amount = existing.amount + incoming.amount;
  if (String(Math.abs(amount)).length > (existing.reservedDigits ?? 0)) return;
  const merged = [{ ...existing }];
  mergeCombatText(merged, incoming);
  const result = merged[0]!;
  return {
    ...result,
    displayText: combatTextDisplay(result),
    ...(result.kind === "damage" && result.critical ? { includesCritical: true } : {}),
  };
}

function mergeIntoExisting(bursts: CombatTextBurst[], burst: CombatTextBurst, now: number) {
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
  return unmatched;
}

/** Owns displayed aggregates only; neither incoming events nor original expiry are mutated. */
export function consolidateCombatBursts(
  current: CombatTextBurst[],
  incoming: CombatTextBurst[],
  now: number,
): CombatTextBurst[] {
  const bursts = current.filter((burst) => now < burst.firstShownAt + burst.lifetimeMs);
  for (const burst of incoming) {
    const unmatched = mergeIntoExisting(bursts, burst, now);
    if (unmatched.length > 0) bursts.push({ ...burst, entries: unmatched });
  }
  return bursts;
}
