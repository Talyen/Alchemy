import { useGameTranslation } from "@/components/use-game-translation";
import { text as gameText, displayText } from "@/lib/localization/runtime";
import { defaultGameSession } from "./application-session";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { createSessionPersistence } from "@/features/alchemy/shared/storage";

const persistence = createSessionPersistence(defaultGameSession);

export function SaveWriteNotice({ onRetry = persistence.retryProgress }: { onRetry?: () => void } = {}) {
  useGameTranslation();
  const progress = useSyncExternalStore(persistence.subscribeProgress, persistence.readProgress);
  const failed = useSyncExternalStore(persistence.subscribeFailure, persistence.readFailure, () => false);
  if (progress.kind === "idle" && !failed) return null;
  const saveFailed = progress.kind === "failed" || (progress.kind === "idle" && failed);
  return (
    <div
      role={saveFailed ? "alert" : "status"}
      aria-live="polite"
      className="fixed top-4 left-1/2 z-[150] flex w-fit max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-xl border border-warning bg-background p-3 text-foreground"
    >
      <span>
        {displayText(
          saveFailed
            ? gameText("ui.save-write-notice.d1", "Couldn’t save")
            : gameText("ui.save-write-notice.d2", "Saving…"),
        )}
      </span>
      {saveFailed ? <Button onClick={onRetry}>{gameText("ui.save-write-notice.1", "Retry")}</Button> : null}
    </div>
  );
}
