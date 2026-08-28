import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function StarRating({ current, max, className }: { current: number; max: number; className?: string }) {
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          className={cn("h-3 w-3", i < current ? "text-amber-400" : "text-muted-foreground", className)}
          fill={i < current ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}
