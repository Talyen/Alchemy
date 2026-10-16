import { useEffect, useState } from "react";
import type { SaveLoadState } from "@/features/alchemy/shared/storage";
import type { GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { logStorageFailure } from "@/lib/storage-logging";
import { bootstrapAlchemySession } from "./alchemy-bootstrap";

export function useAlchemyBootstrap(gameSession: GameSession): SaveLoadState | null {
  const [completion, setCompletion] = useState<{ session: GameSession; result: SaveLoadState } | null>(null);
  useEffect(() => {
    let subscribed = true;
    void bootstrapAlchemySession(gameSession).then(
      (result) => {
        if (subscribed && result) setCompletion({ session: gameSession, result });
      },
      (error: unknown) => {
        if (subscribed) logStorageFailure("Save restoration failed", error);
      },
    );
    return () => {
      subscribed = false;
    };
  }, [gameSession]);
  return completion?.session === gameSession ? completion.result : null;
}
