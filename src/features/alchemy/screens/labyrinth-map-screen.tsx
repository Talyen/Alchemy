// Labyrinth map screen — a 5×5 node grid with cardinal-direction connections.
// Shows revealed nodes, current position, and allows traversal by clicking connected nodes.
import { Swords, Skull, Coins, Heart, Sparkles, ShoppingCart, FlaskConical, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LabyrinthMap, LabyrinthNodeType } from "@/lib/content-systems/types";
import { NODE_TYPE_LABELS } from "@/lib/content-systems/labyrinth/data";

type Props = {
  labyrinthMap: LabyrinthMap;
  onNodeClick: (row: number, col: number) => void;
};

const NODE_ICONS: Record<LabyrinthNodeType, React.ReactNode> = {
  combat: <Swords className="h-5 w-5" />,
  elite: <Skull className="h-5 w-5" />,
  treasure: <Coins className="h-5 w-5" />,
  rest: <Heart className="h-5 w-5" />,
  mystery: <Sparkles className="h-5 w-5" />,
  shop: <ShoppingCart className="h-5 w-5" />,
  alchemist: <FlaskConical className="h-5 w-5" />,
  boss: <Crown className="h-5 w-5" />,
};

export function LabyrinthMapScreen({ labyrinthMap, onNodeClick }: Props) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-4 py-6">
      <h2 className="text-xl font-semibold text-foreground">Labyrinth</h2>
      <p className="text-sm text-muted-foreground">Choose your path through the depths</p>

      <div className="flex flex-col items-center gap-3">
        {labyrinthMap.grid.map((row, r) => (
          <div key={r} className="flex items-center gap-3">
            {row.map((node, c) => {
              if (!node) return <div key={c} className="h-16 w-16" />;

              const isCurrent = node.state === "current";
              const isVisible = node.state === "visible" || isCurrent;
              const isCleared = node.state === "cleared";
              const isFailed = node.state === "failed";

              return (
                <button
                  key={c}
                  type="button"
                  disabled={!isVisible || isCleared || isFailed}
                  onClick={() => onNodeClick(r, c)}
                  className={cn(
                    "flex h-16 w-16 flex-col items-center justify-center rounded-lg border text-xs transition-all",
                    isCurrent && "border-primary bg-primary/20 ring-2 ring-primary scale-110",
                    isVisible && !isCurrent && !isCleared && !isFailed && "border-border bg-card/60 hover:border-muted-foreground/40 hover:bg-card/80 cursor-pointer",
                    isCleared && "border-border/30 bg-card/30 opacity-50",
                    isFailed && "border-red-900/50 bg-red-950/20 opacity-40",
                    !isVisible && "border-transparent",
                  )}
                >
                  {isVisible ? (
                    <>
                      <div className={cn(isCleared && "opacity-40", isFailed && "opacity-40")}>
                        {NODE_ICONS[node.type]}
                      </div>
                      <span className="mt-0.5 text-[10px] leading-none text-muted-foreground">
                        {NODE_TYPE_LABELS[node.type]}
                      </span>
                      {node.modifiers.length > 0 && (
                        <span className="text-[8px] text-yellow-500">+{node.modifiers.length}</span>
                      )}
                    </>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
