import { useLayoutEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { characterArt, characters, type CharacterId } from "@/features/alchemy/shared/config/game-data-catalog";
import { getPlasmaColorPair, getPlasmaKeywordsForCharacter } from "@/features/alchemy/shared/config";
import { TitledScreenShell } from "../../shared/ui/layout-components";
import { focusControl } from "../../shared/ui/focus-navigation";
import { usePlasmaBaseline } from "../../shared/ui/use-plasma-source";

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
  usePlasmaBaseline(getPlasmaColorPair(getPlasmaKeywordsForCharacter(characterId)));
  useLayoutEffect(() => {
    focusControl(button.current);
  }, [characterId]);

  return (
    <TitledScreenShell title="Hero Unlocked">
      <div className="mt-6 flex flex-col items-center gap-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <img
            src={characterArt[characterId]}
            alt={characters[characterId].name}
            className="aspect-[3/4] w-96 max-w-full rounded-shell-tooltip border border-gold-pale/40 object-cover shadow-xl"
          />
          <h2 className="font-sans text-3xl font-bold text-gold-pale">{characters[characterId].name}</h2>
        </div>
        <Button ref={button} size="lg" variant="primary" className="min-w-56" onClick={onContinue}>
          {continueLabel}
        </Button>
      </div>
    </TitledScreenShell>
  );
}
