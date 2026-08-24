// Shared E2E types.
export type GameMode = "campaign" | "labyrinth" | "wildwood";

export type DestinationName =
  | "Normal Combat"
  | "Elite Combat"
  | "Merchant's Shop"
  | "Alchemist's Shop"
  | "Trinket Shop"
  | "Equipment Shop"
  | "Mystery"
  | "Corruption"
  | "Campfire";

export const GAME_MODE_TITLES: Record<GameMode, string> = {
  campaign: "The Campaign",
  labyrinth: "The Labyrinth",
  wildwood: "Wildwood Draft",
};
