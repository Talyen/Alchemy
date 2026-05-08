import type { LucideIcon } from "lucide-react";
import { BookOpen, Coins, Crosshair, Flame, Gem, Hammer, Heart, HeartPulse, Leaf, PawPrint, Shield, ShieldAlert, Snowflake, Sparkles, Sun, Swords, TriangleAlert, WandSparkles, Zap, Trophy } from "lucide-react";

import { enemyBestiary, type EnemyType, type KeywordId } from "@/lib/game-data";
import { alchemistShopBg, campfire, eliteEnemyBg, merchantShopBg, mysteryBg, normalEnemyBg } from "@/lib/game-data";

import type { CardGhostVariant, CollectionTab, Destination, DisplayMode, ResolutionOption, UiScale } from "./types";

// Picks an enemy for the current room. Room 0 always starts with the Skeleton
// as a tutorial boss. Subsequent rooms pick from normal or elite pools
// based on the current destination type.
export function getCurrentEnemy(roomsEncountered: number, enemyType?: EnemyType) {
  if (roomsEncountered === 0) {
    return enemyBestiary.find((e) => e.id === "skeleton") ?? enemyBestiary[0];
  }
  const pool = enemyType ? enemyBestiary.filter((e) => e.enemyType === enemyType) : enemyBestiary.filter((e) => e.id !== "skeleton");
  const available = pool.length > 0 ? pool : enemyBestiary.filter((e) => e.id !== "skeleton");
  return available[Math.floor(Math.random() * available.length)] ?? enemyBestiary[0];
}

export const resolutionOptions: ResolutionOption[] = ["1366x768", "1600x900", "1920x1080", "1920x1200", "2560x1080", "2560x1440", "3440x1440", "3840x2160"];

export const displayModeOptions: Array<{ value: DisplayMode; label: string }> = [
  { value: "windowed", label: "Windowed" },
  { value: "borderless-fullscreen", label: "Borderless Fullscreen" },
  { value: "fullscreen", label: "Fullscreen" },
];

export const uiScaleOptions: Array<{ value: UiScale; label: string }> = [
  { value: "90", label: "Small" },
  { value: "100", label: "Normal" },
  { value: "110", label: "Large" },
  { value: "120", label: "Very Large" },
];

// The pool of destinations the player can choose from after each victory.
// 6 options, 3 are randomly offered each time. Adding a new destination here
// requires a matching entry in destinationMeta and a Screen handler.
export const destinationPool: Destination[] = [
  "Normal Combat", "Elite Combat", "Merchant's Shop", "Alchemist's Shop", "Mystery", "Campfire",
];

// Collection tabs metadata — currently cards + bestiary. Trinkets is handled
// as a third tab but is missing from this meta array, likely a bug.
export const collectionTabMeta: Array<{ id: CollectionTab; label: string; icon: LucideIcon }> = [
  { id: "cards", label: "Cards", icon: BookOpen },
  { id: "bestiary", label: "Bestiary", icon: ShieldAlert },
  { id: "trinkets", label: "Trinkets", icon: Trophy },
];

// Destination visual theming — each type gets a unique icon + dark color scheme
// for its pill button and a background art image displayed above the button.
export const destinationMeta: Record<Destination, { icon: LucideIcon; className: string; art: string }> = {
  "Normal Combat": { icon: Swords, className: "bg-red-900/85 text-white", art: normalEnemyBg },
  "Elite Combat": { icon: ShieldAlert, className: "bg-violet-900/85 text-white", art: eliteEnemyBg },
  "Merchant's Shop": { icon: Coins, className: "bg-amber-800/85 text-white", art: merchantShopBg },
  "Alchemist's Shop": { icon: WandSparkles, className: "bg-emerald-800/85 text-white", art: alchemistShopBg },
  Mystery: { icon: Sparkles, className: "bg-zinc-800/90 text-zinc-100", art: mysteryBg },
  Campfire: { icon: Flame, className: "bg-emerald-800/85 text-white", art: campfire },
};

// Maps each keyword to its Lucide icon. Used across the UI for status chips,
// talent displays, and floating combat text.
export const keywordIcons: Record<KeywordId, LucideIcon> = {
  physical: Swords, stun: Zap, block: Shield, forge: Hammer, armor: ShieldAlert,
  health: Heart, burn: Flame, gold: Coins, holy: Sun, wish: Sparkles,
  ailment: TriangleAlert, consume: TriangleAlert, poison: Flame, bleed: Heart,
  leech: HeartPulse, freeze: Snowflake, mana: Gem, nature: Leaf,
  companion: PawPrint, trap: Crosshair,
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
export const pileCardWidthClass = "w-[clamp(144px,14.4vh,219px)]";

// Mobile-safe card widths for touch / small-landscape viewports.
// These are smaller than desktop to fit side-by-side player/enemy panels.
export const mobileBattleCardWidthClass = "w-[clamp(120px,26vh,180px)]";
export const mobileHandCardWidthClass = "w-[clamp(90px,25vw,150px)]";
export const mobilePileCardWidthClass = "w-[clamp(60px,6vh,90px)]";

// Card surface styling — shared by all card-like elements.
export const cardSurfaceClass = "relative overflow-hidden rounded-[30px] bg-black";
export const staticCardTransform = "translate3d(0px, 0px, 0px)";

// Popup panel styles for card detail hover popups and the battle menu.
export const popupClassName = "absolute bottom-full left-1/2 z-40 mb-4 w-60 -translate-x-1/2 rounded-[20px] border border-border/80 bg-card px-3 py-3 text-left";
export const cardPopupClassName = "hover-popup-panel absolute left-1/2 top-0 z-40 w-full origin-bottom rounded-[20px] border border-border/80 bg-card px-4 py-3 text-left";

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
  { match: "Mana", keywordId: "mana" }, { match: "Companion", keywordId: "companion" },
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
