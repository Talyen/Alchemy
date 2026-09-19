import { ShineBorder } from "@/components/ui/shine-border";

// Hover/focus-only hero shine: the group parent owns the reveal so the border
// stays decorative and costs nothing until interaction.
const HERO_SHINE_CLASS =
  "z-20 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100";

export function HeroCardShine({ colors }: { colors: readonly string[] }) {
  if (colors.length === 0) return null;
  return <ShineBorder shineColor={colors} borderWidth={3} className={HERO_SHINE_CLASS} />;
}
