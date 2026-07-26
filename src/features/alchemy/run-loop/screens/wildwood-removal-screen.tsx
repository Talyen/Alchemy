// Free optional Wildwood Draft card-removal screen between boss encounters.
import type { BattleCard } from "@/lib/game-data";

import { RemoveCardPanel } from "../../shared/ui/remove-card-panel";
import { ScreenDescription, ScreenHeader } from "../../shared/ui/shared-ui";

interface Props {
  runDeck: BattleCard[];
  onRemove: (index: number) => void;
  onSkip: () => void;
}

export function WildwoodRemovalScreen({ runDeck, onRemove, onSkip }: Props) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-4 py-6 text-center">
      <RemoveCardPanel
        runDeck={runDeck}
        intro={
          <>
            <ScreenHeader title="Refine Your Deck" />
            <ScreenDescription className="mb-4">Remove one card, or continue without removing one.</ScreenDescription>
          </>
        }
        onConfirm={onRemove}
        onCancel={onSkip}
        cancelLabel="Skip"
        escapeCancels={false}
      />
    </div>
  );
}
