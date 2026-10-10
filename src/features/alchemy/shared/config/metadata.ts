import type { LucideIcon } from "lucide-react";
import {
  Anvil,
  Beaker,
  BookOpen,
  Coins,
  Crown,
  Crosshair,
  Dices,
  Droplet,
  Flame,
  FlaskConical,
  Gem,
  Hammer,
  Heart,
  HeartPulse,
  Leaf,
  Map,
  PawPrint,
  Store,
  Shield,
  ShieldAlert,
  ShieldHalf,
  Skull,
  Snowflake,
  Sparkles,
  Sun,
  Swords,
  TreePine,
  User,
  Wind,
  Zap,
  Trophy,
} from "lucide-react";

import {
  alchemistShopBg,
  campfire,
  transmutationCrucible,
  corruptionAltar,
  eliteEnemyBg,
  keywordDefinitions,
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

export const collectionTabMeta: Array<{
  id: CollectionTab;
  label: string;
  icon: LucideIcon;
  iconClassName: string;
}> = [
  { id: "heroes", label: "Heroes", icon: User, iconClassName: "text-emerald-400" },
  { id: "cards", label: "Cards", icon: BookOpen, iconClassName: keywordDefinitions.mana.colorClass },
  { id: "bestiary", label: "Bestiary", icon: ShieldAlert, iconClassName: keywordDefinitions.health.colorClass },
  { id: "trinkets", label: "Trinkets", icon: Trophy, iconClassName: keywordDefinitions.gold.colorClass },
  { id: "uniques", label: "Uniques", icon: Gem, iconClassName: keywordDefinitions.consume.colorClass },
];

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
    icon: Skull,
    accentClassName: "text-violet-400",
    art: eliteEnemyBg,
    plasmaColorPair: { primary: "#a78bfa", secondary: "#4c1d95" },
  },
  "Card Shop": {
    icon: Store,
    accentClassName: "text-amber-400",
    art: merchantShopBg,
    plasmaColorPair: { primary: "#fbbf24", secondary: "#78350f" },
  },
  "Alchemist's Shop": {
    icon: FlaskConical,
    accentClassName: "text-emerald-400",
    art: alchemistShopBg,
    plasmaColorPair: { primary: "#34d399", secondary: "#064e3b" },
  },
  "Trinket Shop": {
    icon: Gem,
    accentClassName: "text-cyan-300",
    art: alchemistShopBg,
    plasmaColorPair: { primary: "#67e8f9", secondary: "#155e75" },
  },
  "Gear Shop": {
    icon: Anvil,
    accentClassName: "text-slate-400",
    art: merchantShopBg,
    plasmaColorPair: { primary: "#94a3b8", secondary: "#334155" },
  },
  Mystery: {
    icon: Sparkles,
    accentClassName: "text-lime-400",
    art: mysteryBg,
    plasmaColorPair: { primary: "#a3e635", secondary: "#365314" },
  },
  Transmutation: {
    icon: Beaker,
    accentClassName: "text-blue-400",
    art: transmutationCrucible,
    plasmaColorPair: { primary: "#60a5fa", secondary: "#1e3a8a" },
  },
  Corruption: {
    icon: Dices,
    accentClassName: "text-red-500",
    art: corruptionAltar,
    plasmaColorPair: { primary: "#ef4444", secondary: "#7f1d1d" },
  },
  Campfire: {
    icon: Flame,
    accentClassName: "text-orange-400",
    art: campfire,
    plasmaColorPair: { primary: "#fb923c", secondary: "#7c2d12" },
  },
  "Boss Combat": {
    icon: Crown,
    accentClassName: "text-red-400",
    art: normalEnemyBg,
    plasmaColorPair: { primary: "#f87171", secondary: "#7f1d1d" },
  },
};

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
  dodge: Wind,
  thorns: TreePine,
};
