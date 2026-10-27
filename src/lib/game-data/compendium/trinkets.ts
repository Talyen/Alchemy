import { getCatalogArt } from "../assets";
import type { TrinketEntry } from "../types";
import type { TrinketManifest } from "../trinket-manifest";
import { trinketDefinitions } from "./trinket-definitions";

export const trinketLibrary = trinketDefinitions.map(
  ({ id, title, effects, describe }): TrinketEntry & { id: (typeof trinketDefinitions)[number]["id"] } => ({
    id,
    title,
    descriptionLines: [describe(effects)],
    art: getCatalogArt(id),
    effects,
  }),
);
const trinketDefinitionsById = new Map<string, (typeof trinketDefinitions)[number]>(
  trinketDefinitions.map((definition) => [definition.id, definition]),
);

/** The complete trigger and outcome, using the supplied balance values. */
export function describeTrinket(id: string, effects: Partial<TrinketManifest>): string | null {
  const definition = trinketDefinitionsById.get(id);
  return definition ? definition.describe(effects) : null;
}
