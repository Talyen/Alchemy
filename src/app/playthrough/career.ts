import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { addGold } from "@/features/alchemy/shared/stores/run-session-write-port";
import { characters, DIFFICULTY_ORDER } from "@/lib/game-data";
import { isDeepStrictEqual } from "node:util";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { createEmptyAnomalies, sampleAnomalies } from "@/lib/balance/anomalies";
import { createCareerActor } from "./actor";
import type { CareerConfig, CareerResult, JournalEntry } from "./types";
import { createDefaultSaveData } from "@/features/alchemy/shared/storage";
import { configureSaveBackend, loadAlchemySaveState } from "@/features/alchemy/shared/storage";
import { hydrateAlchemyPersistenceFields, buildAlchemySaveDataFromStores } from "@/features/alchemy/shared/storage";
import { evaluateSaveCandidates } from "@/features/alchemy/shared/storage";
import { restoreRun, resolveActiveRunForSave } from "@/features/alchemy/shared/stores/run-lifecycle";
import {
  selectAutosaveAllowed,
  readRunRevision,
  readActiveRun,
  readRunProfile,
  readRunSession,
  readBattle,
  readActiveRunScreen,
  readHasActiveRun,
} from "@/features/alchemy/shared/stores/run-reads";
import { setTestRunSeedOverride } from "@/features/alchemy/shared/stores/run-state-init";
import { createSeededRng } from "@/lib/rng";
import { createAlchemyAutosaveLifecycle } from "../autosave-lifecycle";
import { snapshotBattle, snapshotRunProgress } from "./telemetry";

export function snapshotCareer() {
  return buildAlchemySaveDataFromStores(resolveActiveRunForSave(readHasActiveRun()));
}
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, entry: unknown) =>
    entry && typeof entry === "object" && !Array.isArray(entry)
      ? Object.fromEntries(Object.entries(entry).sort(([left], [right]) => left.localeCompare(right)))
      : entry,
  );
}
export function stateDigest() {
  return createHash("sha256")
    .update(
      canonicalJson({
        save: snapshotCareer(),
        screen: readActiveRunScreen(),
        claim: readRunSession().rewardFlow.claim,
      }),
    )
    .digest("hex");
}
export async function runCareer(
  config: CareerConfig,
  onJournal: (entry: JournalEntry) => void = () => {},
  replay?: JournalEntry[],
  checkpoint?: { at: number; save: (bytes: string) => void },
): Promise<CareerResult> {
  if (
    !Object.hasOwn(characters, config.hero) ||
    !["campaign", "wildwood", "labyrinth"].includes(config.mode) ||
    !DIFFICULTY_ORDER.includes(config.difficulty) ||
    !["archetype", "random", "minimalist"].includes(config.policy) ||
    !["greedy-effective-damage", "greedy-damage", "random-playable", "defensive-random"].includes(config.combatPolicy)
  )
    throw new Error("Invalid scenario configuration");
  for (const value of [config.runs, config.horizon, config.maxSteps, config.maxTurns])
    if (!Number.isSafeInteger(value) || value < 1) throw new Error("Scenario budgets must be positive integers");
  if (!Number.isSafeInteger(config.seed) || config.seed < 0 || config.seed > 0xffffffff)
    throw new Error("Seed must be an unsigned 32-bit integer");
  const started = performance.now();
  let bytes: string | null = null;
  configureSaveBackend({
    readCandidates() {
      return Promise.resolve({ ok: true, candidates: bytes ? [bytes] : [] });
    },
    write(_key, value) {
      bytes = value;
      return Promise.resolve({ ok: true });
    },
    writeSync(_key, value) {
      bytes = value;
      return { ok: true };
    },
    clear() {
      bytes = null;
      return Promise.resolve({ ok: true });
    },
  });
  setTestRunSeedOverride(config.seed);
  const initialSave = config.initialSave ?? createDefaultSaveData();
  bytes = JSON.stringify(initialSave);
  const loaded = await loadAlchemySaveState();
  if (loaded.status.kind !== "ok" || loaded.status.warnings?.length)
    throw new Error(`Initial save invalid: ${JSON.stringify(loaded.status)}`);
  hydrateAlchemyPersistenceFields(loaded.data);
  restoreRun(loaded.data.activeRun, loaded.data.talentXP, loaded.data.unlockedTalents);
  // Deliberate checkpoints flush explicitly. No machine-speed timer may save
  // before a requested interruption; the worker controls the simulation clock.
  let timerId = 0;
  const timers = new Set<number>();
  const autosaveAllowed = () => selectAutosaveAllowed({ battle: readBattle() }, readActiveRunScreen());
  const lifecycle = createAlchemyAutosaveLifecycle(autosaveAllowed, {
    now: () => 1_800_000_000_000,
    setTimeout: () => {
      const id = ++timerId;
      timers.add(id);
      return id;
    },
    clearTimeout: (id) => {
      if (typeof id === "number") timers.delete(id);
    },
  });
  const anomalies = createEmptyAnomalies();
  const actor = createCareerActor(config, (state, texts, card) => sampleAnomalies(state, texts, anomalies, card));
  const random = createSeededRng(config.seed ^ 0x71ab83);
  const result: CareerResult = {
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
      anomalies,
      cards: {},
      economy: [],
      runSnapshots: [],
      battleSnapshots: [],
      battles: [],
      milestones: {},
    },
  };
  let completed = 0;
  let policyDraws = 0;
  const observedBattleKeys = new Set<string>();
  try {
    for (let step = 0; step < config.maxSteps; step++) {
      setTestRunSeedOverride((config.seed + completed) >>> 0);
      const observationStarted = performance.now();
      const before = stateDigest();
      const activeBattle = readBattle();
      if (activeBattle.hasActiveBattle) {
        const activeRun = readActiveRun();
        const state = activeBattle.battleState;
        const battleKey = `${completed}:${activeRun.roomsEncountered}:${state.currentEnemy.id}`;
        if (!observedBattleKeys.has(battleKey)) {
          observedBattleKeys.add(battleKey);
          result.telemetry.battleSnapshots.push(
            snapshotBattle(step, completed, activeRun.roomsEncountered, "start", state),
          );
        }
      }
      const options = actor.observe();
      if (stateDigest() !== before) throw new Error("Invariant: observation mutated gameplay or RNG");
      if (readBattle().hasActiveBattle) {
        sampleAnomalies(readBattle().battleState, [], anomalies);
        for (const card of readBattle().battleState.hand) {
          const counts = (result.telemetry.cards[card.id] ??= { observed: 0, playable: 0, chosen: 0 });
          counts.observed++;
        }
        for (const option of options.filter((option) => option.kind === "play"))
          result.telemetry.cards[option.id]!.playable++;
      }
      result.timings.observationMs += performance.now() - observationStarted;
      const recorded = replay?.[step];
      if (replay && !recorded) throw new Error(`Replay journal exhausted at ${step}`);
      const best = Math.max(...options.map((option) => option.score));
      const randomChoice = config.policy === "random" && options[0]?.kind !== "play";
      const preferred = randomChoice ? options : options.filter((option) => option.score === best);
      if (!recorded) policyDraws++;
      const choice = recorded?.action ?? preferred[Math.floor(random() * preferred.length)];
      if (!choice) throw new Error("Policy produced no choice");
      if (choice.kind === "play") result.telemetry.cards[choice.id]!.chosen++;
      if (choice.kind === "settle") {
        const state = readBattle().battleState;
        result.telemetry.battleSnapshots.push(
          snapshotBattle(step, completed, readActiveRun().roomsEncountered, "settle", state),
        );
        result.telemetry.battles.push({
          enemy: state.currentEnemy.id,
          boss: state.currentEnemy.enemyType === "boss",
          outcome: choice.id,
          turns: state.turn,
          run: completed,
          room: readActiveRun().roomsEncountered,
        });
      }
      const entry: JournalEntry = {
        action: choice,
        before,
        step,
        beforeRevision: readRunRevision(),
        policyDraws: recorded?.policyDraws ?? policyDraws,
      };
      result.journal.push(entry);
      onJournal(entry); // Persist the attempt before executing; a watchdog kill retains it.
      if (recorded && recorded.before !== before) throw new Error(`Replay divergence before action ${step}`);
      try {
        if (config.diagnosticFault?.at === step) {
          const fault = config.diagnosticFault;
          dispatchRunSessionCommand(
            (draft) => {
              addGold(draft, 1);
              if (fault.stage === "execution") throw new Error("Controlled execution failure");
            },
            {
              afterCommit: () => {
                throw new Error("Controlled post-commit failure");
              },
            },
          );
        }
        if (choice.kind === "continue-run-end") setTestRunSeedOverride((config.seed + completed + 1) >>> 0);
        const actionStarted = performance.now();
        actor.execute(choice);
        result.timings.actionMs += performance.now() - actionStarted;
        entry.after = stateDigest();
        entry.afterRevision = readRunRevision();
      } catch (error) {
        entry.error = String(error);
        entry.after = stateDigest();
        entry.afterRevision = readRunRevision();
        entry.stage = entry.afterRevision === entry.beforeRevision ? "execution" : "post-commit";
        onJournal(entry);
        throw error;
      }
      onJournal(entry);
      if (recorded && recorded.after !== entry.after) throw new Error(`Replay divergence after action ${step}`);
      if (before === entry.after) throw new Error(`Policy action made no progress: ${choice.kind}`);
      result.coverage[choice.kind] = (result.coverage[choice.kind] ?? 0) + 1;
      const run = readActiveRun(),
        profile = readRunProfile(),
        session = readRunSession();
      for (const value of [
        profile.gold,
        run.runPlayerHealth,
        run.runMaxHealth,
        ...Object.values(profile.materialInventory),
      ]) {
        if (!Number.isFinite(value) || value < 0) throw new Error(`Invariant: invalid resource ${value}`);
      }
      if (session.rewardFlow.claim.kind !== "idle") throw new Error("Invariant: orphaned reward/destination claim");
      if (readBattle().hasActiveBattle && readBattle().battleState.turn > config.maxTurns)
        throw new Error("Incomplete: battle turn budget exhausted");
      if (!["play", "wish", "end-turn"].includes(choice.kind))
        result.telemetry.runSnapshots.push(
          snapshotRunProgress(
            step,
            completed,
            run,
            profile.gold,
            Object.values(profile.materialInventory).reduce((a, b) => a + b, 0),
            Object.values(profile.unlockedTalents).reduce((sum, ids) => sum + ids.length, 0),
          ),
        );
      if (!["play", "wish", "end-turn"].includes(choice.kind))
        result.telemetry.economy.push({
          step,
          run: completed,
          act: run.currentAct,
          rooms: run.roomsEncountered,
          gold: profile.gold,
          health: run.runPlayerHealth,
          materials: Object.values(profile.materialInventory).reduce((a, b) => a + b, 0),
          deckSize: run.runDeck.length,
        });
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
      const validationStarted = performance.now();
      const save = snapshotCareer();
      const check = evaluateSaveCandidates([JSON.stringify({ ...save, lastSavedAt: 1 })]);
      if (check.status.kind !== "ok" || check.status.warnings?.length)
        throw new Error(`Invariant: save repair ${JSON.stringify(check.status)}`);
      result.finalSave = save;
      result.saveChecks++;
      result.timings.validationMs += performance.now() - validationStarted;
      const persistenceStarted = performance.now();
      await lifecycle.drain();
      result.timings.persistenceMs += performance.now() - persistenceStarted;
      if (!bytes) throw new Error("Invariant: production autosave was not acknowledged");
      const written = JSON.parse(bytes) as Record<string, unknown>;
      delete written.lastSavedAt;
      if ((autosaveAllowed() || !readHasActiveRun()) && !isDeepStrictEqual(written, JSON.parse(JSON.stringify(save))))
        throw new Error("Invariant: acknowledged persistence differs from gameplay snapshot");
      if (checkpoint?.at === step + 1) checkpoint.save(bytes);
      if (config.resumeAt === step + 1) {
        const persisted = await loadAlchemySaveState();
        if (persisted.status.kind !== "ok" || persisted.status.warnings?.length)
          throw new Error("Acknowledged save failed to load");
        hydrateAlchemyPersistenceFields(persisted.data);
        restoreRun(persisted.data.activeRun, persisted.data.talentXP, persisted.data.unlockedTalents);
        result.resumeChecks++;
      }
      if (choice.kind === "continue-run-end") {
        completed++;
        if (completed >= config.runs) {
          result.status = "completed";
          break;
        }
      } else if (["game-over", "run-victory"].includes(readActiveRunScreen())) {
        result.outcomes.push({
          outcome:
            choice.kind === "horizon" ? "horizon" : readActiveRunScreen() === "run-victory" ? "victory" : "defeat",
          rooms: run.roomsEncountered,
          gold: profile.gold,
          steps: step + 1,
        });
      }
    }
    if (result.status !== "completed") throw new Error("Incomplete: career step budget exhausted");
    if (replay && replay.length !== result.journal.length) throw new Error("Replay completed before journal ended");
  } catch (error) {
    result.status = "incomplete";
    result.error = error instanceof Error ? error.message : String(error);
  } finally {
    lifecycle.dispose(false);
    setTestRunSeedOverride(null);
    try {
      result.finalSave = snapshotCareer();
    } catch {
      result.error ??= "Failure state cannot serialize; use the initial checkpoint and journal";
      result.status = "incomplete";
    }
    result.elapsedMs = performance.now() - started;
  }
  return result;
}
