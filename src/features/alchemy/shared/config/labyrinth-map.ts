import { Crown, DoorOpen, FlaskConical, Gem, Hammer, Heart, ShoppingCart, Skull, Sparkles, Swords } from "lucide-react";

import type { LabyrinthNodeType } from "@/lib/content-systems/types";
import {
  alchemistShopBg,
  campfire,
  eliteEnemyBg,
  merchantShopBg,
  mysteryBg,
  normalEnemyBg,
  theLabyrinth,
} from "@/features/alchemy/shared/config/game-data-catalog";

import { SHINE_PALETTES } from "./shine-palettes";

export interface LabyrinthNodeMeta {
  icon: React.ComponentType<{ className?: string }>;
  className: string;
  shineColors: string[];
  art: string;
  actionLabel: string;
}

export const LABYRINTH_NODE_META: Record<LabyrinthNodeType, LabyrinthNodeMeta> = {
  entrance: {
    icon: DoorOpen,
    className: "bg-black text-stone-600",
    shineColors: [...SHINE_PALETTES.labyrinth.entrance],
    art: theLabyrinth,
    actionLabel: "Enter",
  },
  combat: {
    icon: Swords,
    className: "bg-black text-red-500",
    shineColors: [...SHINE_PALETTES.labyrinth.combat],
    art: normalEnemyBg,
    actionLabel: "Fight",
  },
  elite: {
    icon: Skull,
    className: "bg-black text-violet-500",
    shineColors: [...SHINE_PALETTES.labyrinth.elite],
    art: eliteEnemyBg,
    actionLabel: "Fight",
  },
  rest: {
    icon: Heart,
    className: "bg-black text-orange-500",
    shineColors: [...SHINE_PALETTES.labyrinth.rest],
    art: campfire,
    actionLabel: "Rest",
  },
  mystery: {
    icon: Sparkles,
    className: "bg-black text-zinc-400",
    shineColors: [...SHINE_PALETTES.labyrinth.mystery],
    art: mysteryBg,
    actionLabel: "Investigate",
  },
  shop: {
    icon: ShoppingCart,
    className: "bg-black text-yellow-500",
    shineColors: [...SHINE_PALETTES.labyrinth.shop],
    art: merchantShopBg,
    actionLabel: "Enter",
  },
  alchemist: {
    icon: FlaskConical,
    className: "bg-black text-emerald-500",
    shineColors: [...SHINE_PALETTES.labyrinth.alchemist],
    art: alchemistShopBg,
    actionLabel: "Enter",
  },
  "trinket-shop": {
    icon: Gem,
    className: "bg-black text-violet-500",
    shineColors: [...SHINE_PALETTES.labyrinth["trinket-shop"]],
    art: alchemistShopBg,
    actionLabel: "Enter",
  },
  "equipment-shop": {
    icon: Hammer,
    className: "bg-black text-slate-400",
    shineColors: [...SHINE_PALETTES.labyrinth["equipment-shop"]],
    art: merchantShopBg,
    actionLabel: "Enter",
  },
  boss: {
    icon: Crown,
    className: "bg-black text-red-400",
    shineColors: [...SHINE_PALETTES.labyrinth.boss],
    art: normalEnemyBg,
    actionLabel: "Fight",
  },
};

export const LABYRINTH_HEX_CLIP = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";
