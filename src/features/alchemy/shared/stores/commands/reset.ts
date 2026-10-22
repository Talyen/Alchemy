import { createSessionPersistence } from "@/features/alchemy/shared/storage";
import { logStorageFailure } from "@/lib/storage-logging";
import type { GameSession } from "../session/game-session-types";
import { dispatchGameplayCommand } from "../session/gameplay-command";
import { resetGear } from "./gear-actions";
import { clearActiveRunInDraft } from "./run-lifecycle";
import { acceptCommand } from "./run-session-command";
import {
  clearPermanentData,
  clearTransientSession,
  resetToDefaults as resetRunSessionToDefaults,
} from "./run-session-write-port";
import { sessionRuntime } from "../session/session-runtime";
import { createDefaultSettingsSaveFields } from "../session/settings-state";

// Test/boot helper only: resets UI and session activity, including combat.
// It does not settle progression or cancel battle playback; use lifecycle
// teardown paths for in-run resets.
export function resetTransientRunUi(gameSession: GameSession) {
  sessionRuntime(gameSession).feedback.resetTransientUi();
  dispatchGameplayCommand((draft) => acceptCommand(clearTransientSession(draft)), undefined, gameSession);
}

export async function clearAllPersistentGameData(gameSession: GameSession): Promise<boolean> {
  const runtime = sessionRuntime(gameSession);
  if (runtime.persistentClearInFlight) return false;
  runtime.persistentClearInFlight = true;
  try {
    const cleared = await createSessionPersistence(gameSession).clear("localWipe");
    if (!cleared) {
      logStorageFailure("Save data could not be cleared; memory was left unchanged");
      return false;
    }
    if (runtime.lifetime.disposed) return true;
    // Device display sizes intentionally survive: they live outside the
    // versioned save (see MIGRATIONS.md public save contract) and Reset
    // Options — not this wipe — is their reset path.
    dispatchGameplayCommand(
      (draft) => {
        resetRunSessionToDefaults(draft);
        clearPermanentData(draft);
        resetGear(draft.gear);
        clearActiveRunInDraft(draft);

        return acceptCommand();
      },
      {
        restore: { settings: createDefaultSettingsSaveFields() },
        afterCommit: () => runtime.feedback.clearSaveConfirmation(),
      },
      gameSession,
    );
    return true;
  } finally {
    runtime.persistentClearInFlight = false;
  }
}
