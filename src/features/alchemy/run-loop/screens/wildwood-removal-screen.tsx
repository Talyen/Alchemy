import { useGameTranslation } from "@/components/use-game-translation";
import { text as gameText } from "@/lib/localization/runtime";
import type { BattleCard } from "@/lib/game-data";

import { RemoveCardPanel } from "../../shared/ui/remove-card-panel";
import { TitledScreenShell } from "../../shared/ui/layout-components";

interface Props {
  runDeck: BattleCard[];
  onRemove: (index: number) => void;
  onSkip: () => void;
}

export function WildwoodRemovalScreen({ runDeck, onRemove, onSkip }: Props) {
  useGameTranslation();
  return (
    <TitledScreenShell title={gameText("ui.wildwood-removal-screen.1", "Refine Your Deck")}>
      <div className="mt-6 text-center">
        <RemoveCardPanel
          runDeck={runDeck}
          compact
          onConfirm={onRemove}
          onCancel={onSkip}
          cancelLabel={gameText("ui.wildwood-removal-screen.2", "Skip")}
          escapeCancels={false}
        />
      </div>
    </TitledScreenShell>
  );
}
