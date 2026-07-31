// Run-setup session write port — pending selections, draft state, and run-start application.
import type { CharacterId } from "@/lib/game-data";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { WildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import type { RunStartSnapshot } from "@/features/alchemy/shared/run-flow/run-start";
import { dispatchRunSessionCommand } from "../run-session-command";
import { createRunSessionStoreSnapshot } from "../run-session-queries";

export function setPendingCharacterId(id: CharacterId | null) {
  return dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().transient.setPendingCharacterId(id));
}

export function setPendingContentSystemType(type: ContentSystemId) {
  return dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().transient.setPendingContentSystemType(type));
}

export function setWildwoodDraft(
  state: WildwoodDraftState | null | ((prev: WildwoodDraftState | null) => WildwoodDraftState | null),
) {
  return dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().transient.setWildwoodDraft(state));
}

/** Start a fresh run: seed active-run progress, drop the previous run-end XP snapshot, flag the run active. */
export function applyRunStartSnapshot(snapshot: RunStartSnapshot): void {
  dispatchRunSessionCommand(() => {
    const session = createRunSessionStoreSnapshot();
    session.domain.hydrateFromSnapshot(snapshot);
    const transient = session.transient;
    transient.setRunEndTalentXP({});
    transient.setHasActiveRun(snapshot.hasActiveRun);
  });
}
