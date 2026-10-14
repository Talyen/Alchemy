import { useLayoutEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { characterArt, characters, type CharacterId } from "@/features/alchemy/shared/config/game-data-catalog";
import { getPlasmaColorPairForCharacter } from "@/features/alchemy/shared/config";
import { TitledScreenShell } from "../../shared/ui/layout-components";
import { focusControl } from "../../shared/ui/focus-navigation";
import { usePlasmaBaseline } from "../../shared/ui/use-plasma-source";
import { useArtworkReady } from "../../shared/ui/use-artwork-ready";
import { useHoverVisible } from "../../shared/ui/use-hover-visible";
import { HeroTooltip } from "../../shared/ui/tooltips/hero-tooltip";

export function HeroUnlockedScreen({
  characterId,
  onContinue,
  continueLabel,
}: {
  characterId: CharacterId;
  onContinue: () => void;
  continueLabel: "Continue" | "Main Menu";
}) {
  const button = useRef<HTMLButtonElement>(null);
  const { ref: portraitRef, pending: portraitPending } = useArtworkReady(characterId);
  const { triggerRef, visible, onMouseEnter, onMouseLeave, onFocusCapture, onBlurCapture } =
    useHoverVisible<HTMLButtonElement>();
  usePlasmaBaseline(getPlasmaColorPairForCharacter(characterId));
  useLayoutEffect(() => {
    focusControl(button.current);
  }, [characterId]);

  return (
    <TitledScreenShell title="Hero Unlocked">
      <div className="mt-8 flex flex-col items-center gap-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <button
            key={characterId}
            ref={triggerRef}
            type="button"
            aria-label={`Inspect ${characters[characterId].name}`}
            onClick={onMouseEnter}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onFocusCapture={onFocusCapture}
            onBlurCapture={onBlurCapture}
            className="relative w-96 max-w-full rounded-shell-tooltip focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-pale"
          >
            <div ref={portraitRef} data-artwork-pending={portraitPending} className="hero-unlock-portrait w-full">
              <img
                src={characterArt[characterId]}
                alt={characters[characterId].name}
                decoding="async"
                className="aspect-[3/4] w-full rounded-shell-tooltip border border-gold-pale/40 object-cover shadow-xl"
              />
            </div>
            {visible ? (
              <HeroTooltip
                character={characters[characterId]}
                isLocked={false}
                unlockRequirementText=""
                triggerRef={triggerRef}
                placement="below"
                visible
              />
            ) : null}
          </button>
          <h2 className="font-sans text-3xl font-bold text-gold-pale">{characters[characterId].name}</h2>
        </div>
        <Button ref={button} size="lg" variant="primary" className="min-w-56" onClick={onContinue}>
          {continueLabel}
        </Button>
      </div>
    </TitledScreenShell>
  );
}
