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
  | "armory"
  | "game-over"
  | "campfire"
  | "shop"
  | "alchemist"
  | "trinket-shop"
  | "equipment-shop"
  | "mystery"
  | "corruption"
  | "run-victory"
  | "labyrinth-map"
  | "wildwood-recovery"
  | "wildwood-removal";

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
  ARMORY: "armory",
  GAME_OVER: "game-over",
  CAMPFIRE: "campfire",
  SHOP: "shop",
  ALCHEMIST: "alchemist",
  TRINKET_SHOP: "trinket-shop",
  EQUIPMENT_SHOP: "equipment-shop",
  MYSTERY: "mystery",
  CORRUPTION: "corruption",
  RUN_VICTORY: "run-victory",
  LABYRINTH_MAP: "labyrinth-map",
  WILDWOOD_RECOVERY: "wildwood-recovery",
  WILDWOOD_REMOVAL: "wildwood-removal",
} as const satisfies Record<string, Screen>;

export const ROUTE_SCREEN_VALUES = Object.values(ROUTE_SCREENS) as [Screen, ...Screen[]];
