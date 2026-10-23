import { Star } from "lucide-react";

import { useGameTranslation } from "@/components/use-game-translation";
import { destinationMeta } from "@/features/alchemy/shared/config";
import { DESTINATIONS_PER_ACT } from "@/lib/game-constants";
import { DESTINATIONS, destinationLabel, type Destination } from "@/lib/routing";
import { cn } from "@/lib/utils";

export function DestinationRoomProgress({
  destinationIndexInAct,
  completedDestinations,
}: {
  destinationIndexInAct: number;
  completedDestinations: readonly Destination[];
}) {
  const i18n = useGameTranslation();
  const currentRoom = Math.min(destinationIndexInAct, DESTINATIONS_PER_ACT - 1);

  return (
    <ol
      aria-label={i18n.text("ui.room-progress.label", "Room progress")}
      className="mx-auto flex w-full max-w-2xl items-center px-3 font-sans text-lg sm:text-xl"
    >
      {Array.from({ length: DESTINATIONS_PER_ACT }, (_, index) => {
        const current = index === currentRoom;
        const completed = index < currentRoom ? completedDestinations[index] : undefined;
        const boss = index === DESTINATIONS_PER_ACT - 1;
        const destination = completed ?? (boss ? DESTINATIONS.BOSS_COMBAT : undefined);
        const meta = !current && destination ? destinationMeta[destination] : undefined;
        const Icon = meta?.icon;
        const room = index + 1;
        const label = current
          ? i18n.text("ui.room-progress.current", "Room {{room}}: You are here", { room })
          : completed
            ? i18n.text("ui.room-progress.completed", "Room {{room}}: {{destination}} (completed)", {
                room,
                destination: i18n.displayText(destinationLabel(completed)),
              })
            : boss
              ? i18n.text("ui.room-progress.boss", "Room {{room}}: Boss", { room })
              : i18n.text("ui.room-progress.future", "Room {{room}}: Unknown", { room });

        return (
          <li
            key={room}
            aria-current={current ? "step" : undefined}
            className="flex min-w-0 flex-1 items-center last:flex-none"
          >
            <span className="sr-only">{label}</span>
            <span
              aria-hidden="true"
              className={cn(
                "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-current bg-background font-bold",
                meta ? meta.accentClassName : "text-muted-foreground/35",
              )}
            >
              {Icon ? <Icon className="shrink-0" /> : "?"}
              {current ? (
                <Star className="absolute -top-4 left-1/2 size-3 -translate-x-1/2 fill-current text-gold-pale" />
              ) : null}
            </span>
            {!boss && <span aria-hidden="true" className="h-px min-w-0 flex-1 bg-border/70" />}
          </li>
        );
      })}
    </ol>
  );
}
