// Act timeline renders the current run route using immutable progress data from the run controller.
import type { LucideIcon } from "lucide-react";
import { Check, CircleHelp, Coins, Flame, ShieldAlert, Skull, Sparkles, Swords, WandSparkles } from "lucide-react";

import { DESTINATIONS_PER_ACT, ACTS_PER_RUN } from "@/lib/game-constants";
import { cn } from "@/lib/utils";
import type { Destination } from "../types";

const nodeIcons: Record<string, LucideIcon> = {
  "Normal Combat": Swords,
  "Elite Combat": ShieldAlert,
  "Merchant's Shop": Coins,
  "Alchemist's Shop": WandSparkles,
  Mystery: Sparkles,
  Campfire: Flame,
  "Boss Combat": Skull,
};

const completedNodeClasses: Record<string, string> = {
  "Normal Combat": "border-red-300/65 bg-red-950/90 text-red-100 shadow-red-900/35",
  "Elite Combat": "border-violet-300/65 bg-violet-950/90 text-violet-100 shadow-violet-900/35",
  "Merchant's Shop": "border-amber-300/70 bg-amber-900/90 text-amber-100 shadow-amber-900/35",
  "Alchemist's Shop": "border-emerald-300/65 bg-emerald-950/90 text-emerald-100 shadow-emerald-900/35",
  Mystery: "border-stone-300/55 bg-stone-900/90 text-stone-100 shadow-stone-900/35",
  Campfire: "border-orange-300/70 bg-orange-950/90 text-orange-100 shadow-orange-900/35",
  "Boss Combat": "border-red-300/80 bg-red-950/95 text-red-100 shadow-red-900/45",
};

// Resolves destination names to icons without leaking visual map details into run state.
function DestIcon({ dest, className }: { dest: Destination; className?: string }) {
  const Icon = nodeIcons[dest] ?? Swords;
  return <Icon className={className ?? "h-4 w-4"} />;
}

// Keeps node labels short enough for the compressed horizontal route.
function nodeLabel(index: number, completedDest: Destination | undefined, isCurrent: boolean, isBoss: boolean) {
  if (completedDest) return completedDest.replace(" Combat", "").replace("'s Shop", "");
  if (isCurrent) return "Choose";
  if (isBoss) return "Boss";
  return `Room ${index + 1}`;
}

// Shows the player's position through the act while preserving mystery for future rooms.
export function ActTimeline({
  currentAct,
  destinationIndexInAct,
  completedDestinations,
}: {
  currentAct: number;
  destinationIndexInAct: number;
  completedDestinations: Destination[];
}) {
  const nodeCount = DESTINATIONS_PER_ACT;

  return (
    <div className="w-full max-w-5xl px-2 sm:px-6">
      <div className="mb-5 flex flex-col items-center">
        <div className="text-lg font-black uppercase tracking-[0.15em] text-amber-100/75 sm:text-xl">
          Act {currentAct} of {ACTS_PER_RUN}
        </div>
        <div className="mt-2 h-px w-44 bg-gradient-to-r from-transparent via-amber-300/60 to-transparent" />
      </div>

      <div className="relative rounded-[28px] border border-amber-900/45 bg-stone-950/45 px-4 pb-4 pt-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_50px_rgba(0,0,0,0.28)] sm:px-7">
        <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-[radial-gradient(circle_at_16%_20%,rgba(245,158,11,0.14),transparent_34%),radial-gradient(circle_at_84%_28%,rgba(127,29,29,0.18),transparent_36%),linear-gradient(180deg,rgba(120,53,15,0.16),transparent_62%)]" />
        <div className="pointer-events-none absolute left-10 right-10 top-[45px] h-px bg-gradient-to-r from-amber-500/20 via-stone-500/45 to-red-500/25 blur-sm" />

        <div className="relative flex items-start justify-between gap-2 sm:gap-3">
          {Array.from({ length: nodeCount }, (_, i) => {
            const isCompleted = i < destinationIndexInAct;
            const isCurrent = i === destinationIndexInAct;
            const isBoss = i === nodeCount - 1;
            const isFuture = i > destinationIndexInAct;
            const completedDest = completedDestinations[i] as Destination | undefined;
            const label = nodeLabel(i, completedDest, isCurrent, isBoss);

            return (
              <div key={i} className={cn("relative flex min-w-0 flex-1 flex-col items-center", isBoss && "flex-none")}>
                {i < nodeCount - 1 && (
                  <div
                    className={cn(
                      "absolute left-1/2 top-6 h-[2px] w-full overflow-hidden rounded-full bg-stone-700/70",
                      isCompleted && "bg-gradient-to-r from-amber-300/85 via-amber-400/50 to-amber-700/60",
                      isCurrent && "bg-gradient-to-r from-amber-300/85 via-amber-400/35 to-stone-700/70"
                    )}
                  >
                    <div className="absolute inset-0 bg-black/25" />
                  </div>
                )}

                <div
                  className={cn(
                    "group relative z-10 flex h-12 w-12 items-center justify-center rounded-full border transition-all duration-300 ease-out",
                    "shadow-[0_0_0_1px_rgba(255,255,255,0.04)]",
                    isCompleted && completedDest && completedNodeClasses[completedDest],
                    isCompleted && "shadow-lg",
                    isCurrent && "border-amber-200/90 bg-amber-400 text-stone-950 shadow-[0_0_30px_rgba(251,191,36,0.48)]",
                    isFuture && !isBoss && "border-stone-500/35 bg-stone-950/90 text-stone-400",
                    isBoss && "h-14 w-14 border-red-400/70 bg-red-950/85 text-red-300 shadow-[0_0_30px_rgba(127,29,29,0.42)]"
                  )}
                  aria-label={label}
                >
                  <span
                    className={cn(
                      "absolute inset-[3px] rounded-full border",
                      isCompleted && "border-white/15 bg-white/[0.04]",
                      isCurrent && "border-white/40 bg-white/20",
                      isFuture && !isBoss && "border-white/10 bg-white/[0.03]",
                      isBoss && "border-red-300/25 bg-red-400/10"
                    )}
                  />

                  {isCompleted && completedDest ? (
                    <span className="relative z-10 transition-all duration-300">
                      <DestIcon dest={completedDest} className="h-5 w-5" />
                      <Check className="absolute -right-2 -top-2 h-3.5 w-3.5 rounded-full bg-stone-950/90 p-0.5 text-amber-200" />
                    </span>
                  ) : isCurrent ? (
                    <Sparkles className="relative z-10 h-5 w-5 drop-shadow-sm" />
                  ) : isBoss ? (
                    <Skull className="relative z-10 h-6 w-6" />
                  ) : (
                    <CircleHelp className="relative z-10 h-5 w-5" />
                  )}

                  {isCurrent && <span className="absolute -bottom-3 h-2 w-2 rotate-45 rounded-[2px] bg-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.85)]" />}
                  {isBoss && <span className="absolute -inset-1 rounded-full border border-red-500/30" />}
                </div>

                <div className="mt-4 flex h-9 max-w-[5.8rem] flex-col items-center justify-start sm:max-w-none">
                  <div
                    className={cn(
                      "truncate text-[0.62rem] font-black uppercase tracking-[0.14em] sm:text-xs sm:tracking-wider",
                      isCompleted && "text-stone-200",
                      isCurrent && "text-amber-300",
                      isFuture && !isBoss && "text-stone-500",
                      isBoss && "text-red-400"
                    )}
                  >
                    {label}
                  </div>
                  {isCurrent && <div className="mt-1 text-[0.56rem] font-bold uppercase tracking-[0.18em] text-amber-100/70 sm:text-[10px]">Current</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
