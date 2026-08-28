import type { RefObject } from "react";
import type { CharacterDefinition } from "@/features/alchemy/shared/config/game-data-catalog";
import { getPlasmaColorPairForCharacter } from "@/features/alchemy/shared/config";

import { renderColoredKeywords } from "./card-description-ui";
import { KeywordTag } from "./keyword-tag";
import { PortaledTooltip } from "./portaled-tooltip";
import { TooltipBody, TooltipHeader, TooltipSubheader } from "./tooltip-panel";

export function HeroTooltip({
  character,
  isLocked,
  unlockRequirementText,
  triggerRef,
  visible,
}: {
  character: CharacterDefinition;
  isLocked: boolean;
  unlockRequirementText: string;
  triggerRef: RefObject<HTMLElement | null>;
  visible: boolean;
}) {
  return (
    <PortaledTooltip
      triggerRef={triggerRef}
      visible={visible}
      plasmaColorPair={isLocked ? null : getPlasmaColorPairForCharacter(character.id)}
    >
      <TooltipHeader>{character.name}</TooltipHeader>

      {isLocked ? (
        <TooltipBody>
          <p>{unlockRequirementText}</p>
        </TooltipBody>
      ) : (
        <>
          <TooltipBody>
            <p>{renderColoredKeywords(character.description)}</p>
          </TooltipBody>

          {character.startingDeck.length > 0 ? (
            <>
              <TooltipSubheader>Starting Deck</TooltipSubheader>
              <TooltipBody>
                <p>{character.startingDeck.map((card) => card.title).join(", ")}</p>
              </TooltipBody>
            </>
          ) : (
            <>
              <TooltipSubheader>Draft a Deck</TooltipSubheader>
              <TooltipBody>
                <p>Choose your own fate</p>
              </TooltipBody>
            </>
          )}

          {character.keywords.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {character.keywords.map((keyword) => (
                <KeywordTag key={keyword} keywordId={keyword} pill />
              ))}
            </div>
          ) : (
            <div className="mt-2 flex">
              <span className="character-keyword-pill-tint inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs leading-none font-semibold text-amber-100/90">
                All Keywords
              </span>
            </div>
          )}
        </>
      )}
    </PortaledTooltip>
  );
}
