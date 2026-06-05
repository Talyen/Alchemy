// Canonical battle card effect kind strings — keep aligned with BattleCardEffect in types.ts.
export const BATTLE_CARD_EFFECT_KINDS = [
  "damage",
  "player-status",
  "enemy-status",
  "heal",
  "restore-mana",
  "lose-mana",
  "lose-max-mana",
  "gain-max-mana",
  "gain-gold",
  "wish",
  "summon-companion",
  "remove-harmful-status",
  "remove-player-status",
  "self-damage",
  "buff-companion",
  "lose-health",
  "draw-cards",
  "remove-enemy-armor",
  "multiply-enemy-status",
  "cleanse-player-status-to-damage",
  "random-damage",
  "chance",
] as const;

export type BattleCardEffectKind = (typeof BATTLE_CARD_EFFECT_KINDS)[number];
