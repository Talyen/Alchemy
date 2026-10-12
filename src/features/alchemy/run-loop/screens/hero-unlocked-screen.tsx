import { useLayoutEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { characterArt, characters, type CharacterId } from "@/features/alchemy/shared/config/game-data-catalog";
import { getPlasmaColorPair, getPlasmaKeywordsForCharacter } from "@/features/alchemy/shared/config";
import { TitledScreenShell } from "../../shared/ui/layout-components";
import { focusControl } from "../../shared/ui/focus-navigation";
import { usePlasmaBaseline } from "../../shared/ui/use-plasma-source";
import { useArtworkReady } from "../../shared/ui/use-artwork-ready";

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
  usePlasmaBaseline(getPlasmaColorPair(getPlasmaKeywordsForCharacter(characterId)));
  useLayoutEffect(() => {
    focusControl(button.current);
  }, [characterId]);

  return (
    <TitledScreenShell title="Hero Unlocked">
      <div className="mt-8 flex flex-col items-center gap-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <div
            key={characterId}
            ref={portraitRef}
            data-artwork-pending={portraitPending}
            className="hero-unlock-portrait w-96 max-w-full"
          >
            <img
              src={characterArt[characterId]}
              alt={characters[characterId].name}
              className="aspect-[3/4] w-full rounded-shell-tooltip border border-gold-pale/40 object-cover shadow-xl"
            />
          </div>
          <h2 className="font-sans text-3xl font-bold text-gold-pale">{characters[characterId].name}</h2>
        </div>
        <Button ref={button} size="lg" variant="primary" className="min-w-56" onClick={onContinue}>
          {continueLabel}
        </Button>
      </div>
    </TitledScreenShell>
  );
}
