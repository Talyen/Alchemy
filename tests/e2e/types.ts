export type GameMode = "campaign" | "labyrinth" | "wildwood";

export type DestinationName =
  | "Normal Combat"
  | "Elite Combat"
  | "Boss Combat"
  | "Card Shop"
  | "Alchemist's Shop"
  | "Trinket Shop"
  | "Gear Shop"
  | "Mystery"
  | "Corruption"
  | "Campfire";

export const GAME_MODE_TITLES: Record<GameMode, string> = {
  campaign: "The Campaign",
  labyrinth: "The Labyrinth",
  wildwood: "Wildwood Draft",
};
