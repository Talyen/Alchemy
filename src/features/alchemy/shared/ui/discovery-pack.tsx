// Closed card-back pack with open animation and in-place batched discovery reveals.
import { useEffect, useState, type CSSProperties } from "react";

import { Button } from "@/components/ui/button";

import { playBattleEvent, playUISound } from "@/lib/audio";
import { cardBack } from "@/lib/game-data";
import type { DiscoveryPackBatch } from "@/lib/discoveries";
import { cn } from "@/lib/utils";

import {
  cardSurfaceClass,
  collectionShellWidthClass,
  collectionTileWidthClass,
  discoveryPackBlockHeightClass,
  discoveryPackStageHeightClass,
  boonCardWidthClass,
} from "../config";
import { getDiscoveryCardTileItems, getDiscoveryBoonTileItems, type CollectionTileItem } from "./collection-items";
import { CompendiumTile } from "./collection-tile";
import { getCenteredGridSlots, getDiscoveryPackGridLayout, isSingleDiscoveryRow } from "./discovery-pack-grid";
import { TiltSurface } from "./tilt-surface";

const PACK_OPEN_MS = 620;
const REVEAL_STAGGER_MS = 70;
const ITEM_EXIT_MS = 200;
const EXIT_STAGGER_MS = 25;

type DiscoveryPackProps = {
  packs: DiscoveryPackBatch[];
  onContinue: () => void;
  onBatchChange?: (batch: { index: number; kind: DiscoveryPackBatch["kind"] }) => void;
};

function getItemsForBatch(batch: DiscoveryPackBatch): CollectionTileItem[] {
  return batch.kind === "cards" ? getDiscoveryCardTileItems(batch.ids) : getDiscoveryBoonTileItems(batch.ids);
}

function getBatchExitDuration(itemCount: number): number {
  if (itemCount <= 0) return ITEM_EXIT_MS;
  return ITEM_EXIT_MS + (itemCount - 1) * EXIT_STAGGER_MS;
}

export function DiscoveryPack({ packs, onContinue, onBatchChange }: DiscoveryPackProps) {
  const [packPhase, setPackPhase] = useState<"closed" | "opening" | "opened">("closed");
  const [batchIndex, setBatchIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(0);
  const [swapPhase, setSwapPhase] = useState<"idle" | "exiting" | "entering">("idle");
  const [revealToken, setRevealToken] = useState(0);

  const currentBatch = packs[batchIndex];
  const items = currentBatch ? getItemsForBatch(currentBatch) : [];
  const isBoonBatch = currentBatch?.kind === "boons";
  const slotWidthClass = isBoonBatch ? boonCardWidthClass : collectionTileWidthClass;
  const isLastBatch = batchIndex >= packs.length - 1;
  const allItemsVisible = visibleCount >= items.length && items.length > 0;
  const showContinueButton = packPhase === "opened" && swapPhase === "idle" && allItemsVisible;
  const showPack = packPhase === "closed" || packPhase === "opening";
  const { gridClass, columnCount } = getDiscoveryPackGridLayout(isBoonBatch);
  const rowSlots = showPack
    ? Array.from({ length: columnCount }, () => null)
    : getCenteredGridSlots(items, columnCount);

  useEffect(() => {
    if (!currentBatch) return;
    onBatchChange?.({ index: batchIndex, kind: currentBatch.kind });
  }, [batchIndex, currentBatch, onBatchChange]);

  useEffect(() => {
    if (packPhase !== "opening") return;
    const timer = window.setTimeout(() => {
      setPackPhase("opened");
      setRevealToken((token) => token + 1);
    }, PACK_OPEN_MS);
    return () => window.clearTimeout(timer);
  }, [packPhase]);

  useEffect(() => {
    if (packPhase !== "opened" || revealToken === 0 || items.length === 0) return;

    const timers: number[] = [];
    for (let index = 0; index < items.length; index += 1) {
      timers.push(
        window.setTimeout(() => {
          setVisibleCount(index + 1);
          playBattleEvent("drawTransfer");
          if (index === items.length - 1) {
            setSwapPhase("idle");
          }
        }, index * REVEAL_STAGGER_MS),
      );
    }
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [revealToken, packPhase, items.length]);

  useEffect(() => {
    if (swapPhase !== "exiting") return;
    const timer = window.setTimeout(() => {
      setBatchIndex((index) => index + 1);
      setVisibleCount(0);
      setSwapPhase("entering");
      setRevealToken((token) => token + 1);
    }, getBatchExitDuration(items.length));
    return () => window.clearTimeout(timer);
  }, [swapPhase, items.length]);

  function handleOpenPack() {
    if (packPhase !== "closed") return;
    playUISound("packOpen");
    setPackPhase("opening");
  }

  function handleContinue() {
    if (!showContinueButton) return;
    if (isLastBatch) {
      onContinue();
      return;
    }
    setSwapPhase("exiting");
  }

  return (
    <div className={cn("flex w-full flex-col items-center justify-between gap-3", discoveryPackBlockHeightClass)}>
      <div
        className={cn(
          "discovery-pack-stage relative flex w-full shrink-0 items-center justify-center",
          collectionShellWidthClass,
          discoveryPackStageHeightClass,
        )}
      >
        <div className={cn("discovery-pack-row", gridClass)}>
          {!showPack && isSingleDiscoveryRow(items) ? (
            <div
              className={cn(
                slotWidthClass,
                "discovery-pack-reveal-item col-span-full justify-self-center",
                visibleCount > 0 && swapPhase !== "exiting" && "discovery-pack-reveal-item-visible",
                swapPhase === "exiting" && visibleCount > 0 && "discovery-pack-item-exit",
              )}
              style={{ "--stagger-index": 0 } as CSSProperties}
            >
              <CompendiumTile item={items[0]} />
            </div>
          ) : (
            rowSlots.map((item, col) => {
              if (!item) {
                return (
                  <div
                    key={`${batchIndex}-filler-${col}`}
                    className={cn(slotWidthClass, showPack && "invisible")}
                    aria-hidden="true"
                  >
                    <div className="aspect-[3/4] w-full" />
                  </div>
                );
              }

              const itemIndex = items.indexOf(item);
              return (
                <div
                  key={`${batchIndex}-${item.id}`}
                  className={cn(
                    slotWidthClass,
                    "discovery-pack-reveal-item justify-self-center",
                    itemIndex < visibleCount && swapPhase !== "exiting" && "discovery-pack-reveal-item-visible",
                    swapPhase === "exiting" && itemIndex < visibleCount && "discovery-pack-item-exit",
                  )}
                  style={{ "--stagger-index": itemIndex } as CSSProperties}
                >
                  <CompendiumTile item={item} />
                </div>
              );
            })
          )}
        </div>

        {showPack ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <TiltSurface
              as="button"
              ariaLabel="Open discovery pack"
              className={cn(
                "discovery-pack-closed block",
                cardSurfaceClass,
                collectionTileWidthClass,
                packPhase === "opening" && "discovery-pack-opening pointer-events-none",
              )}
              onClick={handleOpenPack}
            >
              <img src={cardBack} alt="" aria-hidden="true" className="block aspect-[3/4] w-full" />
            </TiltSurface>
          </div>
        ) : null}
      </div>

      <p className="min-h-5 shrink-0 text-sm text-muted-foreground">
        {packPhase === "closed" ? "Click to open" : "\u00a0"}
      </p>

      <div className="flex min-h-11 shrink-0 items-center justify-center">
        <Button
          size="lg"
          className={cn("min-w-44", !showContinueButton && "pointer-events-none invisible")}
          disabled={!showContinueButton}
          onClick={handleContinue}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
