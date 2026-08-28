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
  WILDWOOD_REMOVAL: "wildwood-removal",
} as const;

export type Screen = (typeof ROUTE_SCREENS)[keyof typeof ROUTE_SCREENS];

export const ROUTE_SCREEN_VALUES = Object.values(ROUTE_SCREENS) as [Screen, ...Screen[]];
