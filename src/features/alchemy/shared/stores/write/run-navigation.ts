import type { Screen } from "@/lib/routing";
import type { GameplayDraft } from "../gameplay-command";

// ── Navigation ───────────────────────────────────────────────────────────────

export function setScreen(draft: GameplayDraft, action: Screen | ((previous: Screen) => Screen)): void {
  const screen = typeof action === "function" ? action(draft.run.navigation.screen) : action;
  draft.run.navigation.screen = screen;
}

export function resetNavigation(draft: GameplayDraft): void {
  draft.run.navigation.screen = "menu";
}
