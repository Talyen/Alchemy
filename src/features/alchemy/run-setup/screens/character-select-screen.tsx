import { memo } from "react";
import { ShineBorder } from "@/components/ui/shine-border";
import { cn } from "@/lib/utils";
import {
  characterArt,
  characters,
  getCharacterUnlockMessage,
  isCharacterUnlocked,
  type CharacterId,
} from "@/features/alchemy/shared/config/game-data-catalog";
import { HeroTooltip } from "../../shared/ui/tooltips/hero-tooltip";
import { TitledScreenShell } from "../../shared/ui/layout-components";
import { Surface } from "../../shared/ui/surface";
import { useChooserHover } from "../../shared/ui/use-chooser-hover";
import {
  cardInteractiveGlowClass,
  cardSurfaceClass,
  chooserHeroArtWidthClass,
  chooserHeroRowGapClass,
  chooserHeroRowShellWidthClass,
  chooserLockedHoverSurfaceClass,
  getCharacterShineColors,
  WILDCARD_KEYWORD_SHINE_COLORS,
} from "@/features/alchemy/shared/config";
import { playUISound } from "@/lib/audio";

const HERO_SHINE_CLASS =
  "z-20 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100";
// Explicit order preserves the current hero row; add new heroes here.
const CHARACTER_SELECT_ORDER: CharacterId[] = [
  "knight",
  "rogue",
  "ranger",
  "wizard",
  "alchemist",
  "warlock",
  "druid",
  "wildcard",
];

function HeroCardShine({ colors }: { colors: readonly string[] }) {
  if (colors.length === 0) return null;
  return <ShineBorder glow shineColor={colors} borderWidth={3} className={HERO_SHINE_CLASS} />;
}

const CharacterCard = memo(function CharacterCard({
  id,
  onSelect,
  isLocked,
  unlockRequirementText,
}: {
  id: CharacterId;
  onSelect: (id: CharacterId) => void;
  isLocked: boolean;
  unlockRequirementText: string;
}) {
  const {
    triggerRef,
    visible,
    onMouseEnter,
    onMouseLeave,
    onFocusCapture,
    onBlurCapture,
    shimmerActive,
    shimmerToken,
  } = useChooserHover("character-select", id, isLocked);
  const char = characters[id];
  const art = characterArt[char.id];
  const shineColors = id === "wildcard" ? WILDCARD_KEYWORD_SHINE_COLORS : getCharacterShineColors(id);

  return (
    <div className="flex min-w-0 flex-col items-center gap-2">
      <div
        ref={triggerRef}
        className={cn("relative min-w-0", chooserHeroArtWidthClass)}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onFocusCapture={onFocusCapture}
        onBlurCapture={onBlurCapture}
      >
        <Surface
          as="button"
          ariaLabel={isLocked ? `${char.name} (Locked)` : `Select ${char.name}`}
          ariaDisabled={isLocked}
          className={cn(
            "group relative w-full rounded-shell-tooltip border border-border/80 shadow-md",
            cardInteractiveGlowClass,
            "hero-affinity-shine",
          )}
          shimmerActive={shimmerActive}
          shimmerToken={shimmerToken}
          shimmerRounded="rounded-shell-tooltip"
          overlay={<HeroCardShine colors={shineColors} />}
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
              "aspect-[3/4] w-full rounded-shell-tooltip object-cover transition duration-300",
              isLocked && chooserLockedHoverSurfaceClass,
            )}
          />
        </Surface>
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
});

export function CharacterSelectScreen({
  onSelect,
  finishedRunCharacters,
  onBack,
  onMenu,
}: {
  onSelect: (characterId: CharacterId) => void;
  finishedRunCharacters: CharacterId[];
  onBack?: (() => void) | undefined;
  onMenu?: ((rect: DOMRect) => void) | undefined;
}) {
  return (
    <TitledScreenShell
      title="Choose Your Hero"
      maxWidthClass={chooserHeroRowShellWidthClass}
      onBack={onBack}
      onMenu={onMenu}
    >
      <div className={cn("mt-6 grid w-full grid-cols-4 justify-items-center gap-y-6", chooserHeroRowGapClass)}>
        {CHARACTER_SELECT_ORDER.map((id) => {
          const isLocked = !isCharacterUnlocked(id, finishedRunCharacters);
          const unlockRequirementText = isLocked ? getCharacterUnlockMessage(id) : "";

          return (
            <CharacterCard
              key={id}
              id={id}
              onSelect={onSelect}
              isLocked={isLocked}
              unlockRequirementText={unlockRequirementText}
            />
          );
        })}
      </div>
    </TitledScreenShell>
  );
}
