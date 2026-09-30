import { useSyncExternalStore } from "react";
import { getSaveWriteFailure, subscribeSaveWriteFailure } from "@/features/alchemy/shared/storage";

export function SaveWriteNotice() {
  const failed = useSyncExternalStore(subscribeSaveWriteFailure, getSaveWriteFailure, () => false);
  if (!failed) return null;
  return (
    <div
      role="alert"
      className="pointer-events-none fixed top-4 left-1/2 z-50 w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-warning bg-background p-3 text-center text-foreground"
    >
      Progress could not be saved. Keep the game open while saving retries; recent progress may be lost if you quit.
    </div>
  );
}
