// Hero selection screen with character art, keyword previews, shine frames, and shimmer feedback.
// Depends on character game data, shared alchemy UI, and hover shimmer hooks.
// Used when beginning a fresh run before destination routing starts.
import { useRef, useState } from "react";
import { ShineBorder } from "@/components/ui/shine-border";
import { cn } from "@/lib/utils";
import {
  characterArt,
  characters,
  getCharacterUnlockMessage,
  isCharacterUnlocked,
  type CharacterId,
} from "@/features/alchemy/shared/config/game-data-catalog";
import { KeywordTag } from "../../shared/ui/keyword-tag";
import { renderColoredKeywords } from "../../shared/ui/card-description-ui";
import { CyclingShineBorder } from "../../shared/ui/cycling-shine-border";
import { TitledScreenShell } from "../../shared/ui/shared-ui";
import { TiltSurface } from "../../shared/ui/tilt-surface";
import { TooltipBody, TooltipHeader, TooltipSubheader } from "../../shared/ui/tooltip-panel";
import { PortaledTooltip } from "../../shared/ui/portaled-tooltip";
import {
  cardInteractiveGlowClass,
  cardSurfaceClass,
  chooserHeroArtWidthClass,
  chooserHeroRowGapClass,
  chooserHeroRowShellWidthClass,
  chooserLockedSurfaceClass,
  getCharacterShineColors,
  WILDCARD_KEYWORD_SHINE_COLORS,
  WILDCARD_SHINE_CYCLE_MS,
} from "@/features/alchemy/shared/config";
import { playUISound } from "@/lib/audio";

const HERO_SHINE_CLASS = "z-20 opacity-0 transition-opacity duration-200 group-hover:opacity-100";

function HeroCardShine({ characterId, colors }: { characterId: CharacterId; colors: readonly string[] }) {
  if (colors.length === 0) return null;
  if (characterId === "wildcard") {
    return (
      <CyclingShineBorder
        colors={colors}
        borderWidth={3}
        intervalMs={WILDCARD_SHINE_CYCLE_MS}
        className={HERO_SHINE_CLASS}
      />
    );
  }
  return <ShineBorder shineColor={colors} borderWidth={3} className={HERO_SHINE_CLASS} />;
}

function CharacterCard({
  id,
  isShimmer,
  shimmerToken,
  onSelect,
  onHoverShimmer,
  isLocked,
  unlockRequirementText,
}: {
  id: CharacterId;
  isShimmer: boolean;
  shimmerToken: number | undefined;
  onSelect: (id: CharacterId) => void;
  onHoverShimmer: (id: CharacterId) => void;
  isLocked: boolean;
  unlockRequirementText: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const cardWrapperRef = useRef<HTMLDivElement>(null);
  const char = characters[id];
  const art = characterArt[char.id];
  const shineColors = isLocked ? [] : id === "wildcard" ? WILDCARD_KEYWORD_SHINE_COLORS : getCharacterShineColors(id);

  return (
    <div className="flex min-w-0 flex-col items-center gap-2">
      <div ref={cardWrapperRef} className={cn("relative min-w-0", chooserHeroArtWidthClass)}>
        <TiltSurface
          as="button"
          ariaLabel={isLocked ? `${char.name} (Locked)` : `Select ${char.name}`}
          ariaDisabled={isLocked}
          className={cn(
            "group relative w-full rounded-shell-tooltip border border-border/80 shadow-md",
            !isLocked && cardInteractiveGlowClass,
            !isLocked && "hero-affinity-shine",
          )}
          shimmerActive={isLocked ? false : isShimmer}
          shimmerToken={isLocked ? undefined : shimmerToken}
          shimmerRounded="rounded-shell-tooltip"
          overlay={<HeroCardShine characterId={id} colors={shineColors} />}
          onClick={() => {
            if (isLocked) {
              playUISound("error");
            } else {
              onSelect(id);
            }
          }}
          onMouseEnter={() => {
            if (!isLocked) onHoverShimmer(id);
            setShowTooltip(true);
          }}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <img
            src={art}
            alt={char.name}
            className={cn(
              cardSurfaceClass,
              "aspect-[3/4] w-full rounded-shell-tooltip object-cover",
              isLocked && chooserLockedSurfaceClass,
            )}
          />
        </TiltSurface>
        {showTooltip ? (
          <PortaledTooltip triggerRef={cardWrapperRef} visible>
            <TooltipHeader>{char.name}</TooltipHeader>

            {isLocked ? (
              <TooltipBody>
                <p>{unlockRequirementText}</p>
              </TooltipBody>
            ) : (
              <>
                <TooltipBody>
                  <p>{renderColoredKeywords(char.description)}</p>
                </TooltipBody>

                {char.startingDeck.length > 0 ? (
                  <>
                    <TooltipSubheader>Starting Deck</TooltipSubheader>
                    <TooltipBody>
                      <p>{char.startingDeck.map((c) => c.title).join(", ")}</p>
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

                {char.keywords.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {char.keywords.map((kw) => (
                      <KeywordTag key={kw} keywordId={kw} pill />
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
        ) : null}
      </div>
      <p className={cn("font-sans text-2xl font-bold text-amber-100/90", isLocked && "text-muted-foreground/60")}>
        {char.name}
      </p>
    </div>
  );
}

export function CharacterSelectScreen({
  onSelect,
  onOpenMenu,
  finishedRunCharacters,
  shimmerState,
  onHoverShimmer,
}: {
  onSelect: (characterId: CharacterId) => void;
  onOpenMenu: (rect?: DOMRect) => void;
  finishedRunCharacters: CharacterId[];
  shimmerState?: { cardId?: string; token?: number } | null;
  onHoverShimmer: (cardId: CharacterId) => void;
}) {
  const charIds = Object.keys(characters) as CharacterId[];

  return (
    <TitledScreenShell
      title="Choose Your Hero"
      onOpenMenu={onOpenMenu}
      menuLabel="Open character select menu"
      maxWidthClass={chooserHeroRowShellWidthClass}
    >
      <div className={cn("mt-6 grid w-full grid-cols-4 justify-items-center gap-y-6", chooserHeroRowGapClass)}>
        {charIds.map((id) => {
          const isLocked = !isCharacterUnlocked(id, finishedRunCharacters);
          const unlockRequirementText = isLocked ? getCharacterUnlockMessage(id) : "";

          return (
            <CharacterCard
              key={id}
              id={id}
              isShimmer={shimmerState?.cardId === id}
              shimmerToken={shimmerState?.token}
              onSelect={onSelect}
              onHoverShimmer={onHoverShimmer}
              isLocked={isLocked}
              unlockRequirementText={unlockRequirementText}
            />
          );
        })}
      </div>
    </TitledScreenShell>
  );
}
