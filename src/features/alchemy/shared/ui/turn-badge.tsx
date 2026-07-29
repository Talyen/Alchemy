// Turn indicator badge for battle actor panels.
import { cn } from "@/lib/utils";

export function TurnBadge({
  show,
  variant,
  urgentHide = false,
}: {
  show: boolean;
  variant: "player" | "enemy";
  urgentHide?: boolean;
}) {
  return (
    <div
      className={cn(
        "absolute left-1/2 z-20 rounded-md px-3 py-1 text-sm whitespace-nowrap transition-all",
        urgentHide ? "duration-150" : "duration-500",
        show ? "opacity-100" : "pointer-events-none opacity-0",
        variant === "player" ? "bg-emerald-900/70 text-emerald-300" : "bg-rose-900/70 text-rose-300",
      )}
      style={{
        top: "calc(100% + clamp(0.75cqh, 1.5cqh, 2.5cqh))",
        transform: show ? "translateX(-50%) scale(1)" : "translateX(-50%) scale(0.6)",
      }}
    >
      {variant === "player" ? "Your Turn" : "Enemy Turn"}
    </div>
  );
}
