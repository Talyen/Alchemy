import { cn } from "@/lib/utils";
import { ANIMATION_STAGGER_UNIT } from "@/lib/game-constants";

export function staggerDelay(position: number): number {
  return ANIMATION_STAGGER_UNIT * position;
}

export function ShimmerOverlay({
  active,
  token,
  rounded = "rounded-[30px]",
}: {
  active: boolean;
  token: number | undefined;
  rounded?: string;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-10 overflow-hidden",
        rounded,
        active ? "card-shimmer-active" : "",
      )}
    >
      <div
        key={active ? token : undefined}
        className={cn("card-shimmer-sweep", active ? "opacity-100" : "opacity-0")}
      />
    </div>
  );
}
