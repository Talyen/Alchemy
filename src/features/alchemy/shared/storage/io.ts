// Browser localStorage IO for alchemy save data.
// Depends on: SAVE_KEY (game-constants), Zod validation schemas (lib/validation), save defaults.
// Used by: use-app-save-state.ts (loadAlchemySaveState), App.tsx (loadAlchemySaveState).
import { SAVE_KEY } from "@/lib/game-constants";
import { platform } from "@/lib/platform";

import {
  SaveDataSchema,
  safeParseWithErrors,
  getRawContentVersion,
  getRawSaveSchemaVersion,
  isUnsupportedFutureContentData,
  isUnsupportedFutureSaveData,
  type ParsedSaveData,
} from "@/lib/validation";
import type { SaveData } from "./types";
import { logError } from "@/lib/error-logger";
import { defaultSaveData } from "./defaults";
import { cardLibrary } from "@/lib/game-data/cards";
import { toActiveRunData } from "@/lib/active-run-session";

class SaveSessionState {
  private writesDisabledForSession = false;

  public setWritesDisabled(disabled: boolean) {
    this.writesDisabledForSession = disabled;
  }

  public isWritesDisabled() {
    return this.writesDisabledForSession;
  }
}

const saveSessionState = new SaveSessionState();

// Keeps storage failures readable without crashing gameplay when browsers block persistence.
function logStorageFailure(message: string, error?: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-base-to-string -- preserve readable browser storage errors from unknown throws
  logError(message, "storage", error ? { error: String(error) } : undefined);
}

function collectSaveRepairWarnings(raw: Partial<SaveData>, normalized: ParsedSaveData): string[] {
  const warnings: string[] = [];
  if (raw.activeRun && !normalized.activeRun) {
    warnings.push("active run could not be restored");
  }
  return warnings;
}

type SaveLoadStatus =
  | { kind: "ok"; warnings?: string[] }
  | { kind: "unsupported-newer-schema"; detectedSchemaVersion: number }
  | { kind: "unsupported-newer-content"; detectedContentVersion: number }
  | { kind: "corrupt" };

export interface SaveLoadState {
  data: SaveData;
  status: SaveLoadStatus;
}

// Silently drops deck cards whose IDs no longer exist in the catalog, then
// hydrates remaining cards into the runtime ActiveRunData contract. The run always
// has a valid, drawable deck; no player-facing diagnostics.
function hydrateActiveRunDeck(activeRun: ParsedSaveData["activeRun"]): SaveData["activeRun"] {
  if (!activeRun) return null;
  const knownIds = new Set(cardLibrary.map((c) => c.id));
  const keepCard = (card: { id: string }) => knownIds.has(card.id);
  return toActiveRunData({
    ...activeRun,
    runDeck: activeRun.runDeck.filter(keepCard),
    wildwoodDraft: activeRun.wildwoodDraft
      ? {
          ...activeRun.wildwoodDraft,
          draftChoices: activeRun.wildwoodDraft.draftChoices.filter(keepCard),
        }
      : null,
  });
}

async function readLocalRaw(key: string): Promise<string | null> {
  const local = await platform.storage.readLocal(key);
  if (!local.ok) {
    logStorageFailure("LocalStorage read failed", local.error);
    return null;
  }
  return local.data;
}

async function collectSaveCandidates(): Promise<string[]> {
  if (!platform.isDesktop) {
    const local = await readLocalRaw(SAVE_KEY);
    return local ? [local] : [];
  }

  const candidates: string[] = [];

  // Desktop local candidates, in preference order (local, bak.1, bak.2, bak.3).
  const localCandidates = await platform.storage.listSaveCandidates();
  candidates.push(...localCandidates);

  // Cloud as the final fallback.
  const cloud = await platform.storage.readCloudFallback();
  if (cloud) candidates.push(cloud);

  // Deduplicate by payload so identical copies don't waste a Zod parse.
  const seen = new Set<string>();
  return candidates.filter((c) => {
    if (seen.has(c)) return false;
    seen.add(c);
    return true;
  });
}

async function writeStorageItem(key: string, value: string): Promise<{ ok: true } | { ok: false; error: unknown }> {
  const result = await platform.storage.writeLocal(key, value);
  if (result.ok) return { ok: true };
  return { ok: false, error: result.error };
}

async function removeStorageItem(key: string): Promise<{ ok: true } | { ok: false; error: unknown }> {
  const result = await platform.storage.removeLocal(key);
  if (result.ok) return { ok: true };
  return { ok: false, error: result.error };
}

function parseCandidates(candidates: string[]): Array<{ parsed: Partial<SaveData> }> {
  const parsed: Array<{ parsed: Partial<SaveData> }> = [];
  for (const c of candidates) {
    try {
      parsed.push({ parsed: JSON.parse(c) as Partial<SaveData> });
    } catch (error) {
      // Not valid JSON; try the next candidate.
      logStorageFailure("Save candidate JSON parse failed, trying next candidate", error);
    }
  }
  return parsed;
}

function filterFutureCandidates(parsedCandidates: Array<{ parsed: Partial<SaveData> }>): {
  valid: Array<{ parsed: Partial<SaveData> }>;
  futureSchema: number;
  futureContent: number;
} {
  let foundFutureSchema = false;
  let foundFutureContent = false;
  let maxSchemaVersion = 0;
  let maxContentVersion = 0;
  const valid: Array<{ parsed: Partial<SaveData> }> = [];
  for (const c of parsedCandidates) {
    if (isUnsupportedFutureSaveData(c.parsed)) {
      foundFutureSchema = true;
      maxSchemaVersion = Math.max(maxSchemaVersion, getRawSaveSchemaVersion(c.parsed));
      continue;
    }
    if (isUnsupportedFutureContentData(c.parsed)) {
      foundFutureContent = true;
      maxContentVersion = Math.max(maxContentVersion, getRawContentVersion(c.parsed));
      continue;
    }
    valid.push(c);
  }
  return {
    valid,
    futureSchema: foundFutureSchema ? maxSchemaVersion : 0,
    futureContent: foundFutureContent ? maxContentVersion : 0,
  };
}

function returnFirstValid(validCandidates: Array<{ parsed: Partial<SaveData> }>): SaveLoadState | null {
  if (validCandidates.length === 0) return null;
  saveSessionState.setWritesDisabled(false);
  for (const c of validCandidates) {
    const result = safeParseWithErrors(SaveDataSchema, c.parsed);
    if (!result.success) {
      logStorageFailure("Save candidate failed validation, trying next candidate", result.error);
      continue;
    }
    const data = result.data;
    const warnings = collectSaveRepairWarnings(c.parsed, data);
    for (const ve of result.errors) {
      warnings.push(`Field "${ve.path}" was corrupt: ${ve.message}`);
    }
    const hydrated: SaveData = { ...data, activeRun: hydrateActiveRunDeck(data.activeRun) };
    if (warnings.length > 0) console.warn("Save data was normalized during load", warnings);
    return { data: hydrated, status: warnings.length > 0 ? { kind: "ok", warnings } : { kind: "ok" } };
  }
  return null;
}

// Loads save data plus status. On desktop, candidates are walked in preference
// order: local, bak.1, bak.2, bak.3, cloud. Each candidate is parsed and
// Zod-validated before being accepted. The first valid, non-future-version
// candidate wins. Future-versioned candidates are silently skipped; only when
// every candidate fails do we fall back to defaultSaveData.
export async function loadAlchemySaveState(): Promise<SaveLoadState> {
  if (typeof window === "undefined") {
    return { data: defaultSaveData, status: { kind: "ok" } };
  }

  let candidates: string[];
  try {
    candidates = await collectSaveCandidates();
  } catch (error) {
    logStorageFailure("Save candidates could not be read, falling back to defaults", error);
    return { data: defaultSaveData, status: { kind: "corrupt" } };
  }

  if (candidates.length === 0) return { data: defaultSaveData, status: { kind: "ok" } };

  const parsedCandidates = parseCandidates(candidates);
  if (parsedCandidates.length === 0) return { data: defaultSaveData, status: { kind: "corrupt" } };

  const { valid, futureSchema, futureContent } = filterFutureCandidates(parsedCandidates);
  if (valid.length === 0) {
    saveSessionState.setWritesDisabled(true);
    if (futureSchema)
      return {
        data: defaultSaveData,
        status: { kind: "unsupported-newer-schema", detectedSchemaVersion: futureSchema },
      };
    if (futureContent)
      return {
        data: defaultSaveData,
        status: { kind: "unsupported-newer-content", detectedContentVersion: futureContent },
      };
    return { data: defaultSaveData, status: { kind: "corrupt" } };
  }

  return returnFirstValid(valid) ?? { data: defaultSaveData, status: { kind: "corrupt" } };
}

// Serializes overlapping saves so desktop IPC tmp writes never interleave.
// Concurrent callers coalesce to the latest snapshot; each awaiter waits for
// its place in the chain (which may write a newer snapshot than it submitted).
let saveWriteChain: Promise<void> = Promise.resolve();
let coalescedSave: SaveData | null = null;

async function writeSaveSnapshot(data: SaveData): Promise<void> {
  try {
    const payload: SaveData = { ...data, lastSavedAt: Date.now() };
    const result = await writeStorageItem(SAVE_KEY, JSON.stringify(payload));
    if (result.ok) return;
    logStorageFailure("Save data could not be written", result.error);
  } catch (error) {
    logStorageFailure("Save data could not be serialized", error);
  }
}

// Writes the current save snapshot exactly as provided by App/controller state.
export async function saveAlchemySaveData(data: SaveData) {
  if (typeof window === "undefined") {
    return;
  }
  if (saveSessionState.isWritesDisabled()) return;

  coalescedSave = data;
  const run = saveWriteChain.then(async () => {
    while (coalescedSave !== null) {
      const snapshot = coalescedSave;
      coalescedSave = null;
      if (saveSessionState.isWritesDisabled()) return;
      await writeSaveSnapshot(snapshot);
    }
  });
  // Keep the chain alive even if a write logs-and-continues; never reject the gate.
  saveWriteChain = run.catch(() => {});
  await run;
}

// Removes the persisted save while leaving in-memory React state reset to callers.
export async function clearAlchemySaveData() {
  if (typeof window === "undefined") {
    return;
  }

  const result = await removeStorageItem(SAVE_KEY);
  if (result.ok) {
    saveSessionState.setWritesDisabled(false);
    return;
  }
  logStorageFailure("Save data could not be cleared", result.error);
}
