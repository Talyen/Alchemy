// Run-setup session write port — pending selections, draft state, and run-start application.
import type { CharacterId } from "@/lib/game-data";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { WildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import type { RunStartSnapshot } from "@/features/alchemy/shared/run-flow/run-start";
import { getRunTransientStore } from "../run-transient-store";
import { getRunDomainStore } from "../run-domain-store";

export function setHasActiveRun(hasActiveRun: boolean) {
  getRunTransientStore().setHasActiveRun(hasActiveRun);
}

export function setPendingCharacterId(id: CharacterId | null) {
  getRunTransientStore().setPendingCharacterId(id);
}

export function setPendingContentSystemType(type: ContentSystemId) {
  getRunTransientStore().setPendingContentSystemType(type);
}

export function setWildwoodDraft(
  state: WildwoodDraftState | null | ((prev: WildwoodDraftState | null) => WildwoodDraftState | null),
) {
  getRunTransientStore().setWildwoodDraft(state);
}

/** Start a fresh run: seed active-run progress, drop the previous run-end XP snapshot, flag the run active. */
export function applyRunStartSnapshot(snapshot: RunStartSnapshot): void {
  getRunDomainStore().hydrateFromSnapshot(snapshot);
  const transient = getRunTransientStore();
  transient.setRunEndTalentXP({});
  transient.setHasActiveRun(snapshot.hasActiveRun);
}
