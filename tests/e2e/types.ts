// Shared E2E types and global augmentations for destination RNG forcing.
export type GameMode = "campaign" | "labyrinth" | "wildwood";

export type DestinationName =
  | "Normal Combat"
  | "Elite Combat"
  | "Merchant's Shop"
  | "Alchemist's Shop"
  | "Mystery"
  | "Corruption"
  | "Campfire";

export const DESTINATION_RANDOM_VALUES: Record<DestinationName, number> = {
  "Normal Combat": 0,
  "Elite Combat": 0.2,
  "Merchant's Shop": 0.35,
  "Alchemist's Shop": 0.5,
  Mystery: 0.65,
  Corruption: 0.8,
  Campfire: 0.95,
};

export const GAME_MODE_TITLES: Record<GameMode, string> = {
  campaign: "The Campaign",
  labyrinth: "The Labyrinth",
  wildwood: "The Wildwoods",
};

declare global {
  interface Window {
    disableForceDestination?: boolean;
  }
}

export {};
