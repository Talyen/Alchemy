import { useGameTranslation } from "@/components/use-game-translation";
import { text as gameText } from "@/lib/localization/runtime";
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
  continueLabel = gameText("ui.board-reward-screen.default-continueLabel", "Continue"),
}: {
  boardId: string;
  onUseBoard: () => void;
  onContinue: () => void;
  continueLabel?: string;
}) {
  const i18n = useGameTranslation();
  const { ref: artworkRef, pending } = useArtworkReady(boardId);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const title = boardCatalog.find((entry) => entry.id === boardId)?.title ?? "Game Board";
  useLayoutEffect(() => {
    focusControl(buttonRef.current);
  }, [boardId]);
  useEffect(
    () => pushEscapeHandler({ id: "board-reward", priority: ESCAPE_PRIORITY.SCREEN_OVERLAY, onEscape: onContinue }),
    [onContinue],
  );
  return (
    <TitledScreenShell title={i18n.text("ui.board-reward-screen.1", "Board Collected")} maxWidthClass="max-w-6xl">
      <div className="mt-6 flex flex-col items-center gap-5">
        <div ref={artworkRef} data-artwork-pending={pending} className="w-full">
          <img
            src={boardArt[boardId]?.full}
            alt={i18n.displayText(title)}
            decoding="async"
            className="max-h-[55vh] w-full rounded-shell-tooltip object-contain"
          />
        </div>
        <h2 className="text-center font-sans text-3xl text-gold-pale">{i18n.displayText(title)}</h2>
        <div className="flex justify-center gap-4">
          <Button variant="primary" size="lg" onClick={onUseBoard}>
            {i18n.text("ui.board-reward-screen.2", "Use Board")}
          </Button>
          <Button ref={buttonRef} size="lg" onClick={onContinue}>
            {continueLabel}
          </Button>
        </div>
      </div>
    </TitledScreenShell>
  );
}
