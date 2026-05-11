// Combat text presentation classes for battle feedback.
// Depends on Lucide icons used by floating text renderers.
import type { LucideIcon } from "lucide-react";
import { Coins, Flame, Gem, Hammer, Heart, HeartPulse, Shield, ShieldAlert, Snowflake, Sparkles, Sun, Swords, Zap } from "lucide-react";

// Maps damage/status types to colors for floating combat text.
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
