import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TitledScreenShell } from "../../shared/ui/layout-components";
import { campfire } from "@/features/alchemy/shared/config/game-data-catalog";
import { getCampfireRestHealth } from "@/lib/campfire-heal";
import type { BattleCard } from "@/lib/game-data";
import type { AlchemyVisit } from "@/lib/active-run-session/alchemy-visits";
import type { BrewOperation } from "@/lib/alchemist/brewing";
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
  return (
    <TitledScreenShell title="Campfire">
      <div className="mt-6 flex flex-col items-center gap-6 text-center">
        {visit.completed ? (
          <>
            {visit.result ? (
              <>
                <p role="status">Potion brewed and added to your run deck.</p>
                <SelectableCard card={visit.result} isSelected chrome="shop" onSelect={() => {}} />
              </>
            ) : (
              <>
                <p role="status">Rest complete.</p>
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
              deck={runDeck}
              offers={visit.offers}
              potency={potency}
              onConfirm={onBrew}
              onBack={() => setBrewing(false)}
            />
            <p>Brewing replaces Rest at this Campfire.</p>
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
                Rest · Recover {restore} Health
              </Button>
              <Button onClick={() => setBrewing(true)}>Brew Potion</Button>
            </div>
            {restore === 0 && <p>Health is full. Rest restores no Health.</p>}
            {modifiers.includes("hidden-purse") && (
              <p>Rest also grants {LABYRINTH_MODIFIER_CONFIG.hiddenPurseGold} Gold.</p>
            )}
            {modifiers.includes("herbal-hearth") && <p>Rest also adds a random Potion to your run deck.</p>}
            <p>Rest or brew one Potion. Each Campfire can be used once.</p>
          </>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
    </TitledScreenShell>
  );
}
