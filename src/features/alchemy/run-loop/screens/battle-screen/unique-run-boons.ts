import { trinketById, trinketLibrary, type TrinketEntry } from "@/features/alchemy/shared/config/game-data-catalog";

export function hasInspectableBoons(
  ids: readonly string[],
  library: readonly TrinketEntry[] = trinketLibrary,
): boolean {
  if (ids.length === 0) return false;
  if (library === trinketLibrary) {
    return ids.some((id) => Boolean(trinketById[id]));
  }
  const libraryIds = new Set(library.map((entry) => entry.id));
  return ids.some((id) => libraryIds.has(id));
}

export function uniqueRunBoons(
  ids: readonly string[],
  library: readonly TrinketEntry[] = trinketLibrary,
): TrinketEntry[] {
  const seen = new Set<string>();
  const result: TrinketEntry[] = [];
  const getEntry =
    library === trinketLibrary
      ? (id: string) => trinketById[id]
      : (() => {
          const map = new Map(library.map((entry) => [entry.id, entry]));
          return (id: string) => map.get(id);
        })();

  for (const id of ids) {
    if (seen.has(id)) continue;
    const entry = getEntry(id);
    if (!entry) continue;
    seen.add(id);
    result.push(entry);
  }
  return result;
}
