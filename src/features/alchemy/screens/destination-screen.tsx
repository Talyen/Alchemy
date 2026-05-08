// Destination choice screen — pick the next node on the map.
import type { MutableRefObject } from "react";

import { DestinationChoices, ScreenHeader } from "../ui/shared-ui";
import { ActTimeline } from "../ui/act-timeline";
import type { Destination } from "../types";

export function DestinationScreen({
  destinationOptions,
  onChoose,
  destinationButtonRefs,
  currentAct,
  destinationIndexInAct,
  completedDestinations,
}: {
  destinationOptions: Destination[];
  onChoose: (destination: Destination) => void;
  destinationButtonRefs: MutableRefObject<Partial<Record<Destination, HTMLButtonElement | null>>>;
  currentAct: number;
  destinationIndexInAct: number;
  completedDestinations: Destination[];
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-4 py-6 text-center">
      <ActTimeline
        currentAct={currentAct}
        destinationIndexInAct={destinationIndexInAct}
        completedDestinations={completedDestinations}
      />
      <ScreenHeader title="Choose Destination" />
      <DestinationChoices
        destinationOptions={destinationOptions}
        onChoose={onChoose}
        buttonRefs={destinationButtonRefs}
      />
    </div>
  );
}
