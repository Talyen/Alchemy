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
} from "@/lib/validation";
import type { SaveData } from "./types";
import { logError } from "@/lib/error-logger";
import { defaultSaveData } from "./defaults";
import { cardLibrary } from "@/lib/game-data/cards";
import { hydrateCard } from "@/lib/game-data";
import type { BattleCard } from "@/lib/game-data/types";

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
  logError(message, "storage", error ? { error: String(error) } : undefined); // eslint-disable-line @typescript-eslint/no-base-to-string
}

function collectSaveRepairWarnings(raw: Partial<SaveData>, normalized: SaveData): string[] {
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

export type SaveLoadState = {
  data: SaveData;
  status: SaveLoadStatus;
};

// Silently drops deck cards whose IDs no longer exist in the catalog, then
// eagerly hydrates remaining cards with library art/keywordIds. The run always
// has a valid, drawable deck; no player-facing diagnostics.
function hydrateActiveRunDeck(activeRun: SaveData["activeRun"]): SaveData["activeRun"] {
  if (!activeRun) return null;
  const knownIds = new Set(cardLibrary.map((c) => c.id));
  const keepCard = (card: BattleCard) => knownIds.has(card.id);
  return {
    ...activeRun,
    runDeck: activeRun.runDeck.filter(keepCard).map(hydrateCard),
    wildwoodDraft: activeRun.wildwoodDraft
      ? {
          ...activeRun.wildwoodDraft,
          draftChoices: activeRun.wildwoodDraft.draftChoices.filter(keepCard).map(hydrateCard),
        }
      : null,
  };
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

  if (candidates.length === 0) {
    return { data: defaultSaveData, status: { kind: "ok" } };
  }

  // Parse all candidates first so we can filter by future-version status before
  // the expensive Zod validation.
  const parsedCandidates: { parsed: Partial<SaveData> }[] = [];
  for (const c of candidates) {
    try {
      parsedCandidates.push({ parsed: JSON.parse(c) as Partial<SaveData> });
    } catch {
      // Not valid JSON; try the next candidate.
    }
  }

  if (parsedCandidates.length === 0) {
    return { data: defaultSaveData, status: { kind: "corrupt" } };
  }

  // Silently skip future-version candidates. Track whether we saw any so the
  // fallback status is accurate when every candidate is from a newer version.
  let foundFutureSchema = false;
  let foundFutureContent = false;
  let maxSchemaVersion = 0;
  let maxContentVersion = 0;
  const validCandidates: typeof parsedCandidates = [];
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
    validCandidates.push(c);
  }

  // If every candidate was from a future version, disable writes and return
  // defaults. The player never sees an error screen.
  if (validCandidates.length === 0) {
    saveSessionState.setWritesDisabled(true);
    if (foundFutureSchema) {
      return {
        data: defaultSaveData,
        status: { kind: "unsupported-newer-schema", detectedSchemaVersion: maxSchemaVersion },
      };
    }
    if (foundFutureContent) {
      return {
        data: defaultSaveData,
        status: { kind: "unsupported-newer-content", detectedContentVersion: maxContentVersion },
      };
    }
    return { data: defaultSaveData, status: { kind: "corrupt" } };
  }

  // Walk remaining candidates in order and take the first that Zod-validates.
  saveSessionState.setWritesDisabled(false);
  for (const c of validCandidates) {
    const result = safeParseWithErrors(SaveDataSchema, c.parsed);
    if (!result.success) {
      logStorageFailure("Save candidate failed validation, trying next candidate", result.error);
      continue;
    }
    const data = result.data as SaveData;
    const warnings = collectSaveRepairWarnings(c.parsed, data);
    for (const ve of result.errors) {
      warnings.push(`Field "${ve.path}" was corrupt: ${ve.message}`);
    }

    // Eagerly hydrate active-run deck cards at load time so every consumer
    // downstream gets fully-resolved card objects.
    const hydrated = { ...data, activeRun: hydrateActiveRunDeck(data.activeRun) };

    if (warnings.length > 0) {
      console.warn("Save data was normalized during load", warnings);
    }
    return {
      data: hydrated,
      status: warnings.length > 0 ? { kind: "ok", warnings } : { kind: "ok" },
    };
  }

  return { data: defaultSaveData, status: { kind: "corrupt" } };
}

// Writes the current save snapshot exactly as provided by App/controller state.
export async function saveAlchemySaveData(data: SaveData) {
  if (typeof window === "undefined") {
    return;
  }
  if (saveSessionState.isWritesDisabled()) return;

  try {
    const payload: SaveData = { ...data, lastSavedAt: Date.now() };
    const result = await writeStorageItem(SAVE_KEY, JSON.stringify(payload));
    if (result.ok) return;
    logStorageFailure("Save data could not be written", result.error);
    return;
  } catch (error) {
    logStorageFailure("Save data could not be serialized", error);
  }
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
