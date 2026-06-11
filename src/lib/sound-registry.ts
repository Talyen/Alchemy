// Sound registry — maps every game event to its corresponding asset filename in
// public/sounds/. This is the single source of truth for what SFX exist.
//
// Arrays provide random variation (one is picked at runtime). Strings are
// deterministic. The audio engine resolves these against import.meta.env.BASE_URL.

// ── Cards ──
// Each card id maps to the sound played when that card resolves.
export const cardSounds: Record<string, string[]> = {
  slash: ["sword-attack-1.ogg"],
  stab: ["sword-attack-3.ogg"],
  bash: ["gut-kick.ogg"],
  block: ["sword-blocked-1.ogg"],
  anvil: ["sword-blocked-1.ogg"],
  "plate-mail": ["sword-blocked-1.ogg"],
  apple: ["buff-pickup.ogg"],
  bread: ["buff-pickup.ogg"],
  meteor: ["rock-meteor-swarm-1.ogg"],
  steal: ["coins-gather-quick.ogg"],
  "blessed-aegis": ["gut-kick.ogg"],
  wish: ["music-box-mystery.ogg"],
  cleanse: ["buff-pickup-1.ogg"],
  heal: ["buff-pickup-1.ogg"],
  haste: ["bonus-regen-rate.ogg"],
  "poison-dagger": ["sword-impact-hit-2.ogg"],
  fireball: ["fireball-1.ogg"],
  fangs: ["sword-impact-hit-2.ogg"],
  "wolf-companion": ["sword-impact-hit-2.ogg"],
  "imp-companion": ["torch-attack-strike-1.ogg"],
  "lizard-scout-companion": ["swipe.ogg"],
  frostbolt: ["ice-throw-1.ogg"],
  "health-potion": ["ice-in-water.ogg"],
  "mana-berries": ["buff-pickup.ogg"],
  "mana-crystals": ["buff-pickup.ogg"],
  "mana-potion": ["ice-in-water.ogg"],
  "panacea-potion": ["ice-in-water.ogg"],
  "stoneskin-potion": ["ice-in-water.ogg"],
  "acid-potion": ["ice-in-water.ogg"],
  "luck-potion": ["ice-in-water.ogg"],
  "wishing-potion": ["ice-in-water.ogg"],
  "mixed-potion": ["ice-in-water.ogg"],
  "frost-whelp-companion": ["ice-throw-1.ogg"],
  "bear-companion": ["gut-kick.ogg"],
  "panther-companion": ["swipe.ogg"],
  "phoenix-companion": ["fireball-1.ogg"],
  "shield-bash": ["sword-blocked-1.ogg"],
  "burning-blade": ["fireball-1.ogg"],
  blackjack: ["coins-gather-quick.ogg"],
  "venom-fangs": ["sword-impact-hit-2.ogg"],
  bloodthorn: ["sword-impact-hit-2.ogg"],
  cinderbloom: ["fireball-1.ogg"],
  "serrated-edge": ["sword-impact-hit-2.ogg"],
  "sunder-armor": ["strong-punch.ogg"],
  "briar-shield": ["sword-blocked-1.ogg"],
  "thorn-mail": ["sword-blocked-1.ogg"],
  "mana-shield": ["energy-noise.ogg"],
  "cold-snap": ["ice-throw-1.ogg"],
  cauterize: ["fireball-1.ogg"],
  sunburst: ["fireball-1.ogg"],
  "holy-radiance": ["buff-pickup-1.ogg"],
  "smelling-salts": ["ice-in-water.ogg"],
  "antivenom-potion": ["ice-in-water.ogg"],
  prayer: ["music-box-mystery.ogg"],
  "faustian-bargain": ["music-box-mystery.ogg"],
  "grasping-vines": ["swish-hit.ogg"],
  "pack-tactics": ["swish-hit.ogg"],
  smite: ["fireball-1.ogg"],
  "blood-offering": ["sword-impact-hit-2.ogg"],
  judgment: ["strong-punch.ogg"],
};

// ── Enemy attacks ──
// Maps enemy id to the sound played when they attack the player.
export const enemyAttackSounds: Record<string, string[]> = {
  skeleton: ["swish-hit.ogg"],
  goblin: ["swish-hit.ogg"],
  imp: ["torch-attack-strike-1.ogg"],
  "lizard-scout": ["swipe.ogg"],
  mimic: ["kick.ogg"],
  "mud-elemental": ["strong-punch.ogg"],
  necromancer: ["energy-noise.ogg"],
  "plague-doctor": ["swish-hit.ogg"],
  "forge-golem": ["strong-punch.ogg"],
  frostwarden: ["strong-punch.ogg"],
  "blight-treant": ["strong-punch.ogg"],
  "iron-bear": ["strong-punch.ogg"],
  "living-armor": ["strong-punch.ogg"],
};

// ── Battle events ──
// Generic combat moments that aren't tied to a specific card or enemy.
export const battleEventSounds = {
  enemyHit: "sword-impact-hit-1.ogg",
  playerHit: "punch-3.ogg",
  blockAbsorb: "sword-blocked-2.ogg",
  critHit: "sword-clash.ogg",
  stunProc: "power-down.ogg",
  freezeProc: "ice-freeze-1.ogg",
  burnTick: "torch-impact-1.ogg",
  poisonTick: "squelching-4.ogg",
  bleedTick: "splat-quick.ogg",
  leechHeal: "8bit-chime-quick.ogg",
  playerHeal: "vibraphone-chime-quick.ogg",
  playerBuff: "8bit-chime-quick.ogg",
  consumeCard: "card-fan.ogg",
  drawCards: "card-draw-1.ogg",
  drawTransfer: "card-draw-2.ogg",
  endTurn: "toggle-off.ogg",
  wishAppear: "harpsichord-mystery.ogg",
  gainGold: "coin-collect.ogg",
  deathsDoor: "horror-sting.ogg",
} as const;

// ── UI ──
export const uiSounds = {
  buttonHover: "button-hover-3.ogg",
  cardHover: "card-draw-3.ogg",
  cardDrag: "whoosh-1.ogg",
  screenTransition: "whoosh-2.ogg",
  toggleOn: "toggle-on.ogg",
  toggleOff: "toggle-off.ogg",
  error: "sci-fi-error.ogg",
  shopBuy: "coin-jingle-small.ogg",
  shopRefresh: "keys-jingling.ogg",
  shopRemove: "card-fan.ogg",
  campfireRest: "fire-lighting.ogg",
  alchemistMix: "gurgling.ogg",
  rewardSelect: "sci-fi-confirm.ogg",
  talentUnlock: "music-box-chime-positive.ogg",
  collectionPage: "page-turn.ogg",
  musicBoxMystery: "music-box-mystery.ogg",
  packOpen: "paper-move.ogg",
} as const;

export type UISound = keyof typeof uiSounds;

// ── Game flow stingers ──
export const stingerSounds = {
  victory: "harpsichord-level-complete.ogg",
  defeat: "harpsichord-defeated.ogg",
} as const;
