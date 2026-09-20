import { useLayoutEffect, useRef } from "react";
import { CircleStop, Skull } from "lucide-react";
import type { RunRecap } from "@/lib/active-run-session";
import { destinationLabel } from "@/lib/routing";
import { destinationMeta } from "@/features/alchemy/shared/config";
import { cn } from "@/lib/utils";

export function RunJourneyStrip({ recap }: { recap: RunRecap }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollLeft = viewport.scrollWidth;
    const bounds = viewport.getBoundingClientRect();
    const ending = viewport.querySelector<HTMLElement>('[data-run-ending="true"]');
    if (ending && ending.getBoundingClientRect().left < bounds.left) {
      viewport.scrollLeft += ending.getBoundingClientRect().left - bounds.left;
    }
    const nodes = [...viewport.querySelectorAll<HTMLElement>("[data-run-room]")];
    const visible = nodes.filter((node) => node.getBoundingClientRect().right > bounds.left);
    for (const [index, node] of visible.entries()) {
      node.style.setProperty("--journey-delay", `${(index / Math.max(1, visible.length)) * 1500}ms`);
      node.dataset.animate = "true";
    }
  }, [recap]);

  if (recap.rooms.length === 0) return null;
  return (
    <div
      ref={viewportRef}
      role="region"
      aria-label="Run journey"
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- the horizontal overflow region must be keyboard-scrollable
      tabIndex={0}
      className="focus-visible:outline-ring w-full max-w-2xl overflow-x-auto rounded-lg px-3 py-4 focus-visible:outline-2"
    >
      <ol className="mx-auto flex w-max min-w-0 items-center py-2">
        {recap.partial ? (
          <li className="mr-3 text-muted-foreground">
            <span aria-hidden>…</span>
            <span className="sr-only">Earlier rooms not recorded</span>
          </li>
        ) : null}
        {recap.rooms.map((room, index) => {
          const previous = recap.rooms[index - 1];
          const section = room.floor !== null ? `Floor ${room.floor}` : `Act ${room.act}`;
          const showSection =
            recap.mode !== "wildwood" && (!previous || room.floor !== previous.floor || room.act !== previous.act);
          const meta = destinationMeta[room.destination];
          const Icon = meta.icon;
          const terminal = room.id === recap.endingRoomId;
          const death = terminal && recap.ending === "death";
          return (
            <li key={room.id} className="flex shrink-0 items-center">
              {showSection ? <span className="mx-3 text-xs text-muted-foreground">{section}</span> : null}
              <span data-run-room data-run-ending={terminal} className="run-journey-room flex items-center">
                {index > 0 ? <span aria-hidden className="run-journey-line h-px w-5 bg-border" /> : null}
                <span
                  className={cn(
                    "run-journey-icon relative flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background",
                    meta.accentClassName,
                  )}
                >
                  <Icon aria-hidden className="h-4 w-4" />
                  {terminal ? (
                    death ? (
                      <Skull
                        aria-hidden
                        className="absolute -right-2 -bottom-2 h-4 w-4 rounded-full bg-background text-red-400"
                      />
                    ) : (
                      <CircleStop
                        aria-hidden
                        className="absolute -right-2 -bottom-2 h-4 w-4 rounded-full bg-background text-muted-foreground"
                      />
                    )
                  ) : null}
                </span>
              </span>
              <span className="sr-only">
                {destinationLabel(room.destination)}
                {death
                  ? ", defeated here"
                  : terminal
                    ? ", run ended here"
                    : room.completed
                      ? ", completed"
                      : ", visited"}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
