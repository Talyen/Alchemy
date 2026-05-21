// Collection widgets for cards, bestiary, trinkets, discovery state, pagination, and previews.
// Depends on game-data libraries, collection config, audio samples, tilt, and shared UI.
// Used by CollectionScreen to render encyclopedia-style grids without owning screen routing.
/* eslint-disable react-refresh/only-export-components */
import { useState, type CSSProperties } from "react";

import {
  cardBack,
  cardLibrary,
  enemyBestiary,
  trinketLibrary,
  type BestiaryEntry,
  type TrinketEntry,
} from "@/lib/game-data";
import { cn } from "@/lib/utils";

import { PaginationControls } from "./shared-ui";
import { CardFlip } from "./card-flip";
import {
  cardSurfaceClass,
  collectionTabMeta,
  collectionTileWidthClass,
  staticCardTransform,
  trinketCardWidthClass,
} from "../config";
import type { CollectionTab } from "../types";
import { clearTiltFromEvent, getHoverId, setTiltFromEvent } from "../utils";
import { DetailPopup } from "./card-ui";
import { EnemyTooltip } from "./enemy-tooltip";
import { ShimmerOverlay } from "./shared-ui";
import { PressableMotion } from "./pressable-motion";
import { getEffectiveCardDescriptionLines } from "../utils/card-description";
import { COLLECTION_PAGE_SIZE } from "@/lib/game-constants";
import { playCardSound, playEnemyAttack } from "@/lib/audio";

const collectionPageSize = COLLECTION_PAGE_SIZE;

type CollectionTileItem = {
  id: string;
  title: string;
  subtitle: string | undefined;
  descriptionLines: string[];
  art: string;
  discovered: boolean;
  hoverScope: string;
  frameType: "card" | "bestiary" | "trinket";
};

export function getCollectionTotalPages(collectionTab: CollectionTab) {
  const itemCount =
    collectionTab === "cards"
      ? cardLibrary.length
      : collectionTab === "bestiary"
        ? enemyBestiary.length
        : trinketLibrary.length;

  return Math.max(1, Math.ceil(itemCount / collectionPageSize));
}

function CompendiumTile({
  item,
  hovered,
  onHoverStart,
  onHoverEnd,
  shimmerActive,
  shimmerToken,
  wrapperStyle,
}: {
  item: CollectionTileItem;
  hovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  shimmerActive: boolean;
  shimmerToken: number | undefined;
  wrapperStyle?: CSSProperties;
}) {
  const enemyEntry = item.frameType === "bestiary" ? enemyBestiary.find((e) => e.id === item.id) : undefined;
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="stagger-item relative" style={wrapperStyle} onMouseEnter={onHoverStart} onMouseLeave={onHoverEnd}>
      {hovered && item.frameType === "bestiary" && enemyEntry ? (
        <EnemyTooltip entry={enemyEntry} discovered={item.discovered} />
      ) : hovered ? (
        <DetailPopup
          idPrefix={item.id}
          title={item.title}
          subtitle={item.subtitle}
          descriptionLines={item.descriptionLines}
        />
      ) : null}

      <button
        type="button"
        aria-label={item.discovered ? `Inspect ${item.title}` : "Inspect Undiscovered Entry"}
        onFocus={onHoverStart}
        onBlur={onHoverEnd}
        onMouseMove={setTiltFromEvent}
        onMouseLeave={clearTiltFromEvent}
        onClick={() => {
          if (item.hoverScope === "collection-card") {
            playCardSound(item.id);
            setFlipped((f) => !f);
          } else if (item.hoverScope === "collection-bestiary") {
            playEnemyAttack(item.id);
          }
        }}
        className={cn(
          "tilt-surface group w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          cardSurfaceClass,
          item.frameType === "trinket" ? trinketCardWidthClass : collectionTileWidthClass,
          item.frameType === "card" && "bg-transparent",
        )}
        style={{ "--card-base-transform": staticCardTransform } as CSSProperties}
      >
        <ShimmerOverlay active={shimmerActive} token={shimmerToken} />
        {item.frameType === "card" ? (
          <CardFlip
            flipped={flipped}
            className="w-full aspect-[3/4]"
            front={
              <img
                src={item.art}
                alt={item.title}
                className={cn(
                  "block h-full w-full rounded-[30px] object-cover transition duration-300",
                  item.discovered ? "opacity-100" : "grayscale opacity-45",
                )}
                loading="eager"
              />
            }
            back={
              <img
                src={cardBack}
                alt=""
                aria-hidden="true"
                className="block h-full w-full rounded-[30px] object-cover"
              />
            }
          />
        ) : (
          <img
            src={item.art}
            alt={item.title}
            className={cn(
              "block w-full rounded-[30px] transition duration-300",
              item.frameType === "trinket" ? "aspect-square" : "aspect-[3/4]",
              "object-cover",
              item.discovered ? "opacity-100" : "grayscale opacity-45",
            )}
            loading="eager"
          />
        )}
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
  bondedCompanions,
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
  bondedCompanions: Record<string, number>;
}) {
  const pageItems = getCollectionPageItems({
    collectionTab,
    discoveredCardIds,
    encounteredEnemyIds,
    discoveredTrinketIds,
    bondedCompanions,
  }).slice(page * collectionPageSize, (page + 1) * collectionPageSize);

  return (
    <div
      key={`${collectionTab}-${page}`}
      className="state-swap grid min-h-[50cqh] grid-cols-4 grid-rows-2 justify-items-center gap-x-6 gap-y-7 overflow-visible"
    >
      {pageItems.map((item, index) => {
        const hoverId = getHoverId(item.hoverScope, item.id);

        return (
          <CompendiumTile
            key={`${item.hoverScope}-${item.id}`}
            item={item}
            hovered={hoveredCardId === hoverId}
            onHoverStart={() => {
              onHoverChange(hoverId);
              onHoverShimmer(hoverId);
            }}
            onHoverEnd={() => onHoverChange((current) => (current === hoverId ? null : current))}
            shimmerActive={shimmerState?.cardId === hoverId}
            shimmerToken={shimmerState?.token}
            wrapperStyle={{ "--stagger-index": index } as CSSProperties}
          />
        );
      })}
      {Array.from({ length: Math.max(0, collectionPageSize - pageItems.length) }).map((_, index) => (
        <div
          key={`collection-filler-${index}`}
          className={collectionTab === "trinkets" ? trinketCardWidthClass : collectionTileWidthClass}
          aria-hidden="true"
        />
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
          <PressableMotion key={tab.id}>
            <button
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={cn(
                "inline-flex min-h-[4.07cqh] items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-semibold text-foreground ring-1 ring-offset-1 ring-offset-card transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                collectionTab === tab.id ? "ring-primary/70" : "ring-border/30 hover:ring-border/50",
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          </PressableMotion>
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
    <PaginationControls page={page} totalPages={totalPages} onPageChange={onPageChange} size="default" reserveSpace />
  );
}

function getCardItems(discoveredCardIds: string[], bondedCompanions: Record<string, number> = {}) {
  return [...cardLibrary]
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((card) => {
      const discovered = discoveredCardIds.includes(card.id);
      const descriptionLines = discovered
        ? getEffectiveCardDescriptionLines(card, { companionBondLevels: bondedCompanions })
        : ["Discover this card during a run to reveal it here."];
      return {
        id: card.id,
        title: discovered ? card.title : "Undiscovered",
        subtitle: undefined,
        descriptionLines,
        art: card.art,
        discovered,
        hoverScope: "collection-card" as const,
        frameType: "card" as const,
      };
    });
}

function getBestiaryItems(encounteredEnemyIds: string[]) {
  return [...enemyBestiary]
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((entry: BestiaryEntry) => {
      const discovered = encounteredEnemyIds.includes(entry.id);
      return {
        id: entry.id,
        title: discovered ? entry.title : "Undiscovered",
        subtitle: discovered ? entry.subtitle : undefined,
        descriptionLines: discovered ? entry.descriptionLines : ["Encounter this enemy to record its details."],
        art: entry.art,
        discovered,
        hoverScope: "collection-bestiary" as const,
        frameType: "bestiary" as const,
      };
    });
}

function getTrinketItems(discoveredTrinketIds: string[]) {
  return [...trinketLibrary]
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((entry: TrinketEntry) => {
      const discovered = discoveredTrinketIds.includes(entry.id);
      return {
        id: entry.id,
        title: discovered ? entry.title : "Undiscovered",
        subtitle: undefined,
        descriptionLines: discovered ? entry.descriptionLines : ["Find this trinket to reveal its effect."],
        art: entry.art,
        discovered,
        hoverScope: "collection-trinket" as const,
        frameType: "trinket" as const,
      };
    });
}

function getCollectionPageItems({
  collectionTab,
  discoveredCardIds,
  encounteredEnemyIds,
  discoveredTrinketIds,
  bondedCompanions = {},
}: {
  collectionTab: CollectionTab;
  discoveredCardIds: string[];
  encounteredEnemyIds: string[];
  discoveredTrinketIds: string[];
  bondedCompanions?: Record<string, number>;
}) {
  if (collectionTab === "cards") return getCardItems(discoveredCardIds, bondedCompanions);
  if (collectionTab === "bestiary") return getBestiaryItems(encounteredEnemyIds);
  return getTrinketItems(discoveredTrinketIds);
}
