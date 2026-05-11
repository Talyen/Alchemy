// Visual metadata for destinations, collection tabs, and keyword iconography.
// Depends on Lucide icons, game-data image assets, and alchemy UI types.
import type { LucideIcon } from "lucide-react";
import { BookOpen, Coins, Crosshair, Flame, Gem, Hammer, Heart, HeartPulse, Leaf, PawPrint, Shield, ShieldAlert, Skull, Snowflake, Sparkles, Sun, Swords, TriangleAlert, WandSparkles, Zap, Trophy } from "lucide-react";

import { alchemistShopBg, campfire, eliteEnemyBg, merchantShopBg, mysteryBg, normalEnemyBg, placeholderDestination, type KeywordId } from "@/lib/game-data";

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
  "Merchant's Shop": { icon: Coins, className: "bg-amber-800/85 text-white", art: merchantShopBg },
  "Alchemist's Shop": { icon: WandSparkles, className: "bg-emerald-800/85 text-white", art: alchemistShopBg },
  Mystery: { icon: Sparkles, className: "bg-zinc-800/90 text-zinc-100", art: mysteryBg },
  Campfire: { icon: Flame, className: "bg-emerald-800/85 text-white", art: campfire },
  "Boss Combat": { icon: Skull, className: "bg-red-950/90 text-red-300", art: placeholderDestination },
};

// Maps each keyword to its Lucide icon across status chips and card displays.
export const keywordIcons: Record<KeywordId, LucideIcon> = {
  physical: Swords, stun: Zap, block: Shield, forge: Hammer, armor: ShieldAlert,
  health: Heart, burn: Flame, gold: Coins, holy: Sun, wish: Sparkles,
  ailment: TriangleAlert, consume: TriangleAlert, poison: Flame, bleed: Heart,
  leech: HeartPulse, freeze: Snowflake, mana: Gem, nature: Leaf,
  companion: PawPrint, trap: Crosshair,
};
