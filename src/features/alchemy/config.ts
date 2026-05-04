import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Coins,
  Flame,
  Gem,
  Hammer,
  Heart,
  HeartPulse,
  Shield,
  ShieldAlert,
  Snowflake,
  Sparkles,
  Sun,
  Swords,
  TriangleAlert,
  WandSparkles,
  Zap,
} from "lucide-react";

import { enemyBestiary, type KeywordId } from "@/lib/game-data";

import type { CardGhostVariant, CollectionTab, Destination, ResolutionOption } from "./types";

export function getCurrentEnemy(roomsEncountered: number) {
  if (roomsEncountered === 0) {
    return enemyBestiary.find((e) => e.id === "skeleton") ?? enemyBestiary[0];
  }
  const nonSkeletonEnemies = enemyBestiary.filter((e) => e.id !== "skeleton");
  return nonSkeletonEnemies[Math.floor(Math.random() * nonSkeletonEnemies.length)] ?? enemyBestiary[0];
}

export const resolutionOptions: ResolutionOption[] = ["1920x1080", "2560x1440", "3840x2160"];

export const destinationPool: Destination[] = [
  "Normal Combat",
  "Elite Combat",
  "Merchant's Shop",
  "Alchemist's Hut",
  "Mystery",
  "Campfire",
];

export const collectionTabMeta: Array<{ id: CollectionTab; label: string; icon: LucideIcon }> = [
  { id: "cards", label: "Cards", icon: BookOpen },
  { id: "bestiary", label: "Bestiary", icon: ShieldAlert },
];

export const destinationMeta: Record<Destination, { icon: LucideIcon; className: string }> = {
  "Normal Combat": {
    icon: Swords,
    className: "bg-rose-950/85 text-rose-100",
  },
  "Elite Combat": {
    icon: ShieldAlert,
    className: "bg-red-950/88 text-red-100",
  },
  "Merchant's Shop": {
    icon: Coins,
    className: "bg-amber-900/85 text-amber-100",
  },
  "Alchemist's Hut": {
    icon: WandSparkles,
    className: "bg-emerald-900/85 text-emerald-100",
  },
  Mystery: {
    icon: Sparkles,
    className: "bg-zinc-800/90 text-zinc-100",
  },
  Campfire: {
    icon: Flame,
    className: "bg-green-900/85 text-green-100",
  },
};

export const keywordIcons: Record<KeywordId, LucideIcon> = {
  physical: Swords,
  stun: Zap,
  block: Shield,
  forge: Hammer,
  armor: ShieldAlert,
  health: Heart,
  burn: Flame,
  gold: Coins,
  holy: Sun,
  wish: Sparkles,
  ailment: TriangleAlert,
  consume: TriangleAlert,
  poison: Flame,
  bleed: Heart,
  leech: HeartPulse,
  freeze: Snowflake,
  mana: Gem,
};

export const ghostDurations: Record<CardGhostVariant, number> = {
  "draw-in": 520,
  "discard-out": 320,
  activate: 672,
  "play-travel": 528,
};

export const battleCardWidthClass = "w-[clamp(222px,22vh,336px)]";
export const handCardWidthClass = "w-[clamp(189px,18.7vh,286px)]";
export const collectionCardWidthClass = "w-[clamp(156px,15vw,210px)]";
export const pileCardWidthClass = "w-[clamp(74px,7.4vh,112px)]";
export const cardSurfaceClass = "relative overflow-hidden rounded-[30px] bg-black shadow-[0_20px_48px_rgba(0,0,0,0.48)]";
export const staticCardTransform = "translate3d(0px, 0px, 0px)";
export const popupClassName =
  "absolute bottom-full left-1/2 z-40 mb-4 w-60 -translate-x-1/2 rounded-[20px] border border-border/80 bg-card px-3 py-3 text-left shadow-[0_18px_42px_rgba(0,0,0,0.55)]";
export const cardPopupClassName =
  "hover-popup-panel absolute left-1/2 top-0 z-40 w-full origin-bottom rounded-[20px] border border-border/80 bg-card px-4 py-3 text-left shadow-[0_18px_42px_rgba(0,0,0,0.55)]";

export const combatTextColorClasses: Record<string, string> = {
  physical: "text-slate-100",
  holy: "text-amber-200",
  stun: "text-amber-300",
  burn: "text-orange-300",
  poison: "text-lime-300",
  bleed: "text-rose-300",
  freeze: "text-cyan-300",
  block: "text-sky-300",
  armor: "text-yellow-200",
  forge: "text-yellow-300",
  haste: "text-fuchsia-300",
  health: "text-emerald-300",
  mana: "text-sky-400",
  gold: "text-yellow-300",
};

export const combatTextIconClasses: Record<string, LucideIcon> = {
  physical: Swords,
  holy: Sun,
  stun: Zap,
  burn: Flame,
  poison: Flame,
  bleed: Heart,
  freeze: Snowflake,
  block: Shield,
  armor: ShieldAlert,
  forge: Hammer,
  haste: Sparkles,
  health: HeartPulse,
  mana: Gem,
  gold: Coins,
};

export const keywordAliases: Array<{ match: string; keywordId: KeywordId }> = [
  { match: "Physical", keywordId: "physical" },
  { match: "Stun", keywordId: "stun" },
  { match: "Block", keywordId: "block" },
  { match: "Forge", keywordId: "forge" },
  { match: "Armor", keywordId: "armor" },
  { match: "Health", keywordId: "health" },
  { match: "Burn", keywordId: "burn" },
  { match: "Gold", keywordId: "gold" },
  { match: "Holy", keywordId: "holy" },
  { match: "Wish", keywordId: "wish" },
  { match: "Ailment", keywordId: "ailment" },
  { match: "Ailments", keywordId: "ailment" },
  { match: "Consume", keywordId: "consume" },
  { match: "Poison", keywordId: "poison" },
  { match: "Bleed", keywordId: "bleed" },
  { match: "Leech", keywordId: "leech" },
  { match: "Freeze", keywordId: "freeze" },
  { match: "Mana Crystal", keywordId: "mana" },
  { match: "Mana", keywordId: "mana" },
];

export const keywordPattern = new RegExp(
  `\\b(${keywordAliases
    .map((alias) => alias.match.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"))
    .sort((left, right) => right.length - left.length)
    .join("|")})\\b`,
  "gi",
);
