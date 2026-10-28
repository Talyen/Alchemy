import { createElement, type CSSProperties, type ReactNode } from "react";

import { useGameTranslation } from "@/components/use-game-translation";
import { useReducedMotionPreference } from "@/components/ui/use-reduced-motion-preference";
import { getTalentIcon } from "@/features/alchemy/shared/config";
import { keywordDefinitions, type TalentDefinition } from "@/lib/game-data";
import { renderTokenizedDescription } from "../../shared/ui/localized-description";

export type TalentNodeState = "locked" | "available" | "unlocking" | "unlocked";
export const TALENT_NODE_UNLOCK_MS = 400;

/** Unlock feedback changes only color and light; every contour stays stationary. */
export function TalentNodeFace({
  talent,
  state,
  title,
}: {
  talent: TalentDefinition;
  state: TalentNodeState;
  title: ReactNode;
}) {
  const i18n = useGameTranslation();
  const reduceMotion = useReducedMotionPreference();
  return (
    <>
      <span
        className="talent-node-glow"
        data-unlocking={state === "unlocking" && !reduceMotion ? "true" : undefined}
        aria-hidden="true"
      />
      <span
        className="talent-node-frame"
        data-unlocking={state === "unlocking" && !reduceMotion ? "true" : undefined}
        data-reduced-motion={reduceMotion ? "true" : undefined}
        aria-hidden="true"
      />
      <span className="talent-node-content">
        <span className="talent-node-header">
          <span className="talent-node-icon-wrap" aria-hidden="true">
            {createElement(getTalentIcon(talent), { className: "talent-node-icon" })}
          </span>
          <span className="talent-node-title">{title}</span>
        </span>
        <span className="talent-node-description">
          {i18n.displayText(
            i18n.read(() =>
              renderTokenizedDescription(talent.description, {
                renderKeyword: (word, keywordId, key) => (
                  <span
                    key={key}
                    className="talent-node-keyword font-semibold"
                    data-talent-keyword={keywordId}
                    style={{ "--talent-keyword-source": keywordDefinitions[keywordId].shineColors[0] } as CSSProperties}
                  >
                    {word}
                  </span>
                ),
              }),
            ),
          )}
        </span>
      </span>
    </>
  );
}
