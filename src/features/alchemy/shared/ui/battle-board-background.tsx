import { boardArt } from "../config/game-data-catalog";

export function BattleBoardBackground({ boardId }: { boardId: string | null }) {
  const art = boardId ? boardArt[boardId] : undefined;
  return art ? (
    <img
      aria-hidden="true"
      alt=""
      data-testid="battle-board-background"
      data-board-id={boardId}
      src={art.full}
      className="pointer-events-none absolute inset-0 h-full w-full object-fill"
    />
  ) : null;
}
