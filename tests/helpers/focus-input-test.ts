import { afterEach, beforeEach } from "vitest";
import { trackFocusInput } from "@/features/alchemy/shared/ui/dialogs/focus-input";

/** Mirror the app's input tracking in isolated UI tests. */
export function installFocusInputForTests(keyboard = false): void {
  let stop: () => void;
  beforeEach(() => {
    stop = trackFocusInput();
    if (keyboard) window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
  });
  afterEach(() => stop());
}
