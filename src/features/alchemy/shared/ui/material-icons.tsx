// Shared material/resource artwork, wallet cards, and reward pills adopting Trinket styling.
/* eslint-disable react-refresh/only-export-components -- co-located resource artwork, wallet pills, and color maps */
import type { ReactNode } from "react";
import { cn, formatLargeAmount } from "@/lib/utils";
import { MATERIAL_IDS, materialLabels, type MaterialId, type MaterialInventory } from "@/lib/homestead/types";
import {
  resourceCrystal,
  resourceFood,
  resourceGold,
  resourceHerbs,
  resourceHide,
  resourceIron,
  resourceStone,
  resourceWood,
} from "@/lib/game-data";

export type HomesteadResource = MaterialId | "gold" | "stone" | "hide";

const RESOURCE_ART_MAP: Record<HomesteadResource, string> = {
  wood: resourceWood,
  iron: resourceIron,
  herbs: resourceHerbs,
  food: resourceFood,
  crystal: resourceCrystal,
  gold: resourceGold,
  stone: resourceStone,
  hide: resourceHide,
};

const RESOURCE_LABELS: Record<HomesteadResource, string> = {
  ...materialLabels,
  gold: "Gold",
  stone: "Stone",
  hide: "Hide",
};

export const matTextColor: Record<MaterialId, string> = {
  wood: "text-[#AC8E68]",
  iron: "text-[#8CA2B8]",
  herbs: "text-[#30D158]",
  food: "text-[#FF9F0A]",
  crystal: "text-[#0A84FF]",
};

export const matPillStyle: Record<MaterialId, string> = {
  wood: "bg-[#AC8E68]/15 border-[#AC8E68]/30",
  iron: "bg-[#4C637A]/20 border-[#4C637A]/30",
  herbs: "bg-[#30D158]/15 border-[#30D158]/30",
  food: "bg-[#FF9F0A]/15 border-[#FF9F0A]/30",
  crystal: "bg-[#0A84FF]/15 border-[#0A84FF]/30",
};

export const goldTextColor = "text-[#D6B85A]";
export const goldPillStyle = "border-[#D6B85A]/30 bg-[#D6B85A]/15";

export type ResourceArtworkSize = "sm" | "md" | "lg" | "xl";

const SIZE_CLASSES: Record<ResourceArtworkSize, string> = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-9 w-9",
  xl: "h-11 w-11",
};

/** High-resolution raster artwork for Homestead resources and currencies. */
export function HomesteadResourceArtwork({
  resource,
  size = "md",
  className,
  alt,
}: {
  resource: HomesteadResource;
  size?: ResourceArtworkSize | undefined;
  className?: string | undefined;
  alt?: string | undefined;
}) {
  const artSrc = RESOURCE_ART_MAP[resource];
  const sizeClass = SIZE_CLASSES[size];

  return (
    <img
      src={artSrc}
      alt={alt ?? RESOURCE_LABELS[resource] ?? resource}
      className={cn("shrink-0 object-contain select-none", sizeClass, className)}
      loading="eager"
      decoding="async"
      draggable={false}
    />
  );
}

/** Drop-in alias for MaterialIcon using crisp raster art. */
export function MaterialIcon({
  material,
  className,
  size = "md",
}: {
  material: MaterialId;
  className?: string | undefined;
  size?: ResourceArtworkSize | undefined;
}) {
  return <HomesteadResourceArtwork resource={material} size={size} className={className} />;
}

/** Trinket-styled wallet resource pill displaying icon, caption title, and stat amount. */
function TrinketWalletResourcePill({
  resource,
  title,
  amount,
  showsIncreasePrefix = false,
  fillsAvailableWidth = true,
  className,
}: {
  resource: HomesteadResource;
  title?: string | undefined;
  amount: number;
  showsIncreasePrefix?: boolean | undefined;
  fillsAvailableWidth?: boolean | undefined;
  className?: string | undefined;
}) {
  const displayTitle = title ?? RESOURCE_LABELS[resource] ?? resource;
  const formattedAmount = formatLargeAmount(amount);
  const displayedValue = showsIncreasePrefix ? `+${formattedAmount}` : formattedAmount;

  return (
    <div
      className={cn(
        "flex min-h-[46px] items-center gap-2.5 rounded-xl border border-border/60 bg-card/65 px-3 py-2 shadow-sm backdrop-blur-sm transition-colors",
        fillsAvailableWidth ? "w-full" : "w-auto",
        className,
      )}
    >
      <HomesteadResourceArtwork resource={resource} size="lg" className="drop-shadow-sm" />
      <div className="flex min-w-0 flex-col text-left leading-tight">
        <span className="truncate text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
          {displayTitle}
        </span>
        <span className="truncate text-base font-bold text-foreground tabular-nums">{displayedValue}</span>
      </div>
    </div>
  );
}

/** Trinket wallet grid container with dark fantasy panel styling. */
export function TrinketWalletGrid({
  children,
  hugsContent = false,
  className,
}: {
  children: ReactNode;
  hugsContent?: boolean | undefined;
  className?: string | undefined;
}) {
  return (
    <div
      className={cn(
        "rounded-shell-card border border-border/60 bg-card/75 p-3 shadow-md backdrop-blur-md",
        hugsContent ? "inline-flex flex-wrap items-center justify-center gap-2.5" : "w-full",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Homestead screen top wallet bar displaying Gold + the 5 Homestead Materials. */
export function HomesteadResourceWallet({
  gold = 0,
  materialInventory,
  className,
}: {
  gold?: number | undefined;
  materialInventory: MaterialInventory;
  className?: string | undefined;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-4xl", className)}>
      <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
        <TrinketWalletResourcePill resource="gold" amount={gold} />
        {MATERIAL_IDS.map((mat) => (
          <TrinketWalletResourcePill key={mat} resource={mat} amount={materialInventory[mat] ?? 0} />
        ))}
      </div>
    </div>
  );
}

/** Material cost indicator inside upgrade buttons or node headers with red unaffordable tint. */
export function MaterialCost({
  material,
  amount,
  affordable = true,
  className,
}: {
  material: MaterialId;
  amount: number;
  affordable?: boolean | undefined;
  className?: string | undefined;
}) {
  return (
    <span className={cn("ml-1.5 inline-flex shrink-0 items-center gap-1.5 leading-none", className)}>
      <HomesteadResourceArtwork resource={material} size="md" />
      <span
        className={cn(
          "leading-none font-bold tabular-nums",
          affordable ? "text-foreground" : "font-extrabold text-destructive",
        )}
      >
        {amount}
      </span>
    </span>
  );
}

/** Trinket-styled reward/inline pill. */
export function MaterialPill({
  material,
  amount,
  showsIncreasePrefix = false,
}: {
  material: MaterialId;
  amount: number;
  showsIncreasePrefix?: boolean | undefined;
}) {
  return (
    <TrinketWalletResourcePill
      resource={material}
      amount={amount}
      showsIncreasePrefix={showsIncreasePrefix}
      fillsAvailableWidth={false}
      className="min-w-[120px]"
    />
  );
}

/** Trinket-styled Gold reward/inline pill. */
export function GoldPill({
  amount,
  showsIncreasePrefix = false,
}: {
  amount: number;
  showsIncreasePrefix?: boolean | undefined;
}) {
  return (
    <TrinketWalletResourcePill
      resource="gold"
      amount={amount}
      showsIncreasePrefix={showsIncreasePrefix}
      fillsAvailableWidth={false}
      className="min-w-[120px]"
    />
  );
}
