// Combat text presentation classes for battle feedback.
// Depends on Lucide icons used by floating text renderers.
// Colors are read from keywordDefinitions (keywords.ts) — only non-keyword overrides live here.
import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";

// Maps non-keyword stats to their display icons for floating combat text.
// Keyword icons come from keywordDefinitions (keywords.ts).
export const combatTextIconClasses: Record<string, LucideIcon> = {
  haste: Sparkles,
};
