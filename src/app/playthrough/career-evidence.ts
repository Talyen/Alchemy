import { createEmptyAnomalies, sampleAnomalies } from "@/lib/balance/anomalies";
import {
  readActiveRun,
  readActiveRunScreen,
  readBattle,
  readRunProfile,
  readRunSession,
} from "@/features/alchemy/shared/stores/run-reads";
import { snapshotBattle, snapshotRunProgress } from "./telemetry";
import type { CareerConfig, CareerResult, PlayerChoice } from "./types";

export function createCareerResult(config: CareerConfig, initialSave: CareerResult["initialSave"]): CareerResult {
  return {
    version: 1,
    config,
    cohort: config.initialSave || config.diagnosticFault ? "targeted" : "fresh-save",
    status: "incomplete",
    initialSave,
    finalSave: initialSave,
    journal: [],
    outcomes: [],
    coverage: {},
    elapsedMs: 0,
    timings: { observationMs: 0, actionMs: 0, validationMs: 0, persistenceMs: 0 },
    saveChecks: 0,
    resumeChecks: 0,
    telemetry: {
      anomalies: createEmptyAnomalies(),
      cards: {},
      economy: [],
      runSnapshots: [],
      battleSnapshots: [],
      battles: [],
      milestones: {},
    },
  };
}

export function sampleCareerBattle(
  result: CareerResult,
  state: Parameters<typeof sampleAnomalies>[0],
  texts: Parameters<typeof sampleAnomalies>[1],
  card?: Parameters<typeof sampleAnomalies>[3],
) {
  sampleAnomalies(state, texts, result.telemetry.anomalies, card);
}

export function recordBattleStart(
  result: CareerResult,
  step: number,
  completed: number,
  observedBattleKeys: Set<string>,
) {
  const activeBattle = readBattle();
  if (!activeBattle.hasActiveBattle) return;
  const activeRun = readActiveRun();
  const state = activeBattle.battleState;
  const battleKey = `${completed}:${activeRun.roomsEncountered}:${state.currentEnemy.id}`;
  if (observedBattleKeys.has(battleKey)) return;
  observedBattleKeys.add(battleKey);
  result.telemetry.battleSnapshots.push(snapshotBattle(step, completed, activeRun.roomsEncountered, "start", state));
}

export function recordObservation(result: CareerResult, options: PlayerChoice[]) {
  const activeBattle = readBattle();
  if (!activeBattle.hasActiveBattle) return;
  const state = activeBattle.battleState;
  sampleAnomalies(state, [], result.telemetry.anomalies);
  for (const card of state.hand) {
    const counts = (result.telemetry.cards[card.id] ??= { observed: 0, playable: 0, chosen: 0 });
    counts.observed++;
  }
  for (const option of options.filter((option) => option.kind === "play"))
    result.telemetry.cards[option.id]!.playable++;
}

export function recordChosenAction(result: CareerResult, step: number, completed: number, choice: PlayerChoice) {
  if (choice.kind === "play") result.telemetry.cards[choice.id]!.chosen++;
  if (choice.kind !== "settle") return;
  const state = readBattle().battleState;
  const room = readActiveRun().roomsEncountered;
  result.telemetry.battleSnapshots.push(snapshotBattle(step, completed, room, "settle", state));
  result.telemetry.battles.push({
    enemy: state.currentEnemy.id,
    boss: state.currentEnemy.enemyType === "boss",
    outcome: choice.id,
    turns: state.turn,
    run: completed,
    room,
  });
}

export function recordCommittedAction(
  result: CareerResult,
  step: number,
  completed: number,
  choice: PlayerChoice,
  maxTurns: number,
) {
  result.coverage[choice.kind] = (result.coverage[choice.kind] ?? 0) + 1;
  const run = readActiveRun();
  const profile = readRunProfile();
  const session = readRunSession();
  for (const value of [
    profile.gold,
    run.runPlayerHealth,
    run.runMaxHealth,
    ...Object.values(profile.materialInventory),
  ]) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`Invariant: invalid resource ${value}`);
  }
  if (session.rewardFlow.claim.kind !== "idle") throw new Error("Invariant: orphaned reward/destination claim");
  if (readBattle().hasActiveBattle && readBattle().battleState.turn > maxTurns)
    throw new Error("Incomplete: battle turn budget exhausted");

  if (!["play", "wish", "end-turn"].includes(choice.kind)) {
    const materials = Object.values(profile.materialInventory).reduce((a, b) => a + b, 0);
    result.telemetry.runSnapshots.push(
      snapshotRunProgress(
        step,
        completed,
        run,
        profile.gold,
        materials,
        Object.values(profile.unlockedTalents).reduce((sum, ids) => sum + ids.length, 0),
      ),
    );
    result.telemetry.economy.push({
      step,
      run: completed,
      act: run.currentAct,
      rooms: run.roomsEncountered,
      gold: profile.gold,
      health: run.runPlayerHealth,
      materials,
      deckSize: run.runDeck.length,
    });
  }
  if (
    ["building", "farm", "research", "bond", "talent", "equip", "equip-trinket", "craft", "salvage"].includes(
      choice.kind,
    )
  )
    result.telemetry.milestones[`${choice.kind}:${choice.id}`] ??= completed;
  const battleState = readBattle().battleState;
  for (const value of [
    battleState.playerHealth,
    battleState.enemyHealth,
    battleState.mana,
    ...Object.values(battleState.playerStatuses),
    ...Object.values(battleState.enemyStatuses),
  ]) {
    if (!Number.isFinite(value)) throw new Error("Invariant: non-finite battle state");
  }
  return { run, profile };
}

export function recordRunOutcome(
  result: CareerResult,
  step: number,
  choice: PlayerChoice,
  { run, profile }: ReturnType<typeof recordCommittedAction>,
) {
  const screen = readActiveRunScreen();
  if (screen !== "game-over" && screen !== "run-victory") return;
  result.outcomes.push({
    outcome: choice.kind === "horizon" ? "horizon" : screen === "run-victory" ? "victory" : "defeat",
    rooms: run.roomsEncountered,
    gold: profile.gold,
    steps: step + 1,
  });
}
