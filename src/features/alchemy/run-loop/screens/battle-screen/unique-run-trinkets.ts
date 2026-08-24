import { trinketLibrary, type TrinketEntry } from "@/features/alchemy/shared/config/game-data-catalog";

export function uniqueRunBoons(
  ids: readonly string[],
  library: readonly TrinketEntry[] = trinketLibrary,
): TrinketEntry[] {
  const byId = new Map(library.map((entry) => [entry.id, entry]));
  const seen = new Set<string>();
  const result: TrinketEntry[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    const entry = byId.get(id);
    if (!entry) continue;
    seen.add(id);
    result.push(entry);
  }
  return result;
}
