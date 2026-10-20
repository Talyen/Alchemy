import { GameMessage } from "@/components/localization";
import { useGameTranslation } from "@/components/use-game-translation";
import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { useStore } from "zustand";
import { manaDockFull, manaDockEmpty } from "@/features/alchemy/shared/config/game-data-catalog";
import { useReducedMotionPreference } from "@/components/ui/use-reduced-motion-preference";
import type { BattlePresentationStore } from "../../battle-presentation-store";
import { MANA_DOCK_VISIBLE_COUNT, projectMana, type ManaGemExit } from "../../mana-presentation";

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
  const i18n = useGameTranslation();
  const reduced = useReducedMotionPreference();
  const mounted = useRef(false);
  const stored = useStore(presentation, (state) => state.manaPresentation);
  // Keep unchanged animation keys while the layout effect commits the new display.
  const state =
    stored?.mana === mana && stored.maxMana === maxMana ? stored : projectMana(stored, mana, maxMana, !reduced);

  useLayoutEffect(() => {
    presentation.getState().setManaDisplay(mana, maxMana, mounted.current && !reduced);
    mounted.current = true;
  }, [mana, maxMana, presentation, reduced]);

  return (
    <div
      role="img"
      aria-label={i18n.text("ui.mana-dock.1", "Mana: {{value0}} / {{value1}}", {
        value0: mana,
        value1: maxMana,
      })}
      className="mana-dock"
      data-testid="mana-panel"
      data-mana={mana}
      data-max-mana={maxMana}
      data-reduced-motion={reduced || undefined}
    >
      <div className="mana-dock-art" aria-hidden="true">
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
              <div className="mana-dock-empty">
                <img
                  src={manaDockEmpty}
                  alt=""
                  draggable={false}
                  decoding="async"
                  className="block h-full w-full object-contain"
                />
              </div>
              <div className="mana-dock-full">
                <img
                  src={manaDockFull}
                  alt=""
                  draggable={false}
                  decoding="async"
                  className="block h-full w-full object-contain"
                />
              </div>
              <span className="mana-dock-glow" />
              <span className="mana-dock-glint" style={{ maskImage: `url(${manaDockFull})` }} />
            </span>
            {gem.index === MANA_DOCK_VISIBLE_COUNT - 1 && state.hidden > 0 ? (
              <span key={`overflow-${state.revision}`} className="mana-dock-overflow">
                <GameMessage
                  id="ui.mana-dock.s1"
                  defaultValue="+<part0/>"
                  parts={{ part0: i18n.displayText(state.hidden) }}
                />
              </span>
            ) : null}
          </span>
        ))}
        {!reduced ? state.exits.map((exit) => <ManaExit key={exit.id} exit={exit} />) : null}
      </div>
    </div>
  );
}
