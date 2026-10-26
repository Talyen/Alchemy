import { Star } from "lucide-react";
import { useId, useState, type CSSProperties } from "react";

import { useGameTranslation } from "@/components/use-game-translation";
import { useReducedMotionPreference } from "@/components/ui/use-reduced-motion-preference";
import { destinationMeta } from "@/features/alchemy/shared/config";
import { DESTINATIONS_PER_ACT } from "@/lib/game-constants";
import { playUISound } from "@/lib/audio";
import { GAME_EDITION_POLICY } from "@/lib/game-edition";
import { DESTINATIONS, destinationLabel, type Destination } from "@/lib/routing";
import { cn } from "@/lib/utils";

export function DestinationRoomProgress({
  currentAct,
  destinationIndexInAct,
  completedDestinations,
}: {
  currentAct: number;
  destinationIndexInAct: number;
  completedDestinations: readonly Destination[];
}) {
  const i18n = useGameTranslation();
  const id = useId();
  const reduceMotion = useReducedMotionPreference();
  const [view, setView] = useState({ act: currentAct, expanded: false });
  const expanded = view.act === currentAct && view.expanded;
  const actCount = GAME_EDITION_POLICY.campaignActs;
  const expandedNodeCount = DESTINATIONS_PER_ACT + actCount - 1;
  const actIndex = Math.min(Math.max(currentAct - 1, 0), actCount - 1);
  const actLabel = ["I", "II", "III"][actIndex] ?? String(currentAct);
  const currentRoom = Math.min(destinationIndexInAct, DESTINATIONS_PER_ACT - 1);

  return (
    <div
      className="destination-progress relative -top-2 mx-auto w-full max-w-2xl px-3 font-sans text-lg sm:text-xl"
      data-expanded={expanded}
      data-reduced-motion={reduceMotion}
      style={
        {
          "--progress-act-count": actCount,
          "--progress-act-index": actIndex,
          "--progress-node-count": expandedNodeCount,
        } as CSSProperties
      }
    >
      <div className="destination-progress-stage mx-1">
        <span aria-hidden="true" className="destination-progress-rail" />
        <ol
          aria-label={i18n.text("ui.room-progress.acts", "Act progress")}
          className="pointer-events-none absolute inset-0"
        >
          {Array.from({ length: actCount }, (_, index) => {
            const current = index === actIndex;
            const label = ["I", "II", "III"][index] ?? String(index + 1);
            const collapsedX = `calc(${index - (actCount - 1) / 2} * var(--progress-step))`;
            const expandedX = current
              ? collapsedX
              : `calc(${index + (index > actIndex ? DESTINATIONS_PER_ACT - 1 : 0) - (expandedNodeCount - 1) / 2} * var(--progress-step))`;

            return (
              <li
                key={index}
                aria-label={i18n.text("ui.room-progress.act", "Act {{act}}", { act: label })}
                aria-current={current && !expanded ? "step" : undefined}
                aria-hidden={current && expanded ? true : undefined}
                className={cn(
                  "destination-progress-position destination-progress-act",
                  current && "destination-progress-active-act",
                )}
                style={{ "--progress-collapsed-x": collapsedX, "--progress-expanded-x": expandedX } as CSSProperties}
              >
                <span
                  className={cn(
                    "destination-progress-node font-serif",
                    current ? "destination-progress-current-node text-gold-light" : "text-muted-foreground/35",
                  )}
                >
                  {label}
                </span>
                {!current && (
                  <button
                    type="button"
                    className="destination-progress-act-trigger"
                    style={{ outline: "none" }}
                    aria-controls={`${id}-rooms`}
                    aria-expanded={expanded}
                    aria-label={i18n.text("ui.room-progress.show-rooms", "Act {{act}}: Show rooms", { act: label })}
                    onClick={() => {
                      setView({ act: currentAct, expanded: true });
                      playUISound("mapNode");
                    }}
                  />
                )}
              </li>
            );
          })}
        </ol>
        <ol
          id={`${id}-rooms`}
          aria-label={i18n.text("ui.room-progress.label", "Room progress")}
          aria-hidden={!expanded}
          inert={!expanded}
          className="pointer-events-none absolute inset-0"
        >
          {Array.from({ length: DESTINATIONS_PER_ACT }, (_, index) => {
            const current = index === currentRoom;
            const completed = index < currentRoom ? completedDestinations[index] : undefined;
            const boss = index === DESTINATIONS_PER_ACT - 1;
            const destination = completed ?? (boss ? DESTINATIONS.BOSS_COMBAT : undefined);
            const meta = !current && destination ? destinationMeta[destination] : undefined;
            const Icon = current ? Star : meta?.icon;
            const room = index + 1;
            const expandedX = `calc(${actIndex + index - (expandedNodeCount - 1) / 2} * var(--progress-step))`;
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
                className="destination-progress-position destination-progress-room"
                style={
                  {
                    "--progress-collapsed-x": `calc(${actIndex - (actCount - 1) / 2} * var(--progress-step))`,
                    "--progress-expanded-x": expandedX,
                    "--progress-node-delay": `${Math.abs(index - currentRoom) * 10}ms`,
                  } as CSSProperties
                }
              >
                <span className="sr-only">{label}</span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "destination-progress-node font-bold",
                    current
                      ? "destination-progress-current-node text-gold-light"
                      : meta
                        ? meta.accentClassName
                        : "text-muted-foreground/35",
                  )}
                >
                  {Icon ? <Icon className={cn("shrink-0", current && "fill-current")} /> : "?"}
                </span>
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          className="destination-progress-toggle"
          // Focus belongs to one circular node, rather than this expanding hit area.
          style={{ outline: "none" }}
          aria-controls={`${id}-rooms`}
          aria-expanded={expanded}
          aria-label={
            expanded
              ? i18n.text("ui.room-progress.show-acts", "Act {{act}}: Show acts", { act: actLabel })
              : i18n.text("ui.room-progress.show-rooms", "Act {{act}}: Show rooms", { act: actLabel })
          }
          onClick={() => {
            setView({ act: currentAct, expanded: !expanded });
            playUISound("mapNode");
          }}
        />
      </div>
    </div>
  );
}
