import { FULL_GAME_LOCK_MESSAGE } from "@/lib/game-edition";
import type { RefObject } from "react";
import type { CharacterDefinition } from "@/features/alchemy/shared/config/game-data-catalog";
import { getPlasmaColorPairForCharacter } from "@/features/alchemy/shared/config";

import { KeywordTag } from "../keyword-tag";
import { PortaledTooltip } from "./portaled-tooltip";
import { TooltipBody, TooltipHeader, TooltipSubheader } from "./tooltip-panel";
import { renderUnlockMessage } from "../unlock-text";

export function HeroTooltip({
  character,
  isLocked,
  requiresFullGame = false,
  unlockRequirementText,
  triggerRef,
  visible,
}: {
  character: CharacterDefinition;
  isLocked: boolean;
  requiresFullGame?: boolean;
  unlockRequirementText: string;
  triggerRef: RefObject<HTMLElement | null>;
  visible: boolean;
}) {
  return (
    <PortaledTooltip
      triggerRef={triggerRef}
      visible={visible}
      plasmaColorPair={isLocked || requiresFullGame ? null : getPlasmaColorPairForCharacter(character.id)}
    >
      <TooltipHeader>{character.name}</TooltipHeader>

      {isLocked || requiresFullGame ? (
        <TooltipBody>
          <p>
            {requiresFullGame ? (
              <strong className="font-bold text-destructive">{FULL_GAME_LOCK_MESSAGE}</strong>
            ) : (
              renderUnlockMessage(unlockRequirementText)
            )}
          </p>
        </TooltipBody>
      ) : (
        <>
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
            <div className="mt-2 flex flex-wrap gap-1">
              {character.keywords.map((keyword) => (
                <KeywordTag key={keyword} keywordId={keyword} pill />
              ))}
            </div>
          ) : (
            <div className="mt-2 flex">
              <span className="character-keyword-pill-tint inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs leading-none font-semibold text-gold-pale/90">
                All Keywords
              </span>
            </div>
          )}
        </>
      )}
    </PortaledTooltip>
  );
}
