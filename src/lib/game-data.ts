// Public barrel for static game data: types, assets, keywords, cards, enemies, companions, and heroes.
// Depends on the game-data submodules only.
// Feature code should import through this barrel instead of reaching into submodule paths.
export * from "./game-data/types";
export * from "./game-data/assets";
export * from "./game-data/keywords";
export * from "./game-data/compendium";
export * from "./game-data/companions";
export * from "./game-data/cards";
export * from "./game-data/characters";
export * from "./game-data/talents";
