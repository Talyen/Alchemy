/* eslint-disable react-refresh/only-export-components -- co-located resource artwork, wallet pills, and color maps */
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

export type ResourceArtworkSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_CLASSES: Record<ResourceArtworkSize, string> = {
  xs: "h-3.5 w-3.5",
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-10 w-10",
  xl: "h-12 w-12",
};

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

function TrinketWalletResourcePill({
  resource,
  title,
  amount,
  showsIncreasePrefix = false,
  fillsAvailableWidth = true,
  size = "md",
  className,
}: {
  resource: HomesteadResource;
  title?: string | undefined;
  amount: number;
  showsIncreasePrefix?: boolean | undefined;
  fillsAvailableWidth?: boolean | undefined;
  size?: "md" | "lg" | undefined;
  className?: string | undefined;
}) {
  const displayTitle = title ?? RESOURCE_LABELS[resource] ?? resource;
  const formattedAmount = formatLargeAmount(amount);
  const displayedValue = showsIncreasePrefix ? `+${formattedAmount}` : formattedAmount;
  const large = size === "lg";

  return (
    <div
      className={cn(
        "flex items-center rounded-xl border border-border/60 bg-card/65 shadow-sm backdrop-blur-sm transition-colors",
        large ? "min-h-[64px] gap-3.5 px-5 py-3" : "min-h-[52px] gap-3 px-3.5 py-2.5",
        fillsAvailableWidth ? "w-full" : "w-auto",
        className,
      )}
    >
      <HomesteadResourceArtwork resource={resource} size={large ? "xl" : "lg"} className="drop-shadow-sm" />
      <div className="flex min-w-0 flex-col text-left leading-tight">
        <span
          className={cn(
            "truncate font-medium tracking-wider text-muted-foreground uppercase",
            large ? "text-base" : "text-sm",
          )}
        >
          {displayTitle}
        </span>
        <span className={cn("truncate font-bold text-foreground tabular-nums", large ? "text-xl" : "text-lg")}>
          {displayedValue}
        </span>
      </div>
    </div>
  );
}

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

export function MaterialPill({
  material,
  amount,
  showsIncreasePrefix = false,
  size = "md",
}: {
  material: MaterialId;
  amount: number;
  showsIncreasePrefix?: boolean | undefined;
  size?: "md" | "lg" | undefined;
}) {
  return (
    <TrinketWalletResourcePill
      resource={material}
      amount={amount}
      showsIncreasePrefix={showsIncreasePrefix}
      fillsAvailableWidth={false}
      size={size}
      className={size === "lg" ? "min-w-[160px]" : "min-w-[136px]"}
    />
  );
}

export function GoldPill({
  amount,
  showsIncreasePrefix = false,
  size = "md",
}: {
  amount: number;
  showsIncreasePrefix?: boolean | undefined;
  size?: "md" | "lg" | undefined;
}) {
  return (
    <TrinketWalletResourcePill
      resource="gold"
      amount={amount}
      showsIncreasePrefix={showsIncreasePrefix}
      fillsAvailableWidth={false}
      size={size}
      className={size === "lg" ? "min-w-[160px]" : "min-w-[136px]"}
    />
  );
}
