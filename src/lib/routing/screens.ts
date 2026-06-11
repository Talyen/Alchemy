// Canonical screen route identifiers shared by validation, persistence, and UI routing.
export type Screen =
  | "menu"
  | "game-mode-select"
  | "character-select"
  | "difficulty-select"
  | "draft-deck"
  | "battle"
  | "rewards"
  | "destination"
  | "options"
  | "collection"
  | "talents"
  | "homestead"
  | "game-over"
  | "campfire"
  | "shop"
  | "alchemist"
  | "mystery"
  | "corruption"
  | "run-victory"
  | "run-discoveries"
  | "labyrinth-map"
  | "wildwood-select";

export const ROUTE_SCREENS = {
  MENU: "menu",
  GAME_MODE_SELECT: "game-mode-select",
  CHARACTER_SELECT: "character-select",
  DIFFICULTY_SELECT: "difficulty-select",
  DRAFT_DECK: "draft-deck",
  BATTLE: "battle",
  REWARDS: "rewards",
  DESTINATION: "destination",
  OPTIONS: "options",
  COLLECTION: "collection",
  TALENTS: "talents",
  HOMESTEAD: "homestead",
  GAME_OVER: "game-over",
  CAMPFIRE: "campfire",
  SHOP: "shop",
  ALCHEMIST: "alchemist",
  MYSTERY: "mystery",
  CORRUPTION: "corruption",
  RUN_VICTORY: "run-victory",
  RUN_DISCOVERIES: "run-discoveries",
  LABYRINTH_MAP: "labyrinth-map",
  WILDWOOD_SELECT: "wildwood-select",
} as const satisfies Record<string, Screen>;

export const ROUTE_SCREEN_VALUES = Object.values(ROUTE_SCREENS) as [Screen, ...Screen[]];
