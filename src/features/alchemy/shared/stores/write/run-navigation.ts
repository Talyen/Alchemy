import { transitionRunActivity } from "@/lib/active-run-session";
import type { Screen } from "@/lib/routing";
import type { GameplayDraft } from "../run-session-command";

// ── Navigation ───────────────────────────────────────────────────────────────

export function setScreen(draft: GameplayDraft, action: Screen | ((previous: Screen) => Screen)): void {
  const screen = typeof action === "function" ? action(draft.run.navigation.screen) : action;
  draft.run.navigation.screen = screen;
  prepareRunNavigation(draft, screen);
}

export function prepareRunNavigation(draft: GameplayDraft, screen: Screen): void {
  if (draft.session.activity.kind !== "inactive")
    draft.session.activity = transitionRunActivity(draft.session.activity, screen);
}

export function resetNavigation(draft: GameplayDraft): void {
  draft.run.navigation.screen = "menu";
  draft.session.activity = { kind: "idle" };
}
