// Star rating display for tier/level progression.
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function StarRating({ current, max }: { current: number; max: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          className={cn("h-3 w-3", i < current ? "text-amber-400" : "text-muted-foreground")}
          fill={i < current ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}
