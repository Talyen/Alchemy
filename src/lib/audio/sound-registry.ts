import { MIXED_POTION_CARD_ID } from "../game-constants";
import { isMixedPotionCard } from "../game-data/cards/card-pools";

// Shared cues grouped by archetype. Cards reference these instead of
// repeating literal filenames so a cue rename touches one line and the
// resolved registry output stays identical.
const BLOCK_PARRY = "sword-blocked-1.ogg";
const RATION_PICKUP = "buff-pickup.ogg";
const POTION_POUR = "ice-in-water.ogg";
const BLADE_HIT = "sword-impact-hit-2.ogg";
const FIRE_BURST = "fireball-1.ogg";
const HOLY_CHIME = "buff-pickup-1.ogg";
const MYSTERY_BOX = "music-box-mystery.ogg";
const COINS_QUICK = "coins-gather-quick.ogg";
const TOGGLE_OFF = "toggle-off.ogg";
const CARD_FAN = "card-fan.ogg";
const HEAVY_KICK = "gut-kick.ogg";
const SWISH_HIT = "swish-hit.ogg";
const CLAW_SWIPE = "swipe.ogg";
const ICE_THROW = "ice-throw-1.ogg";
const HEAVY_PUNCH = "strong-punch.ogg";
const ARCANE_HUM = "energy-noise.ogg";

// Shared boss attack cue. All current bosses hit with the same weight;
// split this only when a boss earns its own sound.
const BOSS_ATTACK_SOUND = HEAVY_PUNCH;

export const cardSounds: Record<string, string[]> = {
  slash: ["sword-attack-1.ogg"],
  stab: ["sword-attack-3.ogg"],
  bash: [HEAVY_KICK],
  block: [BLOCK_PARRY],
  anvil: [BLOCK_PARRY],
  "plate-mail": [BLOCK_PARRY],
  apple: [RATION_PICKUP],
  bread: [RATION_PICKUP],
  meteor: ["rock-meteor-swarm-1.ogg"],
  steal: [COINS_QUICK],
  "blessed-aegis": [HEAVY_KICK],
  wish: [MYSTERY_BOX],
  cleanse: [HOLY_CHIME],
  heal: [HOLY_CHIME],
  haste: ["bonus-regen-rate.ogg"],
  "poison-dagger": [BLADE_HIT],
  fireball: [FIRE_BURST],
  fangs: [BLADE_HIT],
  "wolf-companion": [BLADE_HIT],
  "lizard-scout-companion": [CLAW_SWIPE],
  frostbolt: [ICE_THROW],
  "health-potion": [POTION_POUR],
  "mana-berries": [RATION_PICKUP],
  "mana-crystals": [RATION_PICKUP],
  "mana-potion": [POTION_POUR],
  "panacea-potion": [POTION_POUR],
  "stoneskin-potion": [POTION_POUR],
  "acid-potion": [POTION_POUR],
  "luck-potion": [POTION_POUR],
  "wishing-potion": [POTION_POUR],
  "mixed-potion": [POTION_POUR],
  "frost-whelp-companion": [ICE_THROW],
  "bear-companion": [HEAVY_KICK],
  "panther-companion": [CLAW_SWIPE],
  "phoenix-companion": [FIRE_BURST],
  "skeleton-companion": [SWISH_HIT],
  "pixie-companion": [HOLY_CHIME],
  "mana-moth-companion": [ARCANE_HUM],
  "will-o-wisp-companion": [MYSTERY_BOX],
  "golden-retriever-companion": [COINS_QUICK],
  "shield-scarab-companion": [BLOCK_PARRY],
  "library-owl-companion": ["page-turn.ogg"],
  "fox-companion": [CLAW_SWIPE],
  "shield-bash": [BLOCK_PARRY],
  "burning-blade": [FIRE_BURST],
  blackjack: [COINS_QUICK],
  "venom-fangs": [BLADE_HIT],
  bloodthorn: [BLADE_HIT],
  cinderbloom: [FIRE_BURST],
  "serrated-edge": [BLADE_HIT],
  sunder: [HEAVY_PUNCH],
  "briar-shield": [BLOCK_PARRY],
  "thorn-mail": [BLOCK_PARRY],
  "mana-shield": [ARCANE_HUM],
  "cold-snap": [ICE_THROW],
  cauterize: [FIRE_BURST],
  sunburst: [FIRE_BURST],
  "holy-radiance": [HOLY_CHIME],
  "smelling-salts": [POTION_POUR],
  prayer: [MYSTERY_BOX],
  "faustian-bargain": [MYSTERY_BOX],
  "grasping-vines": [SWISH_HIT],
  "pack-tactics": [SWISH_HIT],
  smite: [FIRE_BURST],
  "blood-offering": [BLADE_HIT],
  judgment: [HEAVY_PUNCH],
};

export function getCardSounds(cardId: string): readonly string[] {
  return cardSounds[isMixedPotionCard({ id: cardId }) ? MIXED_POTION_CARD_ID : cardId] ?? [];
}

export const enemyAttackSounds: Record<string, string[]> = {
  skeleton: [SWISH_HIT],
  goblin: [SWISH_HIT],
  mimic: ["kick.ogg"],
  "mud-elemental": [HEAVY_PUNCH],
  necromancer: [ARCANE_HUM],
  "plague-doctor": [SWISH_HIT],
  "forge-golem": [BOSS_ATTACK_SOUND],
  frostwarden: [BOSS_ATTACK_SOUND],
  "blight-treant": [BOSS_ATTACK_SOUND],
  "iron-bear": [BOSS_ATTACK_SOUND],
  "living-armor": [BOSS_ATTACK_SOUND],
  "fire-elemental": ["torch-attack-strike-1.ogg"],
  "frost-elemental": [ICE_THROW],
  slime: ["squelching-4.ogg"],
};

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
  playerHeal: "vibraphone-chime-quick.ogg",
  consumeCard: CARD_FAN,
  drawCards: "card-draw-1.ogg",
  drawTransfer: "card-draw-2.ogg",
  endTurn: TOGGLE_OFF,
  wishAppear: "harpsichord-mystery.ogg",
  gainGold: COINS_QUICK,
  deathsDoor: "horror-sting.ogg",
  sliceDeath: "sword-slice.ogg",
} as const;

export const uiSounds = {
  gearMove: "metal-button-4.ogg",
  cardHover: "card-draw-3.ogg",
  cardDrag: "whoosh-1.ogg",
  screenTransition: "whoosh-2.ogg",
  toggleOn: "toggle-on.ogg",
  toggleOff: TOGGLE_OFF,
  error: "denied-03.ogg",
  shopBuy: COINS_QUICK,
  shopRefresh: "keys-jingling.ogg",
  shopRemove: CARD_FAN,
  campfireRest: "fire-lighting.ogg",
  alchemistMix: "gurgling.ogg",
  talentUnlock: "music-box-chime-positive.ogg",
  collectionPage: "page-turn.ogg",
  musicBoxMystery: MYSTERY_BOX,
  packOpen: "paper-move.ogg",
  salvage: "mine-2.ogg",
} as const;

export type UISound = keyof typeof uiSounds;

export const stingerSounds = {
  victory: "harpsichord-level-complete.ogg",
  defeat: "harpsichord-defeated.ogg",
} as const;

export function allRegisteredSoundFiles(): string[] {
  return [
    ...new Set([
      ...Object.values(cardSounds).flat(),
      ...Object.values(enemyAttackSounds).flat(),
      ...Object.values(battleEventSounds),
      ...Object.values(uiSounds),
      ...Object.values(stingerSounds),
    ]),
  ];
}
