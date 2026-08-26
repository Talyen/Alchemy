// Visual metadata for destinations, collection tabs, and keyword iconography.
// Depends on Lucide icons, game-data image assets, and alchemy UI types.
import type { LucideIcon } from "lucide-react";
import {
  Beaker,
  BookOpen,
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
  User,
  WandSparkles,
  Wind,
  Zap,
  Trophy,
} from "lucide-react";

import {
  alchemistShopBg,
  campfire,
  corruptionAltar,
  eliteEnemyBg,
  merchantShopBg,
  mysteryBg,
  normalEnemyBg,
  theCampaign,
  theLabyrinth,
  wildwoodDraft,
  type KeywordId,
} from "@/features/alchemy/shared/config/game-data-catalog";

import type { Destination } from "@/lib/routing";
import type { PlasmaColorPair } from "@/lib/animation/plasma-colors";
import type { CollectionTab } from "../types";

// Collection tabs drive the collection navigation labels and icons.
export const collectionTabMeta: Array<{ id: CollectionTab; label: string; icon: LucideIcon }> = [
  { id: "heroes", label: "Heroes", icon: User },
  { id: "cards", label: "Cards", icon: BookOpen },
  { id: "bestiary", label: "Bestiary", icon: ShieldAlert },
  { id: "trinkets", label: "Trinkets", icon: Trophy },
];

// Destination visual theming gives each route type an icon, accent color, and art.
interface ThemedChooserMeta {
  icon: LucideIcon;
  accentClassName: string;
  art: string;
  plasmaColorPair: PlasmaColorPair;
}

export const destinationMeta: Record<Destination, ThemedChooserMeta> = {
  "Normal Combat": {
    icon: Swords,
    accentClassName: "text-red-400",
    art: normalEnemyBg,
    plasmaColorPair: { primary: "#f87171", secondary: "#7f1d1d" },
  },
  "Elite Combat": {
    icon: ShieldAlert,
    accentClassName: "text-violet-400",
    art: eliteEnemyBg,
    plasmaColorPair: { primary: "#c084fc", secondary: "#581c87" },
  },
  "Merchant's Shop": {
    icon: Coins,
    accentClassName: "text-amber-400",
    art: merchantShopBg,
    plasmaColorPair: { primary: "#fbbf24", secondary: "#78350f" },
  },
  "Alchemist's Shop": {
    icon: WandSparkles,
    accentClassName: "text-emerald-400",
    art: alchemistShopBg,
    plasmaColorPair: { primary: "#34d399", secondary: "#064e3b" },
  },
  "Trinket Shop": {
    icon: Gem,
    accentClassName: "text-violet-400",
    art: alchemistShopBg,
    plasmaColorPair: { primary: "#c084fc", secondary: "#581c87" },
  },
  "Equipment Shop": {
    icon: Hammer,
    accentClassName: "text-slate-300",
    art: merchantShopBg,
    plasmaColorPair: { primary: "#cbd5e1", secondary: "#334155" },
  },
  Mystery: {
    icon: Sparkles,
    accentClassName: "text-zinc-200",
    art: mysteryBg,
    plasmaColorPair: { primary: "#e4e4e7", secondary: "#3f3f46" },
  },
  Corruption: {
    icon: Dices,
    accentClassName: "text-red-400",
    art: corruptionAltar,
    plasmaColorPair: { primary: "#f87171", secondary: "#7f1d1d" },
  },
  Campfire: {
    icon: Flame,
    accentClassName: "text-emerald-300",
    art: campfire,
    plasmaColorPair: { primary: "#6ee7b7", secondary: "#064e3b" },
  },
  "Boss Combat": {
    icon: Skull,
    accentClassName: "text-red-400",
    art: normalEnemyBg,
    plasmaColorPair: { primary: "#f87171", secondary: "#7f1d1d" },
  },
};

// Game mode visual theming for the game mode selection screen.
export const gameModeMeta: Record<
  string,
  {
    title: string;
    description: string;
    icon: LucideIcon;
    art: string;
    accentClassName: string;
    plasmaColorPair: PlasmaColorPair;
  }
> = {
  campaign: {
    title: "The Campaign",
    description: "Journey through Act I, Act II, and Act III",
    icon: Swords,
    art: theCampaign,
    accentClassName: "text-red-400",
    plasmaColorPair: { primary: "#f87171", secondary: "#7f1d1d" },
  },
  labyrinth: {
    title: "The Labyrinth",
    description: "Descend through a maze of encounters",
    icon: Map,
    art: theLabyrinth,
    accentClassName: "text-violet-400",
    plasmaColorPair: { primary: "#c084fc", secondary: "#581c87" },
  },
  wildwood: {
    title: "Wildwood Draft",
    description: "Draft a deck and survive an endless boss gauntlet",
    icon: PawPrint,
    art: wildwoodDraft,
    accentClassName: "text-emerald-300",
    plasmaColorPair: { primary: "#6ee7b7", secondary: "#064e3b" },
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
  consume: Beaker,
  poison: FlaskConical,
  bleed: Droplet,
  leech: HeartPulse,
  freeze: Snowflake,
  mana: Gem,
  nature: Leaf,
  companion: PawPrint,
  archery: Crosshair,
  phoenixFeather: Feather,
  dodge: Wind,
};
