import type { MouseEvent, MutableRefObject, PointerEvent as ReactPointerEvent } from "react";
import { BookOpen, Cog, Coins, House, Menu, Swords, WandSparkles, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { type BattleCard } from "@/lib/game-data";
import { maxPlayerHealth, type BattleState } from "@/lib/battle/types";


import { handCardWidthClass } from "../config";
import { ArtPanel, BattleCardButton, CardGhostOverlay, CombatTextRail, DragCardPreview, ManaPanel, PilePanel } from "../components";
import type { CardGhost, DragPreview, FloatingCombatText, StatusChip } from "../types";
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
  onCardPointerDown,
  onKeyboardPlay,
  activeDraggedCardId,
  menuOpen,
  setMenuOpen,
  onGoToScreen,
  onWishChoice,
  cardGhosts,
  onRemoveCardGhost,
  dragPreview,
  onSkipCombatDevMode,
  onEndTurn,
  onEndRun,
  battleSceneRef,
  playerPanelRef,
  enemyPanelRef,
  playerShaking,
  enemyShaking,
  heroArt,
}: {
  battleState: Pick<BattleState, 'playerHealth' | 'enemyHealth' | 'enemyMaxHealth' | 'mana' | 'maxMana' | 'gold' | 'deck' | 'discard' | 'hand' | 'wishOptions' | 'currentEnemy' | 'turnPhase'>;
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
  onCardPointerDown: (card: BattleCard, index: number, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onKeyboardPlay: (card: BattleCard, index: number, event: MouseEvent<HTMLButtonElement>) => void;
  activeDraggedCardId: string | null;
  menuOpen: boolean;
  setMenuOpen: (value: boolean | ((current: boolean) => boolean)) => void;
  onGoToScreen: (screen: "menu" | "collection" | "options" | "talents") => void;
  onWishChoice: (card: BattleCard) => void;
  cardGhosts: CardGhost[];
  onRemoveCardGhost: (id: string) => void;
  dragPreview: DragPreview | null;
  onSkipCombatDevMode: () => void;
  onEndTurn: () => void;
  onEndRun: () => void;
  battleSceneRef: MutableRefObject<HTMLDivElement | null>;
  playerPanelRef: MutableRefObject<HTMLDivElement | null>;
  enemyPanelRef: MutableRefObject<HTMLDivElement | null>;
  playerShaking: boolean;
  enemyShaking: boolean;
}) {
  const isPlayerTurn = battleState.turnPhase === "player";

  return (
    <div ref={battleSceneRef} className="relative h-full w-full overflow-hidden">
      <section className="absolute inset-x-0 flex -translate-y-1/2 items-start justify-center gap-[clamp(104px,9vw,182px)] px-4" style={{ top: '42%' }}>
        <div
          className={`pointer-events-none absolute -top-10 left-1/2 z-20 whitespace-nowrap rounded-md px-3 py-1 text-sm font-semibold transition-all duration-500 ${
            isPlayerTurn ? 'bg-emerald-900/80 text-emerald-300' : 'bg-rose-900/80 text-rose-300'
          }`}
          style={{
            transform: isPlayerTurn
              ? 'translateX(calc(-50% - clamp(111px,11vh,168px) - clamp(52px,4.5vw,91px)))'
              : 'translateX(calc(-50% + clamp(111px,11vh,168px) + clamp(52px,4.5vw,91px)))',
          }}
        >
          {isPlayerTurn ? 'Your Turn' : 'Enemy Turn'}
        </div>
        <div className="relative flex flex-col items-center">
          <div className="absolute top-[18%] left-full ml-2 z-30 max-w-52">
            <CombatTextRail entries={playerCombatTexts} side="player" />
          </div>
          <ArtPanel
            side="player"
            title="Knight"
            art={heroArt}
            health={battleState.playerHealth}
            maxHealth={maxPlayerHealth}
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
        </div>

        <div className="relative flex flex-col items-center">
          <div className="absolute top-[18%] right-full mr-2 z-30 max-w-52">
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
          />
        </div>
      </section>

      <section className="absolute inset-x-0 bottom-2 grid grid-cols-[minmax(110px,0.24fr)_1fr_minmax(110px,0.24fr)] items-end gap-[clamp(16px,2vw,28px)] px-2 pb-1">
        <div className="flex flex-col items-center justify-end gap-4 pb-4">
          <ManaPanel mana={battleState.mana} maxMana={battleState.maxMana} gold={battleState.gold} />
          <PilePanel label="Draw Pile" count={battleState.deck.length} type="draw" />
        </div>

        <div className="flex min-h-[298px] min-w-0 items-end justify-center pb-3 pt-10" aria-label="Player hand">
          {battleState.hand.map((card, index) => {
            const hoverId = getHoverId("hand", `${card.id}-${index}`);
            const isHovered = hoveredCardId === hoverId;
            const offset = index - (battleState.hand.length - 1) / 2;
            const restingTransform = `translateY(${Math.abs(offset) * 10}px) rotate(${offset * 4.2}deg)`;
            const hoverTransform = `translateY(-34px) rotate(${offset * 2.6}deg) scale(1.03)`;
            const isShimmering = shimmerState?.cardId === hoverId;
            const canPlay = battleState.turnPhase === "player" && battleState.mana >= card.cost && !battleState.wishOptions;

            return (
              <BattleCardButton
                key={card.id}
                card={card}
                hovered={isHovered}
                onHoverStart={() => {
                  setHoveredCardId(hoverId);
                  onHoverShimmer(hoverId);
                }}
                onHoverEnd={() => setHoveredCardId((current) => (current === hoverId ? null : current))}
                onClick={(event) => onKeyboardPlay(card, index, event)}
                onPointerDown={(event) => onCardPointerDown(card, index, event)}
                buttonRef={(node) => {
                  handCardRefs.current[`${card.id}-${index}`] = node;
                }}
                ariaLabel={`Play ${card.title}`}
                tiltStrength={18}
                shimmerActive={isShimmering}
                shimmerToken={shimmerState?.token}
                baseTransform={isHovered ? hoverTransform : restingTransform}
                className={handCardWidthClass}
                dragging={activeDraggedCardId === card.id}
                disabled={!canPlay}
                wrapperClassName="relative -mx-5 flex justify-center sm:-mx-6"
                wrapperStyle={{ zIndex: isHovered ? 40 : 10 + index }}
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
              <div className="alchemy-shell absolute bottom-full right-0 z-50 mb-3 w-56 rounded-[20px] border border-border/80 p-2">
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
                  <Button variant="ghost" className="justify-start text-amber-200 hover:text-amber-100" onClick={onSkipCombatDevMode}>
                    <Coins className="h-4 w-4" />
                    Skip Combat
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <PilePanel label="Discard Pile" count={battleState.discard.length} type="discard" />
        </div>
      </section>

      {battleState.wishOptions ? (
        <div className="absolute inset-0 z-[90] flex items-center justify-center bg-black/70 px-6">
          <div className="alchemy-shell w-full max-w-5xl rounded-[28px] border border-border/80 px-6 py-6">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-foreground">Wish 1</h2>
              <p className="mt-2 text-sm text-muted-foreground">Choose one card to add to your hand.</p>
            </div>

            <div className="mt-6 flex flex-wrap items-start justify-center gap-5">
              {battleState.wishOptions.map((card) => {
                const hoverId = getHoverId("wish", card.id);

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
                    onClick={() => onWishChoice(card)}
                    ariaLabel={`Choose ${card.title}`}
                    tiltStrength={15}
                    shimmerActive={shimmerState?.cardId === hoverId}
                    shimmerToken={shimmerState?.token}
                    className={handCardWidthClass}
                    wrapperClassName="relative flex justify-center"
                  />
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {cardGhosts.map((ghost) => (
        <CardGhostOverlay key={ghost.id} ghost={ghost} onDone={() => onRemoveCardGhost(ghost.id)} />
      ))}
      {dragPreview ? <DragCardPreview preview={dragPreview} /> : null}

      {battleState.playerHealth <= 0 ? (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-black/80 px-6">
          <h1 className="text-5xl font-bold text-red-400">Defeat</h1>
          <p className="text-lg text-muted-foreground">Your run has ended.</p>
        </div>
      ) : null}
    </div>
  );
}
