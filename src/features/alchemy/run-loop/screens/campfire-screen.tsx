import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TitledScreenShell } from "../../shared/ui/layout-components";
import { campfire } from "@/features/alchemy/shared/config/game-data-catalog";
import { getCampfireRestHealth } from "@/lib/campfire-heal";
import type { BattleCard } from "@/lib/game-data";
import type { AlchemyVisit } from "@/lib/active-run-session/alchemy-visits";
import { getCampfireBrewKind, type BrewOperation } from "@/lib/alchemist/brewing";
import { SelectableCard } from "../../shared/ui/cards/selectable-card";
import { HealthRestoreMeter } from "../../shared/ui/health-restore-meter";
import { useEasedHealth } from "../../shared/ui/use-eased-health";
import { BrewPotionPanel } from "./brew-potion-panel";
import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import { LABYRINTH_MODIFIER_CONFIG } from "@/lib/game-constants";

export function CampfireScreen({
  playerHealth,
  maxHealth,
  healFraction,
  healingBonus = 0,
  modifiers = [],
  runDeck,
  visit,
  potency,
  onRest,
  onBrew,
  onContinue,
}: {
  playerHealth: number;
  maxHealth: number;
  healFraction: number;
  healingBonus?: number;
  modifiers?: readonly EncounterRewardTraitId[];
  runDeck: BattleCard[];
  visit: AlchemyVisit;
  potency: number;
  onRest: () => boolean;
  onBrew: (operation: BrewOperation) => BattleCard | null;
  onContinue: () => void;
}) {
  const [brewing, setBrewing] = useState(false);
  const [rest, setRest] = useState<{ from: number; to: number } | null>(null);
  const [error, setError] = useState("");
  const { displayHealth, progressHealth } = useEasedHealth({
    from: rest?.from ?? playerHealth,
    to: rest?.to ?? playerHealth,
    active: rest !== null,
  });
  const restore = getCampfireRestHealth(playerHealth, maxHealth, healFraction, healingBonus) - playerHealth;
  const brewKind = getCampfireBrewKind(runDeck);
  return (
    <TitledScreenShell title="Campfire">
      <div className="mt-6 flex flex-col items-center gap-6 text-center">
        {visit.completed ? (
          <>
            {visit.result ? (
              <>
                <SelectableCard card={visit.result} isSelected chrome="shop" onSelect={() => {}} />
              </>
            ) : (
              <>
                {modifiers.includes("hidden-purse") && (
                  <p role="status">{LABYRINTH_MODIFIER_CONFIG.hiddenPurseGold} Gold added to your purse.</p>
                )}
                {modifiers.includes("herbal-hearth") && (
                  <p role="status">A random Potion was added to your run deck.</p>
                )}
                <HealthRestoreMeter
                  displayHealth={displayHealth}
                  maxHealth={maxHealth}
                  progressHealth={progressHealth}
                />
              </>
            )}
            <Button onClick={onContinue}>Continue</Button>
          </>
        ) : brewing ? (
          <>
            <BrewPotionPanel
              key={brewKind}
              kind={brewKind}
              deck={runDeck}
              offers={visit.offers}
              potency={potency}
              onConfirm={onBrew}
              onBack={() => setBrewing(false)}
            />
          </>
        ) : (
          <>
            <img src={campfire} alt="Campfire" className="w-full max-w-lg rounded-shell-panel object-contain" />
            <div className="flex flex-wrap justify-center gap-4">
              <Button
                onClick={() => {
                  const from = playerHealth;
                  const to = playerHealth + restore;
                  if (onRest()) setRest({ from, to });
                  else setError("This Campfire has already been used.");
                }}
              >
                Rest
              </Button>
              <Button onClick={() => setBrewing(true)}>Brew Potion</Button>
            </div>
          </>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
    </TitledScreenShell>
  );
}
