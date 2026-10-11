import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { readActiveRunScreen, readRunSession, readRunRevision } from "@/features/alchemy/shared/stores/run-reads";
import type { BattleSnapshot, CombatTextEvent } from "@/lib/battle";
import { createSeededRng } from "@/lib/rng";
import { createCombatProgress } from "./combat-policy";
import type { BrewingObservation } from "./brewing-offers";
import { createChoiceCatalog } from "./choice-catalog";
import { createPlaythroughController } from "./controller";
import { offerMetaChoices } from "./meta-offers";
import { offerRunChoices } from "./run-offers";
import type { CareerConfig, PlayerChoice } from "./types";

export function createCareerActor(
  config: CareerConfig,
  recordBattle: (state: BattleSnapshot, texts: CombatTextEvent[], card?: string) => void = () => {},
  gameSession: GameSession,
) {
  const controller = createPlaythroughController(gameSession);
  const { flow } = controller;
  const craftingRandom = createSeededRng(config.seed ^ 0x193ac);
  const crafted = new Set<string>();
  const catalog = createChoiceCatalog();
  const combatProgress = createCombatProgress();
  const { offer } = catalog;
  let brewingObservation: BrewingObservation | null = null;
  function observe(): PlayerChoice[] {
    brewingObservation = null;
    const choices = catalog.beginObservation();
    const session = readRunSession(gameSession);
    const screen = readActiveRunScreen(gameSession);
    if (screen === "game-over" || screen === "run-victory") {
      offer("continue-run-end", screen, 1, flow.continueFromRunEnd);
      return choices;
    }
    if (screen === "difficulty-select") {
      offer("difficulty", config.difficulty, 1, () => flow.handleDifficultySelect(config.difficulty));
      return choices;
    }
    if (!session.hasActiveRun) {
      offerMetaChoices({ config, flow, offer, crafted, craftingRandom }, gameSession);
      return choices;
    }
    offerRunChoices(
      {
        config,
        controller,
        offer,
        choices,
        recordBattle,
        defenseOnlyTurns: combatProgress.defenseOnlyTurns(),
        recordBrewing: (observation) => {
          brewingObservation = observation;
        },
      },
      gameSession,
    );
    return choices;
  }
  return {
    observe,
    brewingObservation: () => brewingObservation,
    execute(choice: PlayerChoice) {
      const before = controller.battle.read().battleState;
      const revision = readRunRevision(gameSession);
      const result = catalog.execute(choice);
      if (revision !== readRunRevision(gameSession))
        combatProgress.committed(before, controller.battle.read().battleState, choice);
      return result;
    },
  };
}
