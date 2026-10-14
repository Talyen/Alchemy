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
      className="pointer-events-none absolute top-1/2 left-1/2 h-[max(100cqh,56.25cqw)] w-[max(100cqw,177.777778cqh)] max-w-none -translate-x-1/2 -translate-y-1/2 object-cover object-center"
    />
  ) : null;
}
