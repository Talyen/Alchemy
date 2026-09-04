import type { BattleCard } from "@/lib/game-data";

import { RemoveCardPanel } from "../../shared/ui/remove-card-panel";
import { TitledScreenShell } from "../../shared/ui/shared-ui";

interface Props {
  runDeck: BattleCard[];
  onRemove: (index: number) => void;
  onSkip: () => void;
}

export function WildwoodRemovalScreen({ runDeck, onRemove, onSkip }: Props) {
  return (
    <TitledScreenShell title="Refine Your Deck">
      <div className="mt-6 text-center">
        <RemoveCardPanel
          runDeck={runDeck}
          compact
          onConfirm={onRemove}
          onCancel={onSkip}
          cancelLabel="Skip"
          escapeCancels={false}
        />
      </div>
    </TitledScreenShell>
  );
}
