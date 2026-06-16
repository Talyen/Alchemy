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

// Destination visual theming gives each route type an icon, accent color, and art.
export const destinationMeta: Record<Destination, { icon: LucideIcon; accentClassName: string; art: string }> = {
  "Normal Combat": { icon: Swords, accentClassName: "text-red-400", art: normalEnemyBg },
  "Elite Combat": { icon: ShieldAlert, accentClassName: "text-violet-400", art: eliteEnemyBg },
  "Merchant's Shop": { icon: Coins, accentClassName: "text-amber-400", art: merchantShopBg },
  "Alchemist's Shop": { icon: WandSparkles, accentClassName: "text-emerald-400", art: alchemistShopBg },
  Mystery: { icon: Sparkles, accentClassName: "text-zinc-200", art: mysteryBg },
  Corruption: { icon: Dices, accentClassName: "text-red-400", art: corruptionAltar },
  Campfire: { icon: Flame, accentClassName: "text-emerald-300", art: campfire },
  "Boss Combat": { icon: Skull, accentClassName: "text-red-400", art: bossCombat },
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
