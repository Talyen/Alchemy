// Battle presentation screen for actors, hand fan, piles, ghosts, wish choices, and menu entry.
// Depends on battle state snapshots, reusable alchemy UI widgets, and responsive card sizing config.
// Driven by useBattleController; it should not mutate combat state directly.
import type { CSSProperties, MouseEvent, MutableRefObject } from "react";
import { useState } from "react";
import { Coins, Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { type BattleCard } from "@/lib/game-data";
import type { BattleState } from "@/lib/battle";
import {
  BATTLE_ACTOR_TOP_DESKTOP,
  BATTLE_ACTOR_TOP_MOBILE,
  HAND_CARD_BASE_Z_INDEX,
  HAND_CARD_HOVER_Z_INDEX,
  HAND_FAN_ROTATION_DEGREES,
  HAND_FAN_VERTICAL_STEP_PX,
  HAND_HOVER_LIFT_PX,
  HAND_HOVER_ROTATION_DEGREES,
  HAND_HOVER_SCALE,
  WISH_OVERLAY_Z_INDEX,
} from "@/lib/game-constants";

import { handCardWidthClass, mobileStageBattleCardWidthClass, mobileStageHandCardWidthClass } from "../config";
import {
  ArtPanel,
  BattleCardButton,
  CardGhostOverlay,
  CompanionPanel,
  CombatTextRail,
  ManaPanel,
  PilePanel,
} from "../components";
import type { CardGhost, FloatingCombatText, StatusChip } from "../types";
import { getHoverId } from "../utils";

type BattleScreenState = Pick<
  BattleState,
  | "playerHealth"
  | "playerMaxHealth"
  | "deathsDoorActive"
  | "enemyHealth"
  | "enemyMaxHealth"
  | "mana"
  | "maxMana"
  | "gold"
  | "deck"
  | "discard"
  | "hand"
  | "wishOptions"
  | "activeCompanion"
  | "currentEnemy"
  | "turnPhase"
>;

type BattleScreenViewProps = {
  battleState: BattleScreenState;
  heroArt: string;
  playerName: string;
  isMobileLandscape?: boolean;
};

type BattleHoverProps = {
  hoveredCardId: string | null;
  setHoveredCardId: (value: string | null | ((current: string | null) => string | null)) => void;
  shimmerState: { cardId: string; token: number } | null;
  onHoverShimmer: (cardId: string) => void;
};

type BattleFeedbackProps = {
  playerStatusChips: StatusChip[];
  enemyStatusChips: StatusChip[];
  playerCombatTexts: FloatingCombatText[];
  enemyCombatTexts: FloatingCombatText[];
  cardGhosts: CardGhost[];
  playerShaking: boolean;
  enemyShaking: boolean;
  companionShaking: boolean;
};

type BattleRefsProps = {
  handCardRefs: MutableRefObject<Record<string, HTMLButtonElement | null>>;
  battleSceneRef: MutableRefObject<HTMLDivElement | null>;
  playerPanelRef: MutableRefObject<HTMLDivElement | null>;
  enemyPanelRef: MutableRefObject<HTMLDivElement | null>;
};

type BattleActionsProps = {
  onCardClick: (card: BattleCard, index: number, event: MouseEvent<HTMLButtonElement>) => void;
  onOpenMenu: (rect?: DOMRect) => void;
  onWishChoice: (card: BattleCard) => void;
  onRemoveCardGhost: (id: string) => void;
  onSkipCombatDevMode: () => void;
  onEndTurn: () => void;
};

type BattleScreenProps = {
  view: BattleScreenViewProps;
  hover: BattleHoverProps;
  feedback: BattleFeedbackProps;
  refs: BattleRefsProps;
  actions: BattleActionsProps;
};

export function BattleScreen({ view, hover, feedback, refs, actions }: BattleScreenProps) {
  const { battleState, isMobileLandscape = false } = view;
  const { cardGhosts } = feedback;
  const { battleSceneRef } = refs;
  const { onRemoveCardGhost } = actions;

  return (
    <div
      ref={battleSceneRef}
      data-testid="battle-scene"
      className="relative h-full w-full overflow-hidden [container-type:size]"
    >
      {/* Battle actors use fixed stage anchors/container queries instead of document flow so
          actor panels, combat text rails, and the hand fan keep stable coordinates at every scale. */}
      <BattleActors view={{ ...view, isMobileLandscape }} hover={hover} feedback={feedback} refs={refs} />

      <BattleBottomBar view={{ ...view, isMobileLandscape }} hover={hover} refs={refs} actions={actions} />

      {battleState.wishOptions ? (
        <WishOverlay battleState={battleState} hover={hover} actions={actions} isMobileLandscape={isMobileLandscape} />
      ) : null}

      {cardGhosts.map((ghost) => (
        <CardGhostOverlay key={ghost.id} ghost={ghost} onDone={() => onRemoveCardGhost(ghost.id)} />
      ))}
    </div>
  );
}

// Keeps actor placement, turn badge math, and combat feedback together so the top stage
// can be changed independently from the hand/control area.
function BattleActors({
  view,
  hover,
  feedback,
  refs,
}: {
  view: Required<BattleScreenViewProps>;
  hover: BattleHoverProps;
  feedback: BattleFeedbackProps;
  refs: BattleRefsProps;
}) {
  const { battleState, heroArt, playerName, isMobileLandscape } = view;
  const { shimmerState, onHoverShimmer } = hover;
  const {
    playerStatusChips,
    enemyStatusChips,
    playerCombatTexts,
    enemyCombatTexts,
    playerShaking,
    enemyShaking,
    companionShaking,
  } = feedback;
  const { playerPanelRef, enemyPanelRef } = refs;
  const isPlayerTurn = battleState.turnPhase === "player";
  const hasCompanion = Boolean(battleState.activeCompanion);
  // These formulas mirror actor-card width and companion offset so the turn badge remains
  // visually attached to the active actor across desktop and mobile-landscape stages.
  const battleActorHalfGap = isMobileLandscape ? "clamp(130px,8cqw,180px)" : "clamp(168px,10cqw,210px)";
  const actorCardWidthClass = isMobileLandscape ? mobileStageBattleCardWidthClass : undefined;
  const playerTurnBadgeTransform = hasCompanion
    ? `translateX(calc(-50% - clamp(111px,11cqh,168px) - ${battleActorHalfGap} - clamp(12px,1.2cqw,22px)))`
    : `translateX(calc(-50% - clamp(111px,11cqh,168px) - ${battleActorHalfGap}))`;

  return (
    <section
      className={`absolute inset-x-0 flex -translate-y-1/2 items-start justify-center px-4 ${isMobileLandscape ? "gap-[clamp(260px,16cqw,360px)]" : "gap-[clamp(336px,20cqw,420px)]"}`}
      style={{ top: isMobileLandscape ? BATTLE_ACTOR_TOP_MOBILE : BATTLE_ACTOR_TOP_DESKTOP }}
    >
      <div
        className={`pointer-events-none absolute -top-10 left-1/2 z-20 whitespace-nowrap rounded-md px-3 py-1 text-sm transition-all duration-500 ${
          isPlayerTurn ? "bg-emerald-900/80 text-emerald-300" : "bg-rose-900/80 text-rose-300"
        }`}
        style={{
          transform: isPlayerTurn
            ? playerTurnBadgeTransform
            : `translateX(calc(-50% + clamp(111px,11cqh,168px) + ${battleActorHalfGap}))`,
        }}
      >
        {isPlayerTurn ? "Your Turn" : "Enemy Turn"}
      </div>
      <div className="relative flex items-start justify-center transition-transform duration-500 ease-out">
        <div className="absolute left-[calc(100%+clamp(28px,3cqw,44px))] top-[30%] z-30 w-40">
          <CombatTextRail entries={playerCombatTexts} side="player" />
        </div>
        <div
          className={
            hasCompanion
              ? "relative transition-transform duration-500 ease-out -translate-x-[clamp(12px,1.2vw,22px)]"
              : "relative transition-transform duration-500 ease-out"
          }
        >
          <ArtPanel
            side="player"
            title={playerName}
            art={heroArt}
            health={battleState.playerHealth}
            maxHealth={battleState.playerMaxHealth}
            statuses={playerStatusChips}
            shimmerId="player-card"
            shimmerActive={shimmerState?.cardId === "player-card"}
            shimmerToken={shimmerState?.token}
            onHoverShimmer={onHoverShimmer}
            combatTexts={playerCombatTexts}
            deathsDoorActive={battleState.deathsDoorActive}
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
          currentEnemy={battleState.currentEnemy}
          cardWidthClass={actorCardWidthClass}
        />
      </div>
    </section>
  );
}

// Groups the bottom combat UI into a single stage row while letting controls and hand be
// extracted separately below.
function BattleBottomBar({
  view,
  hover,
  refs,
  actions,
}: {
  view: Required<BattleScreenViewProps>;
  hover: BattleHoverProps;
  refs: BattleRefsProps;
  actions: BattleActionsProps;
}) {
  const { battleState, isMobileLandscape } = view;

  return (
    <section
      className={`absolute inset-x-0 grid items-end gap-[clamp(16px,2vw,28px)] px-2 ${isMobileLandscape ? "bottom-[calc(70px+env(safe-area-inset-bottom))] grid-cols-[minmax(170px,0.18fr)_1fr_minmax(220px,0.18fr)] pb-0" : "bottom-2 grid-cols-[minmax(110px,0.24fr)_1fr_minmax(110px,0.24fr)] pb-1"}`}
    >
      <div className={`flex flex-col items-center justify-end ${isMobileLandscape ? "gap-3 pb-8" : "gap-4 pb-4"}`}>
        <ManaPanel mana={battleState.mana} maxMana={battleState.maxMana} gold={battleState.gold} />
        <PilePanel
          label={isMobileLandscape ? "Deck" : "Draw Pile"}
          count={battleState.deck.length}
          type="draw"
          compact={isMobileLandscape}
        />
      </div>

      <BattleHand view={view} hover={hover} refs={refs} actions={actions} />

      <BattleControls battleState={battleState} isMobileLandscape={isMobileLandscape} actions={actions} />
    </section>
  );
}

// Owns hand-card fan math and hover wiring so BattleScreen no longer mixes layout with
// per-card rendering details.
function BattleHand({
  view,
  hover,
  refs,
  actions,
}: {
  view: Required<BattleScreenViewProps>;
  hover: BattleHoverProps;
  refs: BattleRefsProps;
  actions: BattleActionsProps;
}) {
  const { battleState, isMobileLandscape } = view;
  const { hoveredCardId, setHoveredCardId, shimmerState, onHoverShimmer } = hover;
  const { handCardRefs } = refs;
  const { onCardClick } = actions;
  const handWidthClass = isMobileLandscape ? mobileStageHandCardWidthClass : handCardWidthClass;

  return (
    <div
      className={`flex min-w-0 items-end justify-center ${isMobileLandscape ? "min-h-[320px] pb-0 pt-12" : "min-h-[334px] pb-3 pt-10"}`}
      aria-label="Player hand"
    >
      {battleState.hand.map((card, index) => {
        const hoverId = getHoverId("hand", `${card.id}-${card.uid}`);
        const isHovered = hoveredCardId === hoverId;
        const offset = index - (battleState.hand.length - 1) / 2;
        const restingTransform = getRestingHandTransform(offset);
        const hoverTransform = getHoverHandTransform(offset);
        const isShimmering = shimmerState?.cardId === hoverId;
        const canPlay = battleState.turnPhase === "player" && battleState.mana >= card.cost && !battleState.wishOptions;

        // The index offset creates the fan without layout shifts; hovered cards lift,
        // rotate less, and temporarily win z-index so detail popups remain readable.
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
            wrapperStyle={
              {
                zIndex: isHovered ? HAND_CARD_HOVER_Z_INDEX : HAND_CARD_BASE_Z_INDEX + index,
                "--stagger-index": index,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

// Keeps resource-adjacent buttons together so menu/end-turn/dev controls can evolve without
// touching hand or actor layout.
function BattleControls({
  battleState,
  isMobileLandscape,
  actions,
}: {
  battleState: BattleScreenState;
  isMobileLandscape: boolean;
  actions: BattleActionsProps;
}) {
  const { onOpenMenu, onEndTurn, onSkipCombatDevMode } = actions;

  return (
    <div className={`flex flex-col items-center justify-end ${isMobileLandscape ? "gap-3 pb-8" : "gap-4 pb-4"}`}>
      <div className="relative flex flex-col items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className={
            isMobileLandscape
              ? "h-20 w-20 text-muted-foreground hover:text-foreground"
              : "h-8 w-8 text-muted-foreground hover:text-foreground"
          }
          onClick={(e) => onOpenMenu(e.currentTarget.getBoundingClientRect())}
          aria-label="Open battle menu"
        >
          <Menu className={isMobileLandscape ? "h-11 w-11" : "h-4 w-4"} />
        </Button>

        <Button
          variant="default"
          size="sm"
          className={
            isMobileLandscape
              ? "h-20 bg-amber-600 px-10 text-2xl font-bold text-white hover:bg-amber-700"
              : "bg-amber-600 hover:bg-amber-700 text-white font-bold"
          }
          onClick={onEndTurn}
          disabled={battleState.turnPhase !== "player"}
        >
          End Turn
        </Button>

        {import.meta.env.DEV ? (
          <Button
            variant="ghost"
            size="sm"
            className={
              isMobileLandscape
                ? "h-20 w-20 text-amber-200 hover:text-amber-100 text-2xl"
                : "w-full text-amber-200 hover:text-amber-100 text-xs"
            }
            onClick={onSkipCombatDevMode}
          >
            <Coins className={isMobileLandscape ? "h-11 w-11" : "h-3.5 w-3.5"} />{" "}
            {isMobileLandscape ? "" : "Skip Combat"}
          </Button>
        ) : null}
      </div>

      <PilePanel
        label={isMobileLandscape ? "Discard" : "Discard Pile"}
        count={battleState.discard.length}
        type="discard"
        compact={isMobileLandscape}
      />
    </div>
  );
}

// Keeps wish choice state local to the modal so ordinary battle rendering remains stateless.
function WishOverlay({
  battleState,
  hover,
  actions,
  isMobileLandscape,
}: {
  battleState: BattleScreenState;
  hover: BattleHoverProps;
  actions: BattleActionsProps;
  isMobileLandscape: boolean;
}) {
  const { hoveredCardId, setHoveredCardId, shimmerState, onHoverShimmer } = hover;
  const { onWishChoice } = actions;
  const [wishSelectedCard, setWishSelectedCard] = useState<BattleCard | null>(null);
  const handWidthClass = isMobileLandscape ? mobileStageHandCardWidthClass : handCardWidthClass;

  return (
    <div
      className="motion-overlay absolute inset-0 flex items-center justify-center bg-black/70 px-6"
      style={{ zIndex: WISH_OVERLAY_Z_INDEX }}
    >
      <div className="motion-panel alchemy-shell w-full max-w-5xl rounded-[28px] border border-border/80 px-6 py-6">
        <div className="text-center">
          <h2 className="text-2xl text-foreground">Wish 1</h2>
          <p className="mt-2 text-sm text-muted-foreground">Choose one card to add to your hand.</p>
        </div>

        <div className="mt-6 flex flex-wrap items-start justify-center gap-5">
          {battleState.wishOptions?.map((card, index) => {
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
          <Button
            size="lg"
            disabled={!wishSelectedCard}
            onClick={() => {
              onWishChoice(wishSelectedCard!);
              setWishSelectedCard(null);
            }}
          >
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}

// Hand transforms use named balance constants so fan shape stays consistent across UI edits.
function getRestingHandTransform(offset: number) {
  return `translateY(${Math.abs(offset) * HAND_FAN_VERTICAL_STEP_PX}px) rotate(${offset * HAND_FAN_ROTATION_DEGREES}deg)`;
}

// Hover transform lifts and straightens a card enough to make rules text readable.
function getHoverHandTransform(offset: number) {
  return `translateY(-${HAND_HOVER_LIFT_PX}px) rotate(${offset * HAND_HOVER_ROTATION_DEGREES}deg) scale(${HAND_HOVER_SCALE})`;
}
