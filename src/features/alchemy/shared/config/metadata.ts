// Visual metadata for destinations, collection tabs, and keyword iconography.
// Depends on Lucide icons, game-data image assets, and alchemy UI types.
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  CircleOff,
  Coins,
  Crosshair,
  Dices,
  Droplet,
  Feather,
  Flame,
  FlaskConical,
  Gem,
  Hammer,
  Heart,
  HeartPulse,
  Leaf,
  Map,
  PawPrint,
  Shield,
  ShieldAlert,
  ShieldHalf,
  Skull,
  Snowflake,
  Sparkles,
  Sun,
  Swords,
  WandSparkles,
  Zap,
  Trophy,
} from "lucide-react";

import {
  alchemistShopBg,
  bossCombat,
  campfire,
  corruptionAltar,
  eliteEnemyBg,
  merchantShopBg,
  mysteryBg,
  normalEnemyBg,
  theCampaign,
  theLabyrinth,
  theWildwoods,
  type KeywordId,
} from "@/lib/game-data";

import type { CollectionTab, Destination } from "../types";

// Collection tabs drive the collection navigation labels and icons.
export const collectionTabMeta: Array<{ id: CollectionTab; label: string; icon: LucideIcon }> = [
  { id: "cards", label: "Cards", icon: BookOpen },
  { id: "bestiary", label: "Bestiary", icon: ShieldAlert },
  { id: "trinkets", label: "Trinkets", icon: Trophy },
];

// Destination visual theming gives each route type an icon, palette, and art.
export const destinationMeta: Record<Destination, { icon: LucideIcon; className: string; art: string }> = {
  "Normal Combat": { icon: Swords, className: "bg-red-900/85 text-white", art: normalEnemyBg },
  "Elite Combat": { icon: ShieldAlert, className: "bg-violet-900/85 text-white", art: eliteEnemyBg },
  "Merchant's Shop": { icon: Coins, className: "bg-yellow-600/85 text-white", art: merchantShopBg },
  "Alchemist's Shop": { icon: WandSparkles, className: "bg-green-700/85 text-white", art: alchemistShopBg },
  Mystery: { icon: Sparkles, className: "bg-zinc-800/90 text-zinc-100", art: mysteryBg },
  Corruption: {
    icon: Dices,
    className:
      "bg-gradient-to-br from-red-950 via-black to-red-950 bg-[length:200%_200%] animate-shine text-red-400 border-0",
    art: corruptionAltar,
  },
  Campfire: { icon: Flame, className: "bg-emerald-600/85 text-white", art: campfire },
  "Boss Combat": { icon: Skull, className: "bg-red-950/90 text-red-300", art: bossCombat },
};

// Game mode visual theming for the game mode selection screen.
export const gameModeMeta: Record<string, { title: string; description: string; icon: LucideIcon; art: string }> = {
  campaign: {
    title: "The Campaign",
    description: "Journey through Act I, Act II, and Act III",
    icon: Swords,
    art: theCampaign,
  },
  labyrinth: {
    title: "The Labyrinth",
    description: "Descend through a maze of encounters",
    icon: Map,
    art: theLabyrinth,
  },
  wildwood: {
    title: "Wildwood Draft",
    description: "Draft a deck and survive an endless boss gauntlet",
    icon: PawPrint,
    art: theWildwoods,
  },
};

// Maps each keyword to its Lucide icon across status chips and card displays.
export const keywordIcons: Record<KeywordId, LucideIcon> = {
  physical: Swords,
  stun: Zap,
  block: Shield,
  forge: Hammer,
  armor: ShieldHalf,
  health: Heart,
  burn: Flame,
  gold: Coins,
  holy: Sun,
  wish: Sparkles,
  consume: CircleOff,
  poison: FlaskConical,
  bleed: Droplet,
  leech: HeartPulse,
  freeze: Snowflake,
  mana: Gem,
  nature: Leaf,
  companion: PawPrint,
  archery: Crosshair,
  phoenixFeather: Feather,
};
