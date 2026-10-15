import { text as gameText, displayText } from "@/lib/localization/runtime";
import { GameMessage } from "@/components/localization";
import { useGameTranslation } from "@/components/use-game-translation";
import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { useStore } from "zustand";
import { manaDockFull, manaDockEmpty } from "@/features/alchemy/shared/config/game-data-catalog";
import { useReducedMotionPreference } from "@/components/ui/use-reduced-motion-preference";
import type { BattlePresentationStore } from "../../battle-presentation-store";
import { MANA_DOCK_VISIBLE_COUNT, projectMana, type ManaGemExit } from "../../mana-presentation";
import { useHoverVisible } from "../../../../shared/ui/use-hover-visible";
import { PortaledTooltip } from "../../../../shared/ui/tooltips/portaled-tooltip";
import { BattleSceneArtwork } from "../../../../shared/ui/battle-scene-artwork";

const SHARD_SHAPES = [
  "polygon(0 0, 50% 0, 50% 50%)",
  "polygon(50% 0, 100% 0, 50% 50%)",
  "polygon(100% 0, 100% 100%, 50% 50%)",
  "polygon(50% 50%, 100% 100%, 50% 100%)",
  "polygon(0 100%, 50% 50%, 50% 100%)",
  "polygon(0 0, 50% 50%, 0 100%)",
];

function ManaExit({ exit }: { exit: ManaGemExit }) {
  useGameTranslation();
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
            decoding="async"
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
        <img src={art} alt="" decoding="async" className="mana-dock-bonus-exit" />
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
  useGameTranslation();
  const reduced = useReducedMotionPreference();
  const mounted = useRef(false);
  const stored = useStore(presentation, (state) => state.manaPresentation);
  // Keep unchanged animation keys while the layout effect commits the new display.
  const state =
    stored?.mana === mana && stored.maxMana === maxMana ? stored : projectMana(stored, mana, maxMana, !reduced);
  const { triggerRef, visible, onMouseEnter, onMouseLeave, onFocusCapture, onBlurCapture, handleHoverStart } =
    useHoverVisible<HTMLButtonElement>();

  useLayoutEffect(() => {
    presentation.getState().setManaDisplay(mana, maxMana, mounted.current && !reduced);
    mounted.current = true;
  }, [mana, maxMana, presentation, reduced]);

  return (
    <button
      type="button"
      aria-label={gameText("ui.mana-dock.1", "Inspect Mana: {{value0}} / {{value1}}", {
        value0: mana,
        value1: maxMana,
      })}
      onClick={handleHoverStart}
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
      <div className="battle-mana-spill" aria-hidden="true">
        {state.gems.map((gem) => (
          <span
            key={gem.index}
            data-filled={gem.filled}
            style={{ left: `${gem.x}%`, top: `${gem.y}%`, height: `${state.height * 2.4}%` }}
          />
        ))}
      </div>
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
            <BattleSceneArtwork className="mana-dock-empty" maskSource={manaDockEmpty}>
              <img
                src={manaDockEmpty}
                alt=""
                draggable={false}
                decoding="async"
                className="block h-full w-full object-contain"
              />
            </BattleSceneArtwork>
            <BattleSceneArtwork className="mana-dock-full" maskSource={manaDockFull}>
              <img
                src={manaDockFull}
                alt=""
                draggable={false}
                decoding="async"
                className="block h-full w-full object-contain"
              />
            </BattleSceneArtwork>
            <span className="mana-dock-glow" />
            <span className="mana-dock-glint" style={{ maskImage: `url(${manaDockFull})` }} />
          </span>
          {gem.index === MANA_DOCK_VISIBLE_COUNT - 1 && state.hidden > 0 ? (
            <span key={`overflow-${state.revision}`} className="mana-dock-overflow">
              <GameMessage id="ui.mana-dock.s1" defaultValue="+<part0/>" parts={{ part0: displayText(state.hidden) }} />
            </span>
          ) : null}
        </span>
      ))}
      {!reduced ? state.exits.map((exit) => <ManaExit key={exit.id} exit={exit} />) : null}
      <PortaledTooltip triggerRef={triggerRef} visible={visible} width="w-auto" placement="above">
        <span className="font-semibold text-sky-400">
          <GameMessage
            id="ui.mana-dock.s2"
            defaultValue="Mana <part0/> / <part1/>"
            parts={{ part0: mana, part1: maxMana }}
          />
        </span>
        {mana > maxMana ? (
          <span className="block text-sm">
            <GameMessage
              id="ui.mana-dock.s3"
              defaultValue="<part0/> bonus Mana"
              parts={{ part0: displayText(mana - maxMana) }}
            />
          </span>
        ) : null}
        {state.hidden > 0 ? (
          <span className="block text-sm">
            <GameMessage
              id="ui.mana-dock.s4"
              defaultValue="<part0/> crystals beyond the visible <part1/>"
              parts={{ part0: displayText(state.hidden), part1: displayText(MANA_DOCK_VISIBLE_COUNT) }}
            />
          </span>
        ) : null}
      </PortaledTooltip>
    </button>
  );
}
