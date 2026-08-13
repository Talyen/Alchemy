import { cn } from "@/lib/utils";

export function ShimmerOverlay({
  active,
  token,
  rounded = "rounded-shell-hero",
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
      <div key={active ? token : undefined} className="card-shimmer-sweep" />
    </div>
  );
}
