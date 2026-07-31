// Run-setup session write port — pending selections, draft state, and run-start application.
import type { CharacterId } from "@/lib/game-data";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { WildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import type { RunStartSnapshot } from "@/features/alchemy/shared/run-flow/run-start";
import { getRunTransientStore } from "../run-transient-store";
import { getRunDomainStore } from "../run-domain-store";
import { dispatchRunSessionCommand } from "../run-session-command";

export function setHasActiveRun(hasActiveRun: boolean) {
  return dispatchRunSessionCommand(() => getRunTransientStore().setHasActiveRun(hasActiveRun));
}

export function setPendingCharacterId(id: CharacterId | null) {
  return dispatchRunSessionCommand(() => getRunTransientStore().setPendingCharacterId(id));
}

export function setPendingContentSystemType(type: ContentSystemId) {
  return dispatchRunSessionCommand(() => getRunTransientStore().setPendingContentSystemType(type));
}

export function setWildwoodDraft(
  state: WildwoodDraftState | null | ((prev: WildwoodDraftState | null) => WildwoodDraftState | null),
) {
  return dispatchRunSessionCommand(() => getRunTransientStore().setWildwoodDraft(state));
}

/** Start a fresh run: seed active-run progress, drop the previous run-end XP snapshot, flag the run active. */
export function applyRunStartSnapshot(snapshot: RunStartSnapshot): void {
  dispatchRunSessionCommand(() => {
    getRunDomainStore().hydrateFromSnapshot(snapshot);
    const transient = getRunTransientStore();
    transient.setRunEndTalentXP({});
    transient.setHasActiveRun(snapshot.hasActiveRun);
  });
}
