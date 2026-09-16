import { useLayoutEffect, useRef, useState } from "react";
import { cn, formatLargeAmount } from "@/lib/utils";
import { MATERIAL_IDS, materialLabels, type MaterialId, type MaterialInventory } from "@/lib/homestead/types";
import {
  resourceGems,
  resourceFood,
  resourceGold,
  resourceHerbs,
  resourceHide,
  resourceIron,
  resourceStone,
  resourceWood,
} from "@/lib/game-data";

export type HomesteadResource = MaterialId | "gold";

const RESOURCE_ART_MAP: Record<HomesteadResource, string> = {
  wood: resourceWood,
  stone: resourceStone,
  iron: resourceIron,
  food: resourceFood,
  herbs: resourceHerbs,
  hide: resourceHide,
  gems: resourceGems,
  gold: resourceGold,
};

const RESOURCE_LABELS: Record<HomesteadResource, string> = {
  ...materialLabels,
  gold: "Gold",
};

export const matTextColor: Record<MaterialId, string> = {
  wood: "text-[#AC8E68]",
  stone: "text-[#8E8E93]",
  iron: "text-[#8CA2B8]",
  food: "text-[#FF9F0A]",
  herbs: "text-[#30D158]",
  hide: "text-[#D94F30]",
  gems: "text-[#0A84FF]",
};

export const matPillStyle: Record<MaterialId, string> = {
  wood: "bg-[#AC8E68]/15 border-[#AC8E68]/30",
  stone: "bg-[#8E8E93]/15 border-[#8E8E93]/30",
  iron: "bg-[#4C637A]/20 border-[#4C637A]/30",
  food: "bg-[#FF9F0A]/15 border-[#FF9F0A]/30",
  herbs: "bg-[#30D158]/15 border-[#30D158]/30",
  hide: "bg-[#D94F30]/15 border-[#D94F30]/30",
  gems: "bg-[#0A84FF]/15 border-[#0A84FF]/30",
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

// Largest-first label sizes. The hook below drops to the next step only while the
// text overflows its box, so short names keep full size and only long names like
// Herbs shrink. Ellipsis truncation remains as the last resort when nothing fits.
const LABEL_STEPS = ["text-xs tracking-wide sm:text-sm", "text-xs tracking-wide", "text-[11px] tracking-normal"];
const LABEL_STEPS_LARGE = ["text-base tracking-wide", "text-sm tracking-wide", "text-xs tracking-normal"];

const SHRINK_EPSILON_PX = 1;

function useShrinkToFit(text: string, maxStep: number) {
  const [element, onElement] = useState<HTMLSpanElement | null>(null);
  const [step, setStep] = useState(0);
  const [remeasure, setRemeasure] = useState(0);
  const lastWidthRef = useRef(0);
  const lastTextRef = useRef(text);

  // Re-fit when the box resizes (viewport, Game Size) or webfonts arrive. The
  // shrink loop below only ever steps down, and resets only on growth, so a
  // resize caused by our own shrink cannot ping-pong.
  useLayoutEffect(() => {
    if (!element || typeof ResizeObserver === "undefined") return;
    let frame: number | null = null;
    const observer = new ResizeObserver(() => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = null;
        setRemeasure((tick) => tick + 1);
      });
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [element]);

  useLayoutEffect(() => {
    if (typeof document === "undefined" || typeof document.fonts?.ready?.then !== "function") return;
    let cancelled = false;
    document.fonts.ready.then(
      () => {
        if (!cancelled) setRemeasure((tick) => tick + 1);
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-validates whenever the box, text, step, or a resize/font tick changes.
  // Resets to full size only on growth or new text; shrink steps only move down,
  // so a resize caused by our own shrink cannot ping-pong. Unmeasurable
  // environments (SSR, jsdom) keep full size.
  useLayoutEffect(() => {
    let nextStep: number | null = null;
    if (!element) {
      lastWidthRef.current = 0;
      lastTextRef.current = text;
      if (step !== 0) nextStep = 0;
    } else if (lastTextRef.current !== text) {
      lastTextRef.current = text;
      lastWidthRef.current = element.clientWidth;
      if (step !== 0) nextStep = 0;
    } else {
      const width = element.clientWidth;
      if (width <= 0) {
        lastWidthRef.current = 0;
        if (step !== 0) nextStep = 0;
      } else if (width > lastWidthRef.current + SHRINK_EPSILON_PX && step !== 0) {
        lastWidthRef.current = width;
        nextStep = 0;
      } else {
        lastWidthRef.current = width;
        if (element.scrollWidth > width + SHRINK_EPSILON_PX && step < maxStep) nextStep = step + 1;
      }
    }
    if (nextStep !== null) setStep(nextStep);
  }, [element, text, step, remeasure, maxStep]);

  return [onElement, step] as const;
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
  const labelSteps = large ? LABEL_STEPS_LARGE : LABEL_STEPS;
  const [onLabel, labelStep] = useShrinkToFit(displayTitle, labelSteps.length - 1);

  return (
    <div
      className={cn(
        "flex min-w-0 items-center overflow-hidden rounded-xl border border-border/60 bg-card/65 shadow-sm backdrop-blur-sm transition-colors",
        large
          ? "min-h-[calc(64px*var(--content-scale,1))] gap-3.5 px-5 py-3"
          : "min-h-[calc(52px*var(--content-scale,1))] gap-2.5 px-3 py-2.5 sm:gap-3 sm:px-3.5",
        fillsAvailableWidth ? "w-full" : "w-auto",
        className,
      )}
    >
      <HomesteadResourceArtwork resource={resource} size={large ? "xl" : "lg"} className="drop-shadow-sm" />
      <div className="flex min-w-0 flex-1 flex-col text-left leading-tight">
        <span
          ref={onLabel}
          title={displayTitle}
          className={cn(
            "truncate font-medium whitespace-nowrap text-muted-foreground uppercase",
            labelSteps[labelStep] ?? labelSteps[0],
          )}
        >
          {displayTitle}
        </span>
        <span
          title={displayedValue}
          className={cn("truncate font-bold text-foreground tabular-nums", large ? "text-xl" : "text-lg")}
        >
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
    <div
      className={cn(
        "mx-auto grid w-full max-w-fit grid-cols-2 justify-center gap-2 sm:grid-cols-4 xl:grid-cols-8",
        className,
      )}
    >
      <TrinketWalletResourcePill resource="gold" amount={gold} />
      {MATERIAL_IDS.map((mat) => (
        <TrinketWalletResourcePill key={mat} resource={mat} amount={materialInventory[mat] ?? 0} />
      ))}
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

function ResourcePill({
  resource,
  amount,
  showsIncreasePrefix = false,
  size = "md",
}: {
  resource: HomesteadResource;
  amount: number;
  showsIncreasePrefix?: boolean | undefined;
  size?: "md" | "lg" | undefined;
}) {
  return (
    <TrinketWalletResourcePill
      resource={resource}
      amount={amount}
      showsIncreasePrefix={showsIncreasePrefix}
      fillsAvailableWidth={false}
      size={size}
      className={
        size === "lg" ? "min-w-[calc(160px*var(--content-scale,1))]" : "min-w-[calc(136px*var(--content-scale,1))]"
      }
    />
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
  return <ResourcePill resource={material} amount={amount} showsIncreasePrefix={showsIncreasePrefix} size={size} />;
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
  return <ResourcePill resource="gold" amount={amount} showsIncreasePrefix={showsIncreasePrefix} size={size} />;
}

export function MaterialInlineChip({
  material,
  label,
  className,
}: {
  material: MaterialId;
  label: string;
  className?: string | undefined;
}) {
  return (
    <span
      className={cn(
        "mx-1 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 align-middle shadow-xs",
        "text-xs leading-none font-semibold",
        matPillStyle[material],
        matTextColor[material],
        className,
      )}
    >
      <HomesteadResourceArtwork resource={material} size="xs" />
      <span className="leading-none">{label}</span>
    </span>
  );
}
