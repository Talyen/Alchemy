// Free optional Wildwood Draft card-removal screen between boss encounters.
import type { BattleCard } from "@/lib/game-data";

import { RemoveCardPanel } from "../../shared/ui/remove-card-panel";
import { ScreenDescription, TitledScreenShell } from "../../shared/ui/shared-ui";

interface Props {
  runDeck: BattleCard[];
  onRemove: (index: number) => void;
  onSkip: () => void;
  onOpenMenu: (rect?: DOMRect) => void;
}

export function WildwoodRemovalScreen({ runDeck, onRemove, onSkip, onOpenMenu }: Props) {
  return (
    <TitledScreenShell title="Refine Your Deck" onOpenMenu={onOpenMenu} menuLabel="Open wildwood removal menu">
      <div className="mt-6 text-center">
        <RemoveCardPanel
          runDeck={runDeck}
          intro={
            <ScreenDescription className="mb-4">Remove one card, or continue without removing one.</ScreenDescription>
          }
          onConfirm={onRemove}
          onCancel={onSkip}
          cancelLabel="Skip"
          escapeCancels={false}
        />
      </div>
    </TitledScreenShell>
  );
}
