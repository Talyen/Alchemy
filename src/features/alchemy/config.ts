import type { LucideIcon } from "lucide-react";
import { BookOpen, Coins, Flame, Gem, Hammer, Heart, HeartPulse, Shield, ShieldAlert, Snowflake, Sparkles, Sun, Swords, TriangleAlert, WandSparkles, Zap, Trophy } from "lucide-react";

import { enemyBestiary, type KeywordId } from "@/lib/game-data";

import type { CardGhostVariant, CollectionTab, Destination, ResolutionOption } from "./types";

// Picks an enemy for the current room. Room 0 always starts with the Skeleton
// as a tutorial boss. Subsequent rooms pick randomly from the non-skeleton pool.
export function getCurrentEnemy(roomsEncountered: number) {
  if (roomsEncountered === 0) {
    return enemyBestiary.find((e) => e.id === "skeleton") ?? enemyBestiary[0];
  }
  const nonSkeletonEnemies = enemyBestiary.filter((e) => e.id !== "skeleton");
  return nonSkeletonEnemies[Math.floor(Math.random() * nonSkeletonEnemies.length)] ?? enemyBestiary[0];
}

export const resolutionOptions: ResolutionOption[] = ["1920x1080", "2560x1440", "3840x2160"];

// The pool of destinations the player can choose from after each victory.
// 6 options, 3 are randomly offered each time. Adding a new destination here
// requires a matching entry in destinationMeta and a Screen handler.
export const destinationPool: Destination[] = [
  "Normal Combat", "Elite Combat", "Merchant's Shop", "Alchemist's Hut", "Mystery", "Campfire",
];

// Collection tabs metadata — currently cards + bestiary. Trinkets is handled
// as a third tab but is missing from this meta array, likely a bug.
export const collectionTabMeta: Array<{ id: CollectionTab; label: string; icon: LucideIcon }> = [
  { id: "cards", label: "Cards", icon: BookOpen },
  { id: "bestiary", label: "Bestiary", icon: ShieldAlert },
  { id: "trinkets", label: "Trinkets", icon: Trophy },
];

// Destination visual theming — each type gets a unique icon + dark color scheme
// for its pill button. The className sets both background and text colors.
export const destinationMeta: Record<Destination, { icon: LucideIcon; className: string }> = {
  "Normal Combat": { icon: Swords, className: "bg-red-900/85 text-white" },
  "Elite Combat": { icon: ShieldAlert, className: "bg-violet-900/85 text-white" },
  "Merchant's Shop": { icon: Coins, className: "bg-amber-800/85 text-white" },
  "Alchemist's Hut": { icon: WandSparkles, className: "bg-emerald-800/85 text-white" },
  Mystery: { icon: Sparkles, className: "bg-zinc-800/90 text-zinc-100" },
  Campfire: { icon: Flame, className: "bg-emerald-800/85 text-white" },
};

// Maps each keyword to its Lucide icon. Used across the UI for status chips,
// talent displays, and floating combat text.
export const keywordIcons: Record<KeywordId, LucideIcon> = {
  physical: Swords, stun: Zap, block: Shield, forge: Hammer, armor: ShieldAlert,
  health: Heart, burn: Flame, gold: Coins, holy: Sun, wish: Sparkles,
  ailment: TriangleAlert, consume: TriangleAlert, poison: Flame, bleed: Heart,
  leech: HeartPulse, freeze: Snowflake, mana: Gem,
};

// Duration (ms) of each card ghost animation variant. Used by the card-ui
// component to auto-remove ghost elements after their animation completes.
export const ghostDurations: Record<CardGhostVariant, number> = {
  "draw-in": 520, "discard-out": 320, activate: 672, "play-travel": 528,
};

// ---- Responsive Card Widths ----
// These clamp() CSS values ensure cards look good at any viewport size.
// The min/ideal/max strategy prevents tiny cards on small screens and
// excessively large cards on ultra-wides.
export const battleCardWidthClass = "w-[clamp(222px,22vh,336px)]";
export const handCardWidthClass = "w-[clamp(189px,18.7vh,286px)]";
export const collectionCardWidthClass = "w-[clamp(156px,15vw,210px)]";
export const pileCardWidthClass = "w-[clamp(74px,7.4vh,112px)]";

// Card surface styling — shared by all card-like elements.
export const cardSurfaceClass = "relative overflow-hidden rounded-[30px] bg-black shadow-[0_20px_48px_rgba(0,0,0,0.48)]";
export const staticCardTransform = "translate3d(0px, 0px, 0px)";

// Popup panel styles for card detail hover popups and the battle menu.
export const popupClassName = "absolute bottom-full left-1/2 z-40 mb-4 w-60 -translate-x-1/2 rounded-[20px] border border-border/80 bg-card px-3 py-3 text-left shadow-[0_18px_42px_rgba(0,0,0,0.55)]";
export const cardPopupClassName = "hover-popup-panel absolute left-1/2 top-0 z-40 w-full origin-bottom rounded-[20px] border border-border/80 bg-card px-4 py-3 text-left shadow-[0_18px_42px_rgba(0,0,0,0.55)]";

// ---- Combat Text Theming ----
// Maps damage/status types to colors for floating combat text. These match
// the keyword colors used elsewhere in the UI.
export const combatTextColorClasses: Record<string, string> = {
  physical: "text-slate-100", holy: "text-amber-200", stun: "text-amber-300",
  burn: "text-orange-300", poison: "text-lime-300", bleed: "text-rose-300",
  freeze: "text-cyan-300", block: "text-sky-300", armor: "text-yellow-200",
  forge: "text-yellow-300", haste: "text-fuchsia-300", health: "text-emerald-300",
  mana: "text-sky-400", gold: "text-yellow-300",
};

// Maps stats to their display icons for floating combat text.
export const combatTextIconClasses: Record<string, LucideIcon> = {
  physical: Swords, holy: Sun, stun: Zap, burn: Flame, poison: Flame,
  bleed: Heart, freeze: Snowflake, block: Shield, armor: ShieldAlert,
  forge: Hammer, haste: Sparkles, health: HeartPulse, mana: Gem, gold: Coins,
};

// ---- Keyword Aliases & Pattern ----
// Maps display-friendly strings like "Physical" to their KeywordId.
// Used to colorize card descriptions — text matching these aliases gets the
// keyword's color highlight. Sorted by length descending so multi-word aliases
// (like "Mana Crystal") match before their sub-strings ("Mana").
export const keywordAliases: Array<{ match: string; keywordId: KeywordId }> = [
  { match: "Physical", keywordId: "physical" }, { match: "Stun", keywordId: "stun" },
  { match: "Block", keywordId: "block" }, { match: "Forge", keywordId: "forge" },
  { match: "Armor", keywordId: "armor" }, { match: "Health", keywordId: "health" },
  { match: "Burn", keywordId: "burn" }, { match: "Gold", keywordId: "gold" },
  { match: "Holy", keywordId: "holy" }, { match: "Wish", keywordId: "wish" },
  { match: "Ailment", keywordId: "ailment" }, { match: "Ailments", keywordId: "ailment" },
  { match: "Consume", keywordId: "consume" }, { match: "Poison", keywordId: "poison" },
  { match: "Bleed", keywordId: "bleed" }, { match: "Leech", keywordId: "leech" },
  { match: "Freeze", keywordId: "freeze" }, { match: "Mana Crystal", keywordId: "mana" },
  { match: "Mana", keywordId: "mana" },
];

// Pre-compiled regex for keyword highlighting. Built once at module init so
// card description rendering doesn't rebuild the regex on every frame.
export const keywordPattern = new RegExp(
  `\\b(${keywordAliases
    .map((alias) => alias.match.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"))
    .sort((left, right) => right.length - left.length)
    .join("|")})\\b`,
  "gi",
);
