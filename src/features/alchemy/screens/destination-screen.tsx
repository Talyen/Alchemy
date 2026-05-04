// Destination choice screen — pick the next node on the map.
import type { MutableRefObject } from "react";

import { DestinationChoices } from "../ui/shared-ui";
import type { Destination } from "../types";

export function DestinationScreen({
  destinationOptions,
  onChoose,
  destinationButtonRefs,
}: {
  destinationOptions: Destination[];
  onChoose: (destination: Destination) => void;
  destinationButtonRefs: MutableRefObject<Partial<Record<Destination, HTMLButtonElement | null>>>;
}) {
  return (
    <div className="flex h-full w-full items-center justify-center px-4 py-6">
      <div className="alchemy-shell w-full max-w-6xl rounded-[30px] border border-border/80 px-6 py-7 text-center sm:px-8">
        <h1 className="text-4xl font-semibold text-foreground">
          Choose Destination
        </h1>

        <DestinationChoices
          destinationOptions={destinationOptions}
          onChoose={onChoose}
          buttonRefs={destinationButtonRefs}
        />
      </div>
    </div>
  );
}
