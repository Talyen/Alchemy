// Public barrel for static game data: types, assets, keywords, cards, enemies, companions, and heroes.
// Depends on the game-data submodules only.
// Feature code should import through this barrel instead of reaching into submodule paths.
export * from "./types";
export type { TalentEffectManifest, HealthThresholdBonus } from "./talent-effect-manifest";
export type { TrinketManifest } from "./trinket-manifest";
export * from "./effects";
export * from "./card-description";
export * from "./assets";
export * from "./gear-art";
export * from "./keywords";
export * from "./compendium";
export * from "./companions";
export * from "./cards";
export * from "./characters";
export * from "./character-unlocks";
export * from "./talents";
export * from "./difficulties";
export * from "./reward-selection";
