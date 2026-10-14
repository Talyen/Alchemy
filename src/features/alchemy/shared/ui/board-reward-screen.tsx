import { useEffect, useLayoutEffect, useRef } from "react";
import { ESCAPE_PRIORITY, pushEscapeHandler } from "@/app/escape-stack";
import { Button } from "@/components/ui/button";
import { boardCatalog } from "@/lib/boards/catalog";
import { boardArt } from "../config/game-data-catalog";
import { TitledScreenShell } from "./layout-components";
import { useArtworkReady } from "./use-artwork-ready";
import { focusControl } from "./focus-navigation";

export function BoardRewardScreen({
  boardId,
  onUseBoard,
  onContinue,
  continueLabel = "Continue",
}: {
  boardId: string;
  onUseBoard: () => void;
  onContinue: () => void;
  continueLabel?: "Continue" | "Main Menu";
}) {
  const { ref: artworkRef, pending } = useArtworkReady(boardId);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const board = boardCatalog.find((entry) => entry.id === boardId);
  useLayoutEffect(() => {
    focusControl(buttonRef.current);
  }, [boardId]);
  useEffect(
    () => pushEscapeHandler({ id: "board-reward", priority: ESCAPE_PRIORITY.SCREEN_OVERLAY, onEscape: onContinue }),
    [onContinue],
  );
  return (
    <TitledScreenShell title="Board Collected" maxWidthClass="max-w-6xl">
      <div className="mt-6 flex flex-col items-center gap-5">
        <div ref={artworkRef} data-artwork-pending={pending} className="w-full">
          <img
            src={boardArt[boardId]?.full}
            alt={board?.title ?? "Game Board"}
            className="max-h-[55vh] w-full rounded-shell-tooltip object-contain"
          />
        </div>
        <h2 className="text-center font-sans text-3xl text-gold-pale">{board?.title}</h2>
        <div className="flex justify-center gap-4">
          <Button variant="primary" size="lg" onClick={onUseBoard}>
            Use Board
          </Button>
          <Button ref={buttonRef} size="lg" onClick={onContinue}>
            {continueLabel}
          </Button>
        </div>
      </div>
    </TitledScreenShell>
  );
}
