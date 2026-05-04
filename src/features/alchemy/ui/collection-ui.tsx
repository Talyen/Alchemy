import type { CSSProperties } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  cardLibrary,
  enemyBestiary,
  trinketLibrary,
  type BestiaryEntry,
  type TrinketEntry,
} from "@/lib/game-data";
import { cn } from "@/lib/utils";

import { cardSurfaceClass, collectionCardWidthClass, collectionTabMeta, staticCardTransform } from "../config";
import type { CollectionTab } from "../types";
import { clearTiltFromEvent, getHoverId, setTiltFromEvent } from "../utils";
import { DetailPopup } from "./card-ui";

export const collectionPageSize = 10;

type CollectionTileItem = {
  id: string;
  title: string;
  subtitle?: string;
  descriptionLines: string[];
  art: string;
  discovered: boolean;
  hoverScope: string;
};

export function getCollectionTotalPages(collectionTab: CollectionTab) {
  const itemCount =
    collectionTab === "cards" ? cardLibrary.length : collectionTab === "bestiary" ? enemyBestiary.length : trinketLibrary.length;

  return Math.max(1, Math.ceil(itemCount / collectionPageSize));
}

function CompendiumTile({
  item,
  hovered,
  onHoverStart,
  onHoverEnd,
  shimmerActive,
  shimmerToken,
}: {
  item: CollectionTileItem;
  hovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  shimmerActive: boolean;
  shimmerToken?: number;
}) {
  return (
    <div className="relative" onMouseEnter={onHoverStart} onMouseLeave={onHoverEnd}>
      {hovered ? <DetailPopup idPrefix={item.id} title={item.title} subtitle={item.subtitle} descriptionLines={item.descriptionLines} /> : null}

      <button
        type="button"
        aria-label={item.discovered ? `Inspect ${item.title}` : "Inspect Undiscovered Entry"}
        onFocus={onHoverStart}
        onBlur={onHoverEnd}
        onMouseMove={setTiltFromEvent}
        onMouseLeave={clearTiltFromEvent}
        data-tilt-strength="11"
        className={cn(
          "tilt-surface group w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          cardSurfaceClass,
          collectionCardWidthClass,
        )}
        style={{ "--card-base-transform": staticCardTransform } as CSSProperties}
      >
        <div className={cn("pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[30px]", shimmerActive ? "card-shimmer-active" : "")}>
          <div key={shimmerActive ? shimmerToken : undefined} className={cn("card-shimmer-sweep", shimmerActive ? "opacity-100" : "opacity-0")} />
        </div>
        <img
          src={item.art}
          alt={item.title}
          className={cn("block h-auto w-full rounded-[30px] transition duration-300", item.discovered ? "opacity-100" : "grayscale opacity-45")}
          loading="lazy"
        />
      </button>
    </div>
  );
}

export function CollectionGrid({
  collectionTab,
  hoveredCardId,
  discoveredCardIds,
  encounteredEnemyIds,
  discoveredTrinketIds,
  onHoverChange,
  page,
  shimmerState,
  onHoverShimmer,
}: {
  collectionTab: CollectionTab;
  hoveredCardId: string | null;
  discoveredCardIds: string[];
  encounteredEnemyIds: string[];
  discoveredTrinketIds: string[];
  onHoverChange: (nextHoverId: string | null | ((current: string | null) => string | null)) => void;
  page: number;
  shimmerState: { cardId: string; token: number } | null;
  onHoverShimmer: (cardId: string) => void;
}) {
  const pageItems = getCollectionPageItems({
    collectionTab,
    discoveredCardIds,
    encounteredEnemyIds,
    discoveredTrinketIds,
  }).slice(page * collectionPageSize, (page + 1) * collectionPageSize);

  return (
    <div className="grid min-h-[540px] grid-cols-5 grid-rows-2 justify-items-center gap-x-6 gap-y-7 overflow-visible">
      {pageItems.map((item) => {
        const hoverId = getHoverId(item.hoverScope, item.id);

        return (
          <CompendiumTile
            key={`${item.hoverScope}-${item.id}`}
            item={item}
            hovered={hoveredCardId === hoverId}
            onHoverStart={() => { onHoverChange(hoverId); onHoverShimmer(hoverId); }}
            onHoverEnd={() => onHoverChange((current) => (current === hoverId ? null : current))}
            shimmerActive={shimmerState?.cardId === hoverId}
            shimmerToken={shimmerState?.token}
          />
        );
      })}
      {Array.from({ length: Math.max(0, collectionPageSize - pageItems.length) }).map((_, index) => (
        <div key={`collection-filler-${index}`} className="w-[clamp(156px,15vw,210px)]" aria-hidden="true" />
      ))}
    </div>
  );
}

export function CollectionTabs({
  collectionTab,
  onSelectTab,
}: {
  collectionTab: CollectionTab;
  onSelectTab: (tab: CollectionTab) => void;
}) {
  return (
    <div className="mt-6 flex flex-wrap justify-center gap-3">
      {collectionTabMeta.map((tab) => {
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectTab(tab.id)}
            className={cn(
              "inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              collectionTab === tab.id
                ? "border-primary/70 bg-primary/15 text-primary"
                : "border-border/80 bg-card text-foreground hover:bg-secondary/50",
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function CollectionPagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className={cn("mt-10 flex min-h-[44px] items-center justify-center gap-4", totalPages <= 1 ? "invisible" : "visible")}>
      <Button variant="outline" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
        <ChevronLeft className="h-4 w-4" />
        Previous
      </Button>
      <p className="min-w-24 text-center text-sm font-medium text-muted-foreground">
        Page {page + 1} / {totalPages}
      </p>
      <Button variant="outline" disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)}>
        Next
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function getCollectionPageItems({
  collectionTab,
  discoveredCardIds,
  encounteredEnemyIds,
  discoveredTrinketIds,
}: {
  collectionTab: CollectionTab;
  discoveredCardIds: string[];
  encounteredEnemyIds: string[];
  discoveredTrinketIds: string[];
}) {
  if (collectionTab === "cards") {
    return cardLibrary.map((card) => {
      const discovered = discoveredCardIds.includes(card.id);

      return {
        id: card.id,
        title: discovered ? card.title : "Undiscovered",
        descriptionLines: discovered ? card.descriptionLines : ["Discover this card during a run to reveal it here."],
        art: card.art,
        discovered,
        hoverScope: "collection-card",
      };
    });
  }

  if (collectionTab === "bestiary") {
    return enemyBestiary.map((entry: BestiaryEntry) => {
      const discovered = encounteredEnemyIds.includes(entry.id);

      return {
        id: entry.id,
        title: discovered ? entry.title : "Undiscovered",
        subtitle: discovered ? entry.subtitle : undefined,
        descriptionLines: discovered ? entry.descriptionLines : ["Encounter this enemy to record its details."],
        art: entry.art,
        discovered,
        hoverScope: "collection-bestiary",
      };
    });
  }

  return trinketLibrary.map((entry: TrinketEntry) => {
    const discovered = discoveredTrinketIds.includes(entry.id);

    return {
      id: entry.id,
      title: discovered ? entry.title : "Undiscovered",
      subtitle: discovered ? "Relic" : undefined,
      descriptionLines: discovered ? entry.descriptionLines : ["Find this relic to reveal its effect."],
      art: entry.art,
      discovered,
      hoverScope: "collection-trinket",
    };
  });
}
