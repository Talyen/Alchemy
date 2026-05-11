import type { CSSProperties, MouseEvent, MutableRefObject } from "react";
import { useState } from "react";
import { Coins, Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { type BattleCard } from "@/lib/game-data";
import type { BattleState } from "@/lib/battle/types";


import {
  handCardWidthClass,
  mobileStageBattleCardWidthClass,
  mobileStageHandCardWidthClass,
} from "../config";
import { ArtPanel, BattleCardButton, CardGhostOverlay, CompanionPanel, CombatTextRail, ManaPanel, PilePanel } from "../components";
import type { CardGhost, CombatTextAnimationVariant, FloatingCombatText, StatusChip } from "../types";
import { getHoverId } from "../utils";

export function BattleScreen({
  battleState,
  hoveredCardId,
  setHoveredCardId,
  shimmerState,
  onHoverShimmer,
  playerStatusChips,
  enemyStatusChips,
  playerCombatTexts,
  enemyCombatTexts,
  combatTextAnimationVariant,
  handCardRefs,
  onCardClick,
  onOpenMenu,
  onWishChoice,
  cardGhosts,
  onRemoveCardGhost,
  onSkipCombatDevMode,
  onEndTurn,
  battleSceneRef,
  playerPanelRef,
  enemyPanelRef,
  playerShaking,
  enemyShaking,
  companionShaking,
  heroArt,
  isMobileLandscape = false,
}: {
  battleState: Pick<BattleState, 'playerHealth' | 'playerMaxHealth' | 'enemyHealth' | 'enemyMaxHealth' | 'mana' | 'maxMana' | 'gold' | 'deck' | 'discard' | 'hand' | 'wishOptions' | 'activeCompanion' | 'currentEnemy' | 'turnPhase'>;
  heroArt: string;
  hoveredCardId: string | null;
  setHoveredCardId: (value: string | null | ((current: string | null) => string | null)) => void;
  shimmerState: { cardId: string; token: number } | null;
  onHoverShimmer: (cardId: string) => void;
  playerStatusChips: StatusChip[];
  enemyStatusChips: StatusChip[];
  playerCombatTexts: FloatingCombatText[];
  enemyCombatTexts: FloatingCombatText[];
  combatTextAnimationVariant: CombatTextAnimationVariant;
  handCardRefs: MutableRefObject<Record<string, HTMLButtonElement | null>>;
  onCardClick: (card: BattleCard, index: number, event: MouseEvent<HTMLButtonElement>) => void;
  onOpenMenu: (rect?: DOMRect) => void;
  onWishChoice: (card: BattleCard) => void;
  cardGhosts: CardGhost[];
  onRemoveCardGhost: (id: string) => void;
  onSkipCombatDevMode: () => void;
  onEndTurn: () => void;
  battleSceneRef: MutableRefObject<HTMLDivElement | null>;
  playerPanelRef: MutableRefObject<HTMLDivElement | null>;
  enemyPanelRef: MutableRefObject<HTMLDivElement | null>;
  playerShaking: boolean;
  enemyShaking: boolean;
  companionShaking: boolean;
  isMobileLandscape?: boolean;
}) {
  const isPlayerTurn = battleState.turnPhase === "player";
  const hasCompanion = Boolean(battleState.activeCompanion);
  const battleActorHalfGap = isMobileLandscape ? 'clamp(130px,8cqw,180px)' : 'clamp(168px,10cqw,210px)';
  const actorCardWidthClass = isMobileLandscape ? mobileStageBattleCardWidthClass : undefined;
  const handWidthClass = isMobileLandscape ? mobileStageHandCardWidthClass : handCardWidthClass;
  const playerTurnBadgeTransform = hasCompanion
    ? `translateX(calc(-50% - clamp(111px,11cqh,168px) - ${battleActorHalfGap} - clamp(12px,1.2cqw,22px)))`
    : `translateX(calc(-50% - clamp(111px,11cqh,168px) - ${battleActorHalfGap}))`;
  const [wishSelectedCard, setWishSelectedCard] = useState<BattleCard | null>(null);

  return (
    <div ref={battleSceneRef} data-testid="battle-scene" className="relative h-full w-full overflow-hidden [container-type:size]">
      <section
        className={`absolute inset-x-0 flex -translate-y-1/2 items-start justify-center px-4 ${isMobileLandscape ? "gap-[clamp(260px,16cqw,360px)]" : "gap-[clamp(336px,20cqw,420px)]"}`}
        style={{ top: isMobileLandscape ? '36%' : '42%' }}
      >
        <div
          className={`pointer-events-none absolute -top-10 left-1/2 z-20 whitespace-nowrap rounded-md px-3 py-1 text-sm transition-all duration-500 ${
            isPlayerTurn ? 'bg-emerald-900/80 text-emerald-300' : 'bg-rose-900/80 text-rose-300'
          }`}
          style={{
            transform: isPlayerTurn
              ? playerTurnBadgeTransform
              : `translateX(calc(-50% + clamp(111px,11cqh,168px) + ${battleActorHalfGap}))`,
          }}
        >
          {isPlayerTurn ? 'Your Turn' : 'Enemy Turn'}
        </div>
        <div className="relative flex items-start justify-center transition-transform duration-500 ease-out">
          <div className="absolute left-[calc(100%+clamp(28px,3cqw,44px))] top-[30%] z-30 w-40">
            <CombatTextRail entries={playerCombatTexts} side="player" variant={combatTextAnimationVariant} />
          </div>
          <div className={hasCompanion ? "relative transition-transform duration-500 ease-out -translate-x-[clamp(12px,1.2vw,22px)]" : "relative transition-transform duration-500 ease-out"}>
            <ArtPanel
              side="player"
              title="Knight"
              art={heroArt}
              health={battleState.playerHealth}
              maxHealth={battleState.playerMaxHealth}
              statuses={playerStatusChips}
              shimmerId="player-card"
              shimmerActive={shimmerState?.cardId === "player-card"}
              shimmerToken={shimmerState?.token}
              onHoverShimmer={onHoverShimmer}
              combatTexts={playerCombatTexts}
              surfaceRef={(node) => {
                playerPanelRef.current = node;
              }}
              shaking={playerShaking}
              cardWidthClass={actorCardWidthClass}
            />
            {battleState.activeCompanion ? (
              <div className="absolute bottom-[clamp(88px,8.5cqh,118px)] left-[calc(100%-clamp(42px,4.6cqh,68px))] z-20">
                <CompanionPanel companion={battleState.activeCompanion} shaking={companionShaking} />
              </div>
            ) : null}
          </div>
        </div>

        <div className="relative flex flex-col items-center">
          <div className="absolute right-[calc(100%+clamp(28px,3cqw,44px))] top-[30%] z-30 w-40">
            <CombatTextRail entries={enemyCombatTexts} side="enemy" variant={combatTextAnimationVariant} />
          </div>
          <ArtPanel
            side="enemy"
            title={battleState.currentEnemy.title}
            art={battleState.currentEnemy.art}
            health={battleState.enemyHealth}
            maxHealth={battleState.enemyMaxHealth}
            statuses={enemyStatusChips}
            shimmerId="enemy-card"
            shimmerActive={shimmerState?.cardId === "enemy-card"}
            shimmerToken={shimmerState?.token}
            onHoverShimmer={onHoverShimmer}
            combatTexts={enemyCombatTexts}
            surfaceRef={(node) => {
              enemyPanelRef.current = node;
            }}
            isDead={battleState.enemyHealth <= 0}
            shaking={enemyShaking}
            descriptionLines={battleState.currentEnemy.descriptionLines}
            cardWidthClass={actorCardWidthClass}
          />
        </div>
      </section>

      <section
        className={`absolute inset-x-0 grid items-end gap-[clamp(16px,2vw,28px)] px-2 ${isMobileLandscape ? "bottom-[calc(70px+env(safe-area-inset-bottom))] grid-cols-[minmax(170px,0.18fr)_1fr_minmax(220px,0.18fr)] pb-0" : "bottom-2 grid-cols-[minmax(110px,0.24fr)_1fr_minmax(110px,0.24fr)] pb-1"}`}
      >
        <div className={`flex flex-col items-center justify-end ${isMobileLandscape ? "gap-3 pb-8" : "gap-4 pb-4"}`}>
          <ManaPanel mana={battleState.mana} maxMana={battleState.maxMana} gold={battleState.gold} />
          <PilePanel label={isMobileLandscape ? "Deck" : "Draw Pile"} count={battleState.deck.length} type="draw" compact={isMobileLandscape} />
        </div>

        <div className={`flex min-w-0 items-end justify-center ${isMobileLandscape ? "min-h-[320px] pb-0 pt-12" : "min-h-[334px] pb-3 pt-10"}`} aria-label="Player hand">
          {battleState.hand.map((card, index) => {
            const hoverId = getHoverId("hand", `${card.id}-${card.uid}`);
            const isHovered = hoveredCardId === hoverId;
            const offset = index - (battleState.hand.length - 1) / 2;
            const restingTransform = `translateY(${Math.abs(offset) * 10}px) rotate(${offset * 4.2}deg)`;
            const hoverTransform = `translateY(-34px) rotate(${offset * 2.6}deg) scale(1.03)`;
            const isShimmering = shimmerState?.cardId === hoverId;
            const canPlay = battleState.turnPhase === "player" && battleState.mana >= card.cost && !battleState.wishOptions;

            return (
              <BattleCardButton
                key={`${card.id}-${card.uid}`}
                card={card}
                hovered={isHovered}
                onHoverStart={() => {
                  setHoveredCardId(hoverId);
                  onHoverShimmer(hoverId);
                }}
                onHoverEnd={() => setHoveredCardId((current) => (current === hoverId ? null : current))}
                onClick={(event) => onCardClick(card, index, event)}
                buttonRef={(node) => {
                  handCardRefs.current[`${card.id}-${card.uid}`] = node;
                }}
                ariaLabel={`Play ${card.title}`}
                tiltStrength={18}
                shimmerActive={isShimmering}
                shimmerToken={shimmerState?.token}
                baseTransform={isHovered ? hoverTransform : restingTransform}
                className={handWidthClass}
                disabled={!canPlay}
                wrapperClassName={`stagger-item relative flex justify-center ${isMobileLandscape ? "-mx-7" : "-mx-5 sm:-mx-6"}`}
                wrapperStyle={{ zIndex: isHovered ? 40 : 10 + index, "--stagger-index": index } as CSSProperties}
              />
            );
          })}
        </div>

        <div className={`flex flex-col items-center justify-end ${isMobileLandscape ? "gap-3 pb-8" : "gap-4 pb-4"}`}>
          <div className="relative flex flex-col items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className={isMobileLandscape ? "h-20 w-20 text-muted-foreground hover:text-foreground" : "h-8 w-8 text-muted-foreground hover:text-foreground"}
              onClick={(e) => onOpenMenu(e.currentTarget.getBoundingClientRect())}
              aria-label="Open battle menu"
            >
              <Menu className={isMobileLandscape ? "h-11 w-11" : "h-4 w-4"} />
            </Button>

            <Button
              variant="default"
              size="sm"
              className={isMobileLandscape ? "h-20 bg-amber-600 px-10 text-2xl font-bold text-white hover:bg-amber-700" : "bg-amber-600 hover:bg-amber-700 text-white font-bold"}
              onClick={onEndTurn}
              disabled={battleState.turnPhase !== "player"}
            >
              End Turn
            </Button>

            {import.meta.env.DEV ? (
              <Button
                variant="ghost"
                size="sm"
                className={isMobileLandscape ? "h-20 w-20 text-amber-200 hover:text-amber-100 text-2xl" : "w-full text-amber-200 hover:text-amber-100 text-xs"}
                onClick={onSkipCombatDevMode}
              >
                <Coins className={isMobileLandscape ? "h-11 w-11" : "h-3.5 w-3.5"} /> {isMobileLandscape ? "" : "Skip Combat"}
              </Button>
            ) : null}
          </div>

          <PilePanel label={isMobileLandscape ? "Discard" : "Discard Pile"} count={battleState.discard.length} type="discard" compact={isMobileLandscape} />
        </div>
      </section>

      {battleState.wishOptions ? (
        <div className="motion-overlay absolute inset-0 z-[90] flex items-center justify-center bg-black/70 px-6">
          <div className="motion-panel alchemy-shell w-full max-w-5xl rounded-[28px] border border-border/80 px-6 py-6">
            <div className="text-center">
              <h2 className="text-2xl text-foreground">Wish 1</h2>
              <p className="mt-2 text-sm text-muted-foreground">Choose one card to add to your hand.</p>
            </div>

            <div className="mt-6 flex flex-wrap items-start justify-center gap-5">
              {battleState.wishOptions.map((card, index) => {
                const hoverId = getHoverId("wish", card.id);
                const isSelected = wishSelectedCard?.id === card.id;

                return (
                  <BattleCardButton
                    key={card.id}
                    card={card}
                    hovered={hoveredCardId === hoverId}
                    onHoverStart={() => {
                      setHoveredCardId(hoverId);
                      onHoverShimmer(hoverId);
                    }}
                    onHoverEnd={() => setHoveredCardId((current) => (current === hoverId ? null : current))}
                    onClick={() => setWishSelectedCard(card)}
                    ariaLabel={`Choose ${card.title}`}
                    tiltStrength={15}
                    shimmerActive={shimmerState?.cardId === hoverId}
                    shimmerToken={shimmerState?.token}
                    className={handWidthClass}
                    wrapperClassName="stagger-item relative flex justify-center"
                    wrapperStyle={{ "--stagger-index": index } as CSSProperties}
                    selected={isSelected}
                  />
                );
              })}
            </div>

            <div className="mt-6 flex justify-center gap-3">
              <Button size="lg" disabled={!wishSelectedCard} onClick={() => { onWishChoice(wishSelectedCard!); setWishSelectedCard(null); }}>
                Confirm
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {cardGhosts.map((ghost) => (
        <CardGhostOverlay key={ghost.id} ghost={ghost} onDone={() => onRemoveCardGhost(ghost.id)} />
      ))}
    </div>
  );
}
