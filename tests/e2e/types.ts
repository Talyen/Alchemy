import type { Destination } from "@/lib/routing/destinations";

export type GameMode = "campaign" | "labyrinth" | "wildwood";

export type DestinationName = Destination;

export const GAME_MODE_TITLES: Record<GameMode, string> = {
  campaign: "The Campaign",
  labyrinth: "The Labyrinth",
  wildwood: "Wildwood Draft",
};
