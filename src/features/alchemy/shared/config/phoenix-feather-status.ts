import { Feather } from "lucide-react";
import { CAMPFIRE_HEAL_FRACTION } from "@/lib/game-constants";

export const phoenixFeatherStatus = {
  label: "Phoenix Feather",
  description: `The next time you would die, instead restore ${Math.round(CAMPFIRE_HEAL_FRACTION * 100)}% Health, then remove this effect`,
  colorClass: "text-orange-300",
  shineColors: ["#fdba74", "#ea580c", "#fdba74"],
  textShineColors: ["#fdba74", "color-mix(in srgb, #fdba74 55%, transparent)"],
  icon: Feather,
} as const;
