import { defaultGameSession } from "@/features/alchemy/shared/stores/default-game-session";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { readActiveRunScreen, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import type { BattleSnapshot, CombatTextEvent } from "@/lib/battle";
import { createSeededRng } from "@/lib/rng";
import { createChoiceCatalog } from "./choice-catalog";
import { createPlaythroughController } from "./controller";
import { offerMetaChoices } from "./meta-offers";
import { offerRunChoices } from "./run-offers";
import type { CareerConfig, PlayerChoice } from "./types";

export function createCareerActor(
  config: CareerConfig,
  recordBattle: (state: BattleSnapshot, texts: CombatTextEvent[], card?: string) => void = () => {},
  gameSession: GameSession = defaultGameSession,
) {
  const controller = createPlaythroughController(gameSession);
  const { flow } = controller;
  const craftingRandom = createSeededRng(config.seed ^ 0x193ac);
  const crafted = new Set<string>();
  const catalog = createChoiceCatalog();
  const { offer } = catalog;
  function observe(): PlayerChoice[] {
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
    offerRunChoices({ config, controller, offer, choices, recordBattle }, gameSession);
    return choices;
  }
  return { observe, execute: (choice: PlayerChoice) => catalog.execute(choice) };
}
