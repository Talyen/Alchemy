// Battle presentation screen for actors, hand fan, piles, ghosts, wish choices, and menu entry.
// Driven by useBattleController; focused child modules own the layout slices.
import { CardGhostOverlay } from "../components";
import { BattleActors } from "./battle-screen/actors";
import { BattleBottomBar } from "./battle-screen/controls";
import { WishOverlay } from "./battle-screen/wish-overlay";
import type { BattleActionsProps, BattleFeedbackProps, BattleHoverProps, BattleRefsProps, BattleScreenViewProps } from "./battle-screen/types";

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
  const requiredView = { ...view, isMobileLandscape };

  return (
    <div ref={battleSceneRef} data-testid="battle-scene" className="relative h-full w-full overflow-hidden [container-type:size]">
      <BattleActors view={requiredView} hover={hover} feedback={feedback} refs={refs} />

      <BattleBottomBar view={requiredView} hover={hover} refs={refs} actions={actions} />

      {battleState.wishOptions ? (
        <WishOverlay battleState={battleState} hover={hover} actions={actions} isMobileLandscape={isMobileLandscape} />
      ) : null}

      {cardGhosts.map((ghost) => (
        <CardGhostOverlay key={ghost.id} ghost={ghost} onDone={() => onRemoveCardGhost(ghost.id)} />
      ))}
    </div>
  );
}
