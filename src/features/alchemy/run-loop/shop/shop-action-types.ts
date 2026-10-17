import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";

export type ShopActivity = "shop" | "alchemist" | "trinket-shop" | "equipment-shop";

export type ShopKind = "merchant" | "alchemist" | "trinket" | "equipment";

export type ShopRefreshModifiers = readonly EncounterRewardTraitId[];
