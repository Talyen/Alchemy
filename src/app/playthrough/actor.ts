import { readRunSession, readActiveRunScreen } from "@/features/alchemy/shared/stores/run-reads";
import type { BattleSnapshot, CombatTextEvent } from "@/lib/battle";
import { createSeededRng } from "@/lib/rng";
import type { CareerConfig, PlayerChoice } from "./types";
import { createPlaythroughController } from "./controller";
import { createChoiceCatalog } from "./choice-catalog";
import { offerMetaChoices } from "./meta-offers";
import { offerRunChoices } from "./run-offers";

export function createCareerActor(
  config: CareerConfig,
  recordBattle: (state: BattleSnapshot, texts: CombatTextEvent[], card?: string) => void = () => {},
) {
  const controller = createPlaythroughController();
  const { flow } = controller;
  const craftingRandom = createSeededRng(config.seed ^ 0x193ac);
  const crafted = new Set<string>();
  const catalog = createChoiceCatalog();
  const { offer } = catalog;
  function observe(): PlayerChoice[] {
    const choices = catalog.beginObservation();
    const session = readRunSession();
    const screen = readActiveRunScreen();
    if (screen === "game-over" || screen === "run-victory") {
      offer("continue-run-end", screen, 1, flow.continueFromRunEnd);
      return choices;
    }
    if (screen === "difficulty-select") {
      offer("difficulty", config.difficulty, 1, () => flow.handleDifficultySelect(config.difficulty));
      return choices;
    }
    if (!session.hasActiveRun) {
      offerMetaChoices({ config, flow, offer, crafted, craftingRandom });
      return choices;
    }
    offerRunChoices({ config, controller, offer, choices, recordBattle });
    return choices;
  }
  return { observe, execute: (choice: PlayerChoice) => catalog.execute(choice) };
}
