import { isDeepStrictEqual } from "node:util";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import {
  buildAlchemySaveDataFromStores,
  configureSaveBackend,
  evaluateSaveCandidates,
  hydrateAlchemyPersistenceFields,
  loadAlchemySaveState,
  type UnstampedSaveData,
} from "@/features/alchemy/shared/storage";
import { restoreRun, resolveActiveRunForSave } from "@/features/alchemy/shared/stores/run-lifecycle";
import {
  selectAutosaveAllowed,
  readActiveRunScreen,
  readBattle,
  readHasActiveRun,
  readRunSession,
} from "@/features/alchemy/shared/stores/run-reads";
import { createAlchemyAutosaveLifecycle } from "../autosave-lifecycle";
import type { CareerResult } from "./types";

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

export async function createCareerPersistence(initialSave: UnstampedSaveData) {
  let bytes: string | null = JSON.stringify(initialSave);
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

  return {
    async verifyStep(
      step: number,
      result: CareerResult,
      checkpoint?: { at: number; save: (bytes: string) => void },
      resumeAt?: number,
    ) {
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
      if (resumeAt === step + 1) {
        const persisted = await loadAlchemySaveState();
        if (persisted.status.kind !== "ok" || persisted.status.warnings?.length)
          throw new Error("Acknowledged save failed to load");
        hydrateAlchemyPersistenceFields(persisted.data);
        restoreRun(persisted.data.activeRun, persisted.data.talentXP, persisted.data.unlockedTalents);
        result.resumeChecks++;
      }
    },
    dispose() {
      lifecycle.dispose(false);
    },
  };
}
