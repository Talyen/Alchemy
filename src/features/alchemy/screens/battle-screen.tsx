import type { CSSProperties, MouseEvent, MutableRefObject } from "react";
import { useState } from "react";
import { BookOpen, Cog, Coins, House, Menu, Swords, WandSparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { type BattleCard } from "@/lib/game-data";
import type { BattleState } from "@/lib/battle/types";


import { handCardWidthClass, mobileBattleCardWidthClass, mobileHandCardWidthClass } from "../config";
import { ArtPanel, BattleCardButton, CardGhostOverlay, CompanionPanel, CombatTextRail, ManaPanel, PilePanel } from "../components";
import type { CardGhost, FloatingCombatText, StatusChip } from "../types";
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
  handCardRefs,
  onCardClick,
  menuOpen,
  setMenuOpen,
  onGoToScreen,
  onWishChoice,
  cardGhosts,
  onRemoveCardGhost,
  onSkipCombatDevMode,
  onEndTurn,
  onEndRun,
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
  handCardRefs: MutableRefObject<Record<string, HTMLButtonElement | null>>;
  onCardClick: (card: BattleCard, index: number, event: MouseEvent<HTMLButtonElement>) => void;
  menuOpen: boolean;
  setMenuOpen: (value: boolean | ((current: boolean) => boolean)) => void;
  onGoToScreen: (screen: "menu" | "collection" | "options" | "talents") => void;
  onWishChoice: (card: BattleCard) => void;
  cardGhosts: CardGhost[];
  onRemoveCardGhost: (id: string) => void;
  onSkipCombatDevMode: () => void;
  onEndTurn: () => void;
  onEndRun: () => void;
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
  const playerTurnBadgeTransform = hasCompanion
    ? 'translateX(calc(-50% - clamp(111px,11cqh,168px) - clamp(72px,5.5vw,112px) - clamp(12px,1.2vw,22px)))'
    : 'translateX(calc(-50% - clamp(111px,11cqh,168px) - clamp(72px,5.5vw,112px)))';
  const [wishSelectedCard, setWishSelectedCard] = useState<BattleCard | null>(null);

  // MOBILE LANDSCAPE — compact two-row layout for touch devices
  if (isMobileLandscape) {
    return (
      <div ref={battleSceneRef} className="relative h-full w-full overflow-hidden [container-type:size]">
        <div className="absolute inset-0 flex flex-col">
          {/* Top: Player & Enemy side-by-side */}
          <div className="flex items-start justify-center gap-1 p-1">
            <div className="relative flex flex-col items-center">
              <CombatTextRail entries={playerCombatTexts} side="player" />
              <div className="flex items-start justify-center transition-transform duration-500 ease-out">
                <div className={hasCompanion ? "relative transition-transform duration-500 ease-out -translate-x-1" : "relative transition-transform duration-500 ease-out"}>
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
                    surfaceRef={(node) => { playerPanelRef.current = node; }}
                    shaking={playerShaking}
                    cardWidthClass={mobileBattleCardWidthClass}
                  />
                  {battleState.activeCompanion ? (
                    <div className="absolute bottom-[clamp(64px,10vh,88px)] left-[calc(100%-clamp(28px,6vh,44px))] z-20">
                      <CompanionPanel companion={battleState.activeCompanion} compact shaking={companionShaking} />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="relative flex flex-col items-center">
              <CombatTextRail entries={enemyCombatTexts} side="enemy" />
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
                surfaceRef={(node) => { enemyPanelRef.current = node; }}
                isDead={battleState.enemyHealth <= 0}
                shaking={enemyShaking}
                cardWidthClass={mobileBattleCardWidthClass}
                descriptionLines={battleState.currentEnemy.descriptionLines}
              />
            </div>
          </div>

          {/* Action bar */}
          <div className="flex items-center justify-between px-2 py-0.5">
            <ManaPanel mana={battleState.mana} maxMana={battleState.maxMana} gold={battleState.gold} />
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {isPlayerTurn ? "Your Turn" : "Enemy Turn"}
              </span>
              <PilePanel label="Deck" count={battleState.deck.length} type="draw" compact />
              <PilePanel label="Discard" count={battleState.discard.length} type="discard" compact />
              <Button
                variant="default"
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-7 px-2.5"
                onClick={onEndTurn}
                disabled={battleState.turnPhase !== "player"}
              >
                End
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-label="Open battle menu"
              >
                <Menu className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Hand cards: horizontal scroll */}
          <div className="flex-1 overflow-x-auto overscroll-x-contain min-h-0 pb-1">
            <div className="flex h-full items-end justify-center gap-1 px-1">
              {battleState.hand.length === 0 ? (
                <p className="self-center text-xs text-muted-foreground">No cards in hand</p>
              ) : (
                battleState.hand.map((card, index) => {
                  const canPlay = battleState.turnPhase === "player" && battleState.mana >= card.cost && !battleState.wishOptions;
                  return (
                    <BattleCardButton
                      key={`${card.id}-${card.uid}`}
                      card={card}
                      hovered={false}
                      onHoverStart={() => {}}
                      onHoverEnd={() => {}}
                      onClick={(event) => onCardClick(card, index, event)}
                      buttonRef={(node) => { handCardRefs.current[`${card.id}-${card.uid}`] = node; }}
                      ariaLabel={`Play ${card.title}`}
                      shimmerActive={false}
                      baseTransform="translate3d(0px,0px,0px)"
                      className={mobileHandCardWidthClass}
                      disabled={!canPlay}
                      wrapperClassName="flex-shrink-0"
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Battle menu overlay */}
        {menuOpen ? (
          <div className="absolute inset-0 z-50 flex items-start justify-end p-2 pt-14">
            <div className="battle-menu-pop alchemy-shell w-48 rounded-[20px] border border-border/80 p-2">
              <div className="grid gap-1.5">
                <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => onGoToScreen("menu")}>
                  <House className="h-3.5 w-3.5" /> Main Menu
                </Button>
                <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => onGoToScreen("collection")}>
                  <BookOpen className="h-3.5 w-3.5" /> Collection
                </Button>
                <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => onGoToScreen("options")}>
                  <Cog className="h-3.5 w-3.5" /> Options
                </Button>
                <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => onGoToScreen("talents")}>
                  <WandSparkles className="h-3.5 w-3.5" /> Talents
                </Button>
                <Button variant="ghost" size="sm" className="justify-start text-xs text-red-400 hover:text-red-300" onClick={onEndRun}>
                  <Swords className="h-3.5 w-3.5" /> End Run
                </Button>
                {import.meta.env.DEV ? (
                  <Button variant="ghost" size="sm" className="justify-start text-xs text-amber-200" onClick={onSkipCombatDevMode}>
                    <Coins className="h-3.5 w-3.5" /> Skip Combat
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {/* Wish overlay */}
        {battleState.wishOptions ? (
          <div className="motion-overlay absolute inset-0 z-[90] flex items-center justify-center bg-black/70 px-4">
            <div className="motion-panel alchemy-shell max-h-[80vh] w-full max-w-md overflow-y-auto rounded-[24px] border border-border/80 px-4 py-4">
              <h2 className="text-center text-lg text-foreground">Wish</h2>
              <p className="mt-1 text-center text-xs text-muted-foreground">Choose one card to add to your hand.</p>
              <div className="mt-4 flex flex-wrap items-start justify-center gap-3">
                {battleState.wishOptions.map((card, index) => {
                  const isSelected = wishSelectedCard?.id === card.id;
                  return (
                    <BattleCardButton
                      key={card.id}
                      card={card}
                      hovered={false}
                      onHoverStart={() => {}}
                      onHoverEnd={() => {}}
                      onClick={() => setWishSelectedCard(card)}
                      ariaLabel={`Choose ${card.title}`}
                      shimmerActive={false}
                      baseTransform="translate3d(0px,0px,0px)"
                      className={mobileHandCardWidthClass}
                      wrapperStyle={{ "--stagger-index": index } as CSSProperties}
                      selected={isSelected}
                    />
                  );
                })}
              </div>
              <div className="mt-4 flex justify-center">
                <Button size="sm" disabled={!wishSelectedCard} onClick={() => { onWishChoice(wishSelectedCard!); setWishSelectedCard(null); }}>
                  Confirm
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Card ghosts */}
        {cardGhosts.map((ghost) => (
          <CardGhostOverlay key={ghost.id} ghost={ghost} onDone={() => onRemoveCardGhost(ghost.id)} />
        ))}
      </div>
    );
  }

  return (
    <div ref={battleSceneRef} className="relative h-full w-full overflow-hidden [container-type:size]">
      <section className="absolute inset-x-0 flex -translate-y-1/2 items-start justify-center gap-[clamp(144px,11vw,224px)] px-4" style={{ top: '42%' }}>
        <div
          className={`pointer-events-none absolute -top-10 left-1/2 z-20 whitespace-nowrap rounded-md px-3 py-1 text-sm transition-all duration-500 ${
            isPlayerTurn ? 'bg-emerald-900/80 text-emerald-300' : 'bg-rose-900/80 text-rose-300'
          }`}
          style={{
            transform: isPlayerTurn
              ? playerTurnBadgeTransform
              : 'translateX(calc(-50% + clamp(111px,11cqh,168px) + clamp(72px,5.5vw,112px)))',
          }}
        >
          {isPlayerTurn ? 'Your Turn' : 'Enemy Turn'}
        </div>
        <div className="relative flex items-start justify-center transition-transform duration-500 ease-out">
          <div className="absolute left-full top-[12%] z-30 ml-3 w-40">
            <CombatTextRail entries={playerCombatTexts} side="player" />
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
            />
            {battleState.activeCompanion ? (
              <div className="absolute bottom-[clamp(88px,8.5cqh,118px)] left-[calc(100%-clamp(42px,4.6cqh,68px))] z-20">
                <CompanionPanel companion={battleState.activeCompanion} shaking={companionShaking} />
              </div>
            ) : null}
          </div>
        </div>

        <div className="relative flex flex-col items-center">
          <div className="absolute right-full top-[30%] z-30 mr-3 w-40">
            <CombatTextRail entries={enemyCombatTexts} side="enemy" />
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
          />
        </div>
      </section>

      <section className="absolute inset-x-0 bottom-2 grid grid-cols-[minmax(110px,0.24fr)_1fr_minmax(110px,0.24fr)] items-end gap-[clamp(16px,2vw,28px)] px-2 pb-1">
        <div className="flex flex-col items-center justify-end gap-4 pb-4">
          <ManaPanel mana={battleState.mana} maxMana={battleState.maxMana} gold={battleState.gold} />
          <PilePanel label="Draw Pile" count={battleState.deck.length} type="draw" />
        </div>

        <div className="flex min-h-[334px] min-w-0 items-end justify-center pb-3 pt-10" aria-label="Player hand">
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
                className={handCardWidthClass}
                disabled={!canPlay}
                wrapperClassName="stagger-item relative -mx-5 flex justify-center sm:-mx-6"
                wrapperStyle={{ zIndex: isHovered ? 40 : 10 + index, "--stagger-index": index } as CSSProperties}
              />
            );
          })}
        </div>

        <div className="flex flex-col items-center justify-end gap-4 pb-4">
          <div className="relative flex flex-col items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label="Open battle menu"
            >
              <Menu className="h-4 w-4" />
            </Button>

            <Button
              variant="default"
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
              onClick={onEndTurn}
              disabled={battleState.turnPhase !== "player"}
            >
              End Turn
            </Button>

            {menuOpen ? (
              <div className="battle-menu-pop alchemy-shell absolute bottom-full right-0 z-50 mb-3 w-56 rounded-[20px] border border-border/80 p-2">
                <div className="grid gap-2">
                  <Button variant="ghost" className="justify-start" onClick={() => onGoToScreen("menu")}>
                    <House className="h-4 w-4" />
                    Main Menu
                  </Button>
                  <Button variant="ghost" className="justify-start" onClick={() => onGoToScreen("collection")}>
                    <BookOpen className="h-4 w-4" />
                    Collection
                  </Button>
                  <Button variant="ghost" className="justify-start" onClick={() => onGoToScreen("options")}>
                    <Cog className="h-4 w-4" />
                    Options
                  </Button>
                  <Button variant="ghost" className="justify-start" onClick={() => onGoToScreen("talents")}>
                    <WandSparkles className="h-4 w-4" />
                    Talents
                  </Button>
                  <Button variant="ghost" className="justify-start text-red-400 hover:text-red-300 hover:bg-red-950/40" onClick={onEndRun}>
                    <Swords className="h-4 w-4" />
                    End Run
                  </Button>
                  {import.meta.env.DEV ? (
                    <Button variant="ghost" className="justify-start text-amber-200 hover:text-amber-100" onClick={onSkipCombatDevMode}>
                      <Coins className="h-4 w-4" />
                      Skip Combat
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <PilePanel label="Discard Pile" count={battleState.discard.length} type="discard" />
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
                    className={handCardWidthClass}
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
