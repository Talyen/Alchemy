import type { RunRecap } from "@/lib/active-run-session";
import { cloneBattleCard } from "@/lib/game-data";
import type { Destination } from "@/lib/routing";
import type { GameplayDraft } from "../run-session-command";

/** Stable visit IDs deduplicate unresolved-room re-entry and restored continuations. */
export function recordRunRoom(draft: GameplayDraft, destination: Destination, id: string): boolean {
  const run = draft.run.activeRun;
  if (draft.session.activity.kind === "inactive" || run.runHistory.some((room) => room.id === id)) return false;
  run.runHistory.push({
    id,
    destination,
    act: run.currentAct,
    floor: run.contentSystemType === "labyrinth" ? (draft.session.labyrinthMap?.currentFloor ?? null) : null,
    completed: false,
  });
  return true;
}

export function cancelRunRoomEntry(draft: GameplayDraft, id: string): void {
  const run = draft.run.activeRun;
  run.runHistory = run.runHistory.filter((room) => room.id !== id);
}

function currentRunRoom(draft: GameplayDraft) {
  const run = draft.run.activeRun;
  const nodeId = draft.session.activeLabyrinthPendingNode;
  if (nodeId)
    return run.runHistory.find(
      (visit) => visit.id === `labyrinth:${draft.session.labyrinthMap?.currentFloor}:${nodeId}`,
    );
  if (run.contentSystemType === "campaign" && run.destinationIndexInAct > 0) {
    const destination = run.completedDestinations.at(-1);
    return run.runHistory.find(
      (visit) => visit.id === `campaign:${run.currentAct}:${run.destinationIndexInAct}:${destination}`,
    );
  }
  return run.runHistory.at(-1);
}

export function completeRunRoom(draft: GameplayDraft): void {
  const room = currentRunRoom(draft);
  if (room) room.completed = true;
}

export function addRunGoldEarned(draft: GameplayDraft, amount: number): void {
  const run = draft.run.activeRun;
  if (draft.session.activity.kind !== "inactive" && run.runGoldEarned !== null && amount > 0)
    run.runGoldEarned += amount;
}

export function captureRunRecap(draft: GameplayDraft, ending: RunRecap["ending"]): void {
  const run = draft.run.activeRun;
  draft.session.runRecap = {
    mode: run.contentSystemType,
    rooms: run.runHistory.map((room) => ({ ...room })),
    partial: run.runHistoryPartial,
    ending,
    endingRoomId: (currentRunRoom(draft) ?? run.runHistory.at(-1))?.id ?? null,
    deck: run.runDeck.map(cloneBattleCard),
    boons: [...run.runBoons],
    gold: run.runGoldEarned,
  };
}
