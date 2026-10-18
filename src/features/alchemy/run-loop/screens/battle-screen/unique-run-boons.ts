import { trinketById, type TrinketEntry } from "@/features/alchemy/shared/config/game-data-catalog";

export function hasInspectableBoons(ids: readonly string[]): boolean {
  return ids.some((id) => Boolean(trinketById[id]));
}

export function uniqueRunBoons(ids: readonly string[]): TrinketEntry[] {
  const seen = new Set<string>();
  const result: TrinketEntry[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    const entry = trinketById[id];
    if (!entry) continue;
    seen.add(id);
    result.push(entry);
  }
  return result;
}
