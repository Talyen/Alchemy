import type { MutableRefObject } from "react";
import { Coins, House, Swords } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { BattleCard } from "@/lib/game-data";

import { resolutionOptions } from "../config";
import { BattleCardButton, CollectionGrid, CollectionPagination, CollectionTabs, DestinationChoices, PlaceholderScreen, ResolutionSelect } from "../components";
import { getCollectionTotalPages } from "../ui/collection-ui";
import { ConfirmationDialog } from "../ui/shared-ui";
import type { CollectionTab, Destination, ResolutionOption } from "../types";
import { getHoverId } from "../utils";

export function MenuScreen({ onPlay, onCollection, onOptions, onTalents, logoSrc }: { onPlay: () => void; onCollection: () => void; onOptions: () => void; onTalents: () => void; logoSrc: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 text-center">
      <img src={logoSrc} alt="Alchemy logo" className="w-full max-w-[720px] object-contain" loading="eager" />

      <div className="grid gap-3">
        <Button size="lg" className="w-56 justify-center text-base" onClick={onPlay}>
          Play
        </Button>
        <Button size="lg" variant="outline" className="w-56 justify-center text-base" onClick={onCollection}>
          Collection
        </Button>
        <Button size="lg" variant="outline" className="w-56 justify-center text-base" onClick={onOptions}>
          Options
        </Button>
        <Button size="lg" variant="outline" className="w-56 justify-center text-base" onClick={onTalents}>
          Talents
        </Button>
        <Button size="lg" variant="outline" className="w-56 justify-center text-base" onClick={() => window.close()}>
          Quit
        </Button>
      </div>
    </div>
  );
}

export function RewardsScreen({
  rewardChoices,
  rewardGold,
  hoveredCardId,
  onHoverChange,
  shimmerState,
  onHoverShimmer,
  selectedRewardId,
  onSelectReward,
  onAddCard,
  onSkip,
}: {
  rewardChoices: BattleCard[];
  rewardGold: number;
  hoveredCardId: string | null;
  onHoverChange: (value: string | null | ((current: string | null) => string | null)) => void;
  shimmerState: { cardId: string; token: number } | null;
  onHoverShimmer: (cardId: string) => void;
  selectedRewardId: string | null;
  onSelectReward: (cardId: string) => void;
  onAddCard: () => void;
  onSkip: () => void;
}) {
  const selectedRewardCard = rewardChoices.find((card) => card.id === selectedRewardId) ?? null;

  return (
    <div className="flex h-full w-full items-center justify-center px-4 py-6">
      <div className="alchemy-shell w-full max-w-6xl rounded-[30px] border border-border/80 px-6 py-7 text-center sm:px-8">
        <h1 className="text-4xl font-semibold text-foreground">Victory!</h1>
        <p className="mt-3 text-base text-muted-foreground">Choose a Card to add to your Deck</p>

        <div className="mt-8 flex flex-wrap items-start justify-center gap-6">
          {rewardChoices.map((card) => {
            const hoverId = getHoverId("reward", card.id);

            return (
              <BattleCardButton
                key={card.id}
                card={card}
                hovered={hoveredCardId === hoverId}
                onHoverStart={() => {
                  onHoverChange(hoverId);
                  onHoverShimmer(hoverId);
                }}
                onHoverEnd={() => onHoverChange((current) => (current === hoverId ? null : current))}
                onClick={() => onSelectReward(card.id)}
                ariaLabel={`Select ${card.title}`}
                tiltStrength={15}
                shimmerActive={shimmerState?.cardId === hoverId}
                shimmerToken={shimmerState?.token}
                className="w-[clamp(189px,18.7vh,286px)]"
                wrapperClassName="relative flex justify-center"
                selected={selectedRewardId === card.id}
              />
            );
          })}
        </div>

        <div className="mt-8 text-center text-lg font-medium text-yellow-300">
          <span className="inline-flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Found {rewardGold} Gold
          </span>
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button size="lg" className="min-w-40" disabled={!selectedRewardCard} onClick={onAddCard}>
            Add Card
          </Button>
          <Button size="lg" variant="outline" className="min-w-40" onClick={onSkip}>
            Skip
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DestinationScreen({
  destinationOptions,
  hoveredDestination,
  onHoverChange,
  onChoose,
  destinationGuidePath,
  destinationMapRef,
  destinationHeaderRef,
  destinationButtonRefs,
}: {
  destinationOptions: Destination[];
  hoveredDestination: Destination | null;
  onHoverChange: (destination: Destination | null) => void;
  onChoose: () => void;
  destinationGuidePath: string | null;
  destinationMapRef: MutableRefObject<HTMLDivElement | null>;
  destinationHeaderRef: MutableRefObject<HTMLHeadingElement | null>;
  destinationButtonRefs: MutableRefObject<Partial<Record<Destination, HTMLButtonElement | null>>>;
}) {
  return (
    <div className="flex h-full w-full items-center justify-center px-4 py-6">
      <div ref={destinationMapRef} className="alchemy-shell relative w-full max-w-6xl rounded-[30px] border border-border/80 px-6 py-7 text-center sm:px-8">
        <h1 ref={destinationHeaderRef} className="text-4xl font-semibold text-foreground">
          Choose Destination
        </h1>

        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          {destinationGuidePath ? <path key={hoveredDestination} d={destinationGuidePath} pathLength={1} className="destination-guide-path" /> : null}
        </svg>

        <DestinationChoices
          destinationOptions={destinationOptions}
          hoveredDestination={hoveredDestination}
          onHoverChange={onHoverChange}
          onChoose={onChoose}
          buttonRefs={destinationButtonRefs}
        />
      </div>
    </div>
  );
}

export function OptionsScreen({
  hasActiveBattle,
  onMainMenu,
  onReturnToBattle,
  selectedResolution,
  onResolutionChange,
  showClearSaveConfirm,
  onOpenClearSaveConfirm,
  onCloseClearSaveConfirm,
  onConfirmClearSave,
}: {
  hasActiveBattle: boolean;
  onMainMenu: () => void;
  onReturnToBattle: () => void;
  selectedResolution: ResolutionOption;
  onResolutionChange: (resolution: ResolutionOption) => void;
  showClearSaveConfirm: boolean;
  onOpenClearSaveConfirm: () => void;
  onCloseClearSaveConfirm: () => void;
  onConfirmClearSave: () => void;
}) {
  return (
    <div className="relative h-full w-full">
      <PlaceholderScreen title="Options" onMainMenu={onMainMenu} onReturnToBattle={onReturnToBattle} showReturnToBattle={hasActiveBattle}>
        <div className="mx-auto flex w-full max-w-xl flex-col gap-6 text-left">
          <div className="flex justify-center gap-2">
            <button type="button" className="rounded-full border border-border/80 bg-card px-4 py-2 text-sm font-semibold text-foreground">
              Display
            </button>
          </div>

          <ResolutionSelect selectedResolution={selectedResolution} resolutionOptions={resolutionOptions} onChange={onResolutionChange} />

          <div className="surface-muted rounded-[22px] border border-border/70 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Save Data</p>
                <p className="mt-1 text-sm text-muted-foreground">Clear discovered collection progress and saved options.</p>
              </div>
              <Button variant="destructive" onClick={onOpenClearSaveConfirm}>
                Clear Save Data
              </Button>
            </div>
          </div>
        </div>
      </PlaceholderScreen>

      {showClearSaveConfirm ? (
        <ConfirmationDialog
          title="Clear Save Data?"
          description="This will reset your saved resolution setting and all discovered collection progress. This cannot be undone."
          confirmLabel="Clear Save Data"
          onConfirm={onConfirmClearSave}
          onCancel={onCloseClearSaveConfirm}
        />
      ) : null}
    </div>
  );
}

export function CollectionScreen({
  hasActiveBattle,
  onMainMenu,
  onReturnToBattle,
  collectionTab,
  onSelectTab,
  hoveredCardId,
  onHoverChange,
  discoveredCardIds,
  encounteredEnemyIds,
  discoveredTrinketIds,
  page,
  onPageChange,
}: {
  hasActiveBattle: boolean;
  onMainMenu: () => void;
  onReturnToBattle: () => void;
  collectionTab: CollectionTab;
  onSelectTab: (tab: CollectionTab) => void;
  hoveredCardId: string | null;
  onHoverChange: (value: string | null | ((current: string | null) => string | null)) => void;
  discoveredCardIds: string[];
  encounteredEnemyIds: string[];
  discoveredTrinketIds: string[];
  page: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = getCollectionTotalPages(collectionTab);

  return (
    <div className="flex h-full w-full items-center justify-center px-4 py-4">
      <div className="alchemy-shell flex h-full w-full max-w-[1620px] flex-col items-center justify-start overflow-visible rounded-[30px] border border-border/80 px-8 py-8 text-center">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button variant="outline" onClick={onMainMenu}>
            <House className="h-4 w-4" />
            Main Menu
          </Button>
          {hasActiveBattle ? (
            <Button onClick={onReturnToBattle}>
              <Swords className="h-4 w-4" />
              Return to Battle
            </Button>
          ) : null}
        </div>

        <h1 className="mt-8 min-h-[44px] text-4xl font-semibold text-foreground">Collection</h1>
        <CollectionTabs collectionTab={collectionTab} onSelectTab={onSelectTab} />

        <div className="mt-12 flex min-h-[640px] flex-col items-center overflow-visible">
          <CollectionGrid
            collectionTab={collectionTab}
            hoveredCardId={hoveredCardId}
            discoveredCardIds={discoveredCardIds}
            encounteredEnemyIds={encounteredEnemyIds}
            discoveredTrinketIds={discoveredTrinketIds}
            onHoverChange={onHoverChange}
            page={page}
          />
          <CollectionPagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
        </div>
      </div>
    </div>
  );
}

export function TalentsScreen({ hasActiveBattle, onMainMenu, onReturnToBattle }: { hasActiveBattle: boolean; onMainMenu: () => void; onReturnToBattle: () => void }) {
  return (
    <PlaceholderScreen title="Talents" onMainMenu={onMainMenu} onReturnToBattle={onReturnToBattle} showReturnToBattle={hasActiveBattle}>
      <div className="surface-muted mx-auto max-w-xl rounded-[22px] border border-border/70 p-5 text-base leading-7 text-muted-foreground">
        Placeholder screen for persistent upgrades and progression choices.
      </div>
    </PlaceholderScreen>
  );
}
