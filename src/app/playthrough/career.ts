import { performance } from "node:perf_hooks";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { addGold } from "@/features/alchemy/shared/stores/run-session-write-port";
import { createDefaultSaveData } from "@/features/alchemy/shared/storage";
import { readActiveRunScreen, readRunRevision } from "@/features/alchemy/shared/stores/run-reads";
import { setTestRunSeedOverride } from "@/features/alchemy/shared/stores/run-state-init";
import { characters, DIFFICULTY_ORDER } from "@/lib/game-data";
import { createSeededRng } from "@/lib/rng";
import { createCareerActor } from "./actor";
import {
  createCareerResult,
  recordBattleStart,
  recordChosenAction,
  recordCommittedAction,
  recordObservation,
  recordRunOutcome,
  sampleCareerBattle,
} from "./career-evidence";
import { createCareerPersistence, snapshotCareer, stateDigest } from "./career-persistence";
import type { CareerConfig, CareerResult, JournalEntry } from "./types";

export { snapshotCareer, stateDigest } from "./career-persistence";

function validateConfig(config: CareerConfig) {
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
}

function injectDiagnosticFault(config: CareerConfig, step: number) {
  if (config.diagnosticFault?.at !== step) return;
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

export async function runCareer(
  config: CareerConfig,
  onJournal: (entry: JournalEntry) => void = () => {},
  replay?: JournalEntry[],
  checkpoint?: { at: number; save: (bytes: string) => void },
): Promise<CareerResult> {
  validateConfig(config);
  const started = performance.now();
  setTestRunSeedOverride(config.seed);
  const initialSave = config.initialSave ?? createDefaultSaveData();
  const persistence = await createCareerPersistence(initialSave);
  const result = createCareerResult(config, initialSave);
  const actor = createCareerActor(config, (state, texts, card) => sampleCareerBattle(result, state, texts, card));
  const random = createSeededRng(config.seed ^ 0x71ab83);
  let completed = 0;
  let policyDraws = 0;
  const observedBattleKeys = new Set<string>();

  try {
    for (let step = 0; step < config.maxSteps; step++) {
      setTestRunSeedOverride((config.seed + completed) >>> 0);
      const observationStarted = performance.now();
      const before = stateDigest();
      recordBattleStart(result, step, completed, observedBattleKeys);
      const options = actor.observe();
      if (stateDigest() !== before) throw new Error("Invariant: observation mutated gameplay or RNG");
      recordObservation(result, options);
      result.timings.observationMs += performance.now() - observationStarted;

      const recorded = replay?.[step];
      if (replay && !recorded) throw new Error(`Replay journal exhausted at ${step}`);
      const best = Math.max(...options.map((option) => option.score));
      const randomChoice = config.policy === "random" && options[0]?.kind !== "play";
      const preferred = randomChoice ? options : options.filter((option) => option.score === best);
      if (!recorded) policyDraws++;
      const choice = recorded?.action ?? preferred[Math.floor(random() * preferred.length)];
      if (!choice) throw new Error("Policy produced no choice");
      recordChosenAction(result, step, completed, choice);

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
        injectDiagnosticFault(config, step);
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

      const committed = recordCommittedAction(result, step, completed, choice, config.maxTurns);
      await persistence.verifyStep(step, result, checkpoint, config.resumeAt);
      if (choice.kind === "continue-run-end") {
        completed++;
        if (completed >= config.runs) {
          result.status = "completed";
          break;
        }
      } else if (["game-over", "run-victory"].includes(readActiveRunScreen())) {
        recordRunOutcome(result, step, choice, committed);
      }
    }
    if (result.status !== "completed") throw new Error("Incomplete: career step budget exhausted");
    if (replay && replay.length !== result.journal.length) throw new Error("Replay completed before journal ended");
  } catch (error) {
    result.status = "incomplete";
    result.error = error instanceof Error ? error.message : String(error);
  } finally {
    persistence.dispose();
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
