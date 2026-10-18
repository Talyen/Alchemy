import { GameMessage } from "@/components/localization";
import { useGameTranslation } from "@/components/use-game-translation";
import { useState } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TitledScreenShell } from "../../shared/ui/layout-components";
import { cn } from "@/lib/utils";
import { campfire, keywordDefinitions } from "@/features/alchemy/shared/config/game-data-catalog";
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
  onRest,
  onBrew,
  onContinue,
  afterProgressSaved = (feedback) => feedback(),
  isProgressSavePending = () => false,
}: {
  playerHealth: number;
  maxHealth: number;
  healFraction: number;
  healingBonus?: number;
  modifiers?: readonly EncounterRewardTraitId[];
  runDeck: BattleCard[];
  visit: AlchemyVisit;
  onRest: () => boolean;
  onBrew: (operation: BrewOperation) => BattleCard | null;
  onContinue: () => void;
  afterProgressSaved?: (feedback: () => void) => void;
  isProgressSavePending?: () => boolean;
}) {
  const i18n = useGameTranslation();
  const [brewing, setBrewing] = useState(false);
  const [rest, setRest] = useState<{ from: number; to: number; saved: boolean } | null>(null);
  const [error, setError] = useState(false);
  const { displayHealth, progressHealth } = useEasedHealth({
    from: rest?.from ?? playerHealth,
    to: rest?.to ?? playerHealth,
    active: rest?.saved ?? false,
  });
  const restore = getCampfireRestHealth(playerHealth, maxHealth, healFraction, healingBonus) - playerHealth;
  const brewKind = getCampfireBrewKind(runDeck);
  return (
    <TitledScreenShell title={i18n.text("ui.campfire-screen.1", "Campfire")}>
      <div className="mt-6 flex flex-col items-center gap-6 text-center">
        {visit.completed ? (
          <>
            {visit.result ? (
              <>
                <p>
                  <GameMessage
                    id="ui.campfire-screen.s1"
                    defaultValue="You received <part0/>"
                    parts={{ part0: <strong>{i18n.displayText(visit.result.title)}</strong> }}
                  />
                </p>
                <SelectableCard card={visit.result} isSelected chrome="shop" onSelect={() => {}} />
              </>
            ) : (
              <>
                {modifiers.includes("hidden-purse") && (
                  <p role="status">
                    <GameMessage
                      id="ui.campfire-screen.s2"
                      defaultValue="<part0/> Gold added to your purse."
                      parts={{ part0: i18n.displayText(LABYRINTH_MODIFIER_CONFIG.hiddenPurseGold) }}
                    />
                  </p>
                )}
                {modifiers.includes("herbal-hearth") && (
                  <p role="status">
                    {i18n.text("ui.campfire-screen.4", "A random Potion was added to your run deck.")}
                  </p>
                )}
                <HealthRestoreMeter
                  displayHealth={displayHealth}
                  maxHealth={maxHealth}
                  progressHealth={progressHealth}
                />
              </>
            )}
            <Button onClick={onContinue}>
              {i18n.displayText(
                visit.result
                  ? i18n.text("ui.campfire-screen.d1", "Loot")
                  : i18n.text("ui.campfire-screen.d2", "Continue"),
              )}
            </Button>
          </>
        ) : brewing ? (
          <>
            <BrewPotionPanel
              key={brewKind}
              kind={brewKind}
              deck={runDeck}
              offers={visit.offers}
              onConfirm={onBrew}
              isProgressSavePending={isProgressSavePending}
              onBack={() => setBrewing(false)}
            />
          </>
        ) : (
          <>
            <img
              src={campfire}
              alt={i18n.text("ui.campfire-screen.5", "Campfire")}
              decoding="async"
              className="w-full max-w-lg rounded-shell-panel object-contain"
            />
            <HealthRestoreMeter displayHealth={playerHealth} maxHealth={maxHealth} progressHealth={playerHealth} />
            <div className="flex flex-wrap justify-center gap-4">
              <div className="flex flex-col items-center gap-2">
                <Button
                  aria-describedby="campfire-rest-recovery"
                  onClick={() => {
                    if (isProgressSavePending()) return;
                    const from = playerHealth;
                    const to = playerHealth + restore;
                    if (onRest()) {
                      setRest({ from, to, saved: false });
                      afterProgressSaved(() => setRest({ from, to, saved: true }));
                    } else setError(true);
                  }}
                >
                  {i18n.text("ui.campfire-screen.6", "Rest")}
                </Button>
                <p
                  id="campfire-rest-recovery"
                  className={cn(
                    "flex items-center gap-1.5 font-semibold tabular-nums",
                    keywordDefinitions.health.colorClass,
                  )}
                >
                  <Heart aria-hidden="true" className="size-5 fill-current" />
                  {i18n.displayText(restore)}
                  <span className="sr-only">{i18n.text("ui.campfire-screen.7", " Health")}</span>
                </p>
              </div>
              <Button onClick={() => setBrewing(true)}>{i18n.text("ui.campfire-screen.8", "Brew Potion")}</Button>
            </div>
          </>
        )}
        {error && <p role="alert">{i18n.displayText("This Campfire has already been used.")}</p>}
      </div>
    </TitledScreenShell>
  );
}
