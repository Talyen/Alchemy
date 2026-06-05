/** Where applyCardEffects routes a given effect kind (handlers live under lib/battle). */
export type EffectDispatchRoute =
  | "damage"
  | "player-status"
  | "enemy-status"
  | "heal"
  | "cleanse-player-status-to-damage"
  | "random-damage"
  | "chance"
  | "mana"
  | "utility";
