import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { useStore } from "zustand";
import { manaDockFrame, manaDockFull, manaDockEmpty } from "@/features/alchemy/shared/config/game-data-catalog";
import { useReducedMotionPreference } from "@/components/ui/use-reduced-motion-preference";
import type { BattlePresentationStore } from "../../battle-presentation-store";
import { MANA_DOCK_VISIBLE_COUNT, projectMana, type ManaGemExit } from "../../mana-presentation";
import { useHoverVisible } from "../../../../shared/ui/use-hover-visible";
import { PortaledTooltip } from "../../../../shared/ui/tooltips/portaled-tooltip";

const SHARD_SHAPES = [
  "polygon(0 0, 50% 0, 50% 50%)",
  "polygon(50% 0, 100% 0, 50% 50%)",
  "polygon(100% 0, 100% 100%, 50% 50%)",
  "polygon(50% 50%, 100% 100%, 50% 100%)",
  "polygon(0 100%, 50% 50%, 50% 100%)",
  "polygon(0 0, 50% 50%, 0 100%)",
];

function ManaExit({ exit }: { exit: ManaGemExit }) {
  const art = exit.filled ? manaDockFull : manaDockEmpty;
  return (
    <span
      className="mana-dock-gem mana-dock-exit"
      style={{ left: `${exit.x}%`, top: `${exit.y}%`, height: `${exit.height}%` }}
      data-mana-exit={exit.kind}
      data-filled={exit.filled}
      aria-hidden="true"
    >
      {exit.kind === "destroy" ? (
        SHARD_SHAPES.map((shape, index) => (
          <img
            key={shape}
            src={art}
            alt=""
            className="mana-dock-shard"
            style={
              {
                clipPath: shape,
                "--shard-x": `${[-55, 35, 75, 40, -40, -75][index]}%`,
                "--shard-y": `${[-30, -45, 20, 55, 50, 10][index]}%`,
                "--shard-turn": `${[-25, 18, 32, 20, -18, -30][index]}deg`,
              } as CSSProperties
            }
          />
        ))
      ) : (
        <img src={art} alt="" className="mana-dock-bonus-exit" />
      )}
    </span>
  );
}

export function ManaPanel({
  mana,
  maxMana,
  presentation,
}: {
  mana: number;
  maxMana: number;
  presentation: BattlePresentationStore;
}) {
  const reduced = useReducedMotionPreference();
  const mounted = useRef(false);
  const stored = useStore(presentation, (state) => state.manaPresentation);
  const state = stored?.mana === mana && stored.maxMana === maxMana ? stored : projectMana(null, mana, maxMana, false);
  const { triggerRef, visible, onMouseEnter, onMouseLeave, onFocusCapture, onBlurCapture, handleHoverStart } =
    useHoverVisible();

  useLayoutEffect(() => {
    presentation.getState().setManaDisplay(mana, maxMana, mounted.current && !reduced);
    mounted.current = true;
  }, [mana, maxMana, presentation, reduced]);

  return (
    <div
      ref={triggerRef}
      className="mana-dock"
      data-testid="mana-panel"
      data-mana={mana}
      data-max-mana={maxMana}
      data-reduced-motion={reduced || undefined}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocusCapture={onFocusCapture}
      onBlurCapture={onBlurCapture}
    >
      <img src={manaDockFrame} alt="" draggable={false} className="mana-dock-frame" />
      <button
        type="button"
        className="mana-dock-inspect"
        aria-label={`Inspect Mana: ${mana} / ${maxMana}`}
        onClick={handleHoverStart}
      />
      {state.gems.map((gem) => (
        <span
          key={gem.index}
          className="mana-dock-gem"
          style={{ left: `${gem.x}%`, top: `${gem.y}%`, height: `${state.height}%` }}
          data-mana-index={gem.index}
          data-filled={gem.filled}
          data-effect={!reduced ? gem.effect : undefined}
          data-effect-token={gem.token}
          aria-hidden="true"
        >
          <span key={`effect-${gem.token}`} className="mana-dock-gem-motion">
            <span className="mana-dock-socket" />
            <img src={manaDockEmpty} alt="" draggable={false} className="mana-dock-empty" />
            <img src={manaDockFull} alt="" draggable={false} className="mana-dock-full" />
            <span className="mana-dock-glow" />
            <span className="mana-dock-glint" style={{ maskImage: `url(${manaDockFull})` }} />
          </span>
          {gem.index === MANA_DOCK_VISIBLE_COUNT - 1 && state.hidden > 0 ? (
            <span key={`overflow-${state.revision}`} className="mana-dock-overflow">
              +{state.hidden}
            </span>
          ) : null}
        </span>
      ))}
      {!reduced ? state.exits.map((exit) => <ManaExit key={exit.id} exit={exit} />) : null}
      <PortaledTooltip triggerRef={triggerRef} visible={visible} width="w-auto" placement="above">
        <span className="font-semibold text-sky-400">
          Mana {mana} / {maxMana}
        </span>
        {mana > maxMana ? <span className="block text-sm">{mana - maxMana} bonus Mana</span> : null}
        {state.hidden > 0 ? (
          <span className="block text-sm">
            {state.hidden} crystals beyond the visible {MANA_DOCK_VISIBLE_COUNT}
          </span>
        ) : null}
      </PortaledTooltip>
    </div>
  );
}
