// Hero selection screen with character art, keyword previews, shine frames, and shimmer feedback.
// Depends on character game data, shared alchemy UI, and hover shimmer hooks.
// Used when beginning a fresh run before destination routing starts.
import { useMemo, useState } from "react";
import { ShineBorder } from "@/components/ui/shine-border";
import { cn } from "@/lib/utils";
import {
  characterArt,
  characters,
  getCharacterUnlockMessage,
  isCharacterUnlocked,
  type CharacterId,
} from "@/features/alchemy/shared/config/game-data-catalog";
import { CyclingShineBorder } from "../../shared/ui/cycling-shine-border";
import { HeroTooltip } from "../../shared/ui/hero-tooltip";
import { usePlasmaInteraction } from "../../shared/ui/use-plasma-source";
import { TitledScreenShell } from "../../shared/ui/layout-components";
import { TiltSurface } from "../../shared/ui/tilt-surface";
import { useHoverVisible } from "../../shared/ui/use-hover-visible";
import { useInteractiveCard } from "../../shared/ui/use-interactive-card";
import {
  cardInteractiveGlowClass,
  cardSurfaceClass,
  chooserHeroArtWidthClass,
  chooserHeroRowGapClass,
  chooserHeroRowShellWidthClass,
  chooserLockedSurfaceClass,
  getCharacterShineColors,
  getPlasmaColorPair,
  getPlasmaKeywordsForCharacter,
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
  onSelect,
  isLocked,
  unlockRequirementText,
  onHoverChange,
}: {
  id: CharacterId;
  onSelect: (id: CharacterId) => void;
  isLocked: boolean;
  unlockRequirementText: string;
  onHoverChange: (id: CharacterId | null) => void;
}) {
  const { triggerRef, visible, onMouseEnter, onMouseLeave, onFocusCapture, onBlurCapture } =
    useHoverVisible<HTMLDivElement>();
  const { shimmerActive, shimmerToken, onHoverStart } = useInteractiveCard("character-select", id);
  const char = characters[id];
  const art = characterArt[char.id];
  const shineColors = isLocked ? [] : id === "wildcard" ? WILDCARD_KEYWORD_SHINE_COLORS : getCharacterShineColors(id);

  function handleEnter() {
    if (!isLocked) {
      onHoverStart();
      onHoverChange(id);
    }
    onMouseEnter();
  }

  function handleLeave() {
    onMouseLeave();
    onHoverChange(null);
  }

  return (
    <div className="flex min-w-0 flex-col items-center gap-2">
      <div
        ref={triggerRef}
        className={cn("relative min-w-0", chooserHeroArtWidthClass)}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onFocusCapture={onFocusCapture}
        onBlurCapture={onBlurCapture}
      >
        <TiltSurface
          as="button"
          ariaLabel={isLocked ? `${char.name} (Locked)` : `Select ${char.name}`}
          ariaDisabled={isLocked}
          className={cn(
            "group relative w-full rounded-shell-tooltip border border-border/80 shadow-md",
            !isLocked && cardInteractiveGlowClass,
            !isLocked && "hero-affinity-shine",
          )}
          shimmerActive={isLocked ? false : shimmerActive}
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
        {visible ? (
          <HeroTooltip
            character={char}
            isLocked={isLocked}
            unlockRequirementText={unlockRequirementText}
            triggerRef={triggerRef}
            visible
          />
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
}: {
  onSelect: (characterId: CharacterId) => void;
  onOpenMenu: (rect?: DOMRect) => void;
  finishedRunCharacters: CharacterId[];
}) {
  const charIds = Object.keys(characters) as CharacterId[];
  const [hoveredCharacterId, setHoveredCharacterId] = useState<CharacterId | null>(null);

  const plasmaKeywordIds = useMemo(() => {
    if (hoveredCharacterId && isCharacterUnlocked(hoveredCharacterId, finishedRunCharacters)) {
      return getPlasmaKeywordsForCharacter(hoveredCharacterId);
    }
    return null;
  }, [finishedRunCharacters, hoveredCharacterId]);
  usePlasmaInteraction(plasmaKeywordIds ? getPlasmaColorPair(plasmaKeywordIds) : null, plasmaKeywordIds !== null);

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
              onSelect={onSelect}
              isLocked={isLocked}
              unlockRequirementText={unlockRequirementText}
              onHoverChange={setHoveredCharacterId}
            />
          );
        })}
      </div>
    </TitledScreenShell>
  );
}
