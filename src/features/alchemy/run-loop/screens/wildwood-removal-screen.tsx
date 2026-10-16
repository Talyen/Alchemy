import { useGameTranslation } from "@/components/use-game-translation";

import type { BattleCard } from "@/lib/game-data";

import { RemoveCardPanel } from "../../shared/ui/remove-card-panel";
import { TitledScreenShell } from "../../shared/ui/layout-components";

interface Props {
  runDeck: BattleCard[];
  onRemove: (index: number) => void;
  onSkip: () => void;
}

export function WildwoodRemovalScreen({ runDeck, onRemove, onSkip }: Props) {
  const i18n = useGameTranslation();
  return (
    <TitledScreenShell title={i18n.text("ui.wildwood-removal-screen.1", "Refine Your Deck")}>
      <div className="mt-6 text-center">
        <RemoveCardPanel
          runDeck={runDeck}
          compact
          onConfirm={onRemove}
          onCancel={onSkip}
          cancelLabel={i18n.text("ui.wildwood-removal-screen.2", "Skip")}
          escapeCancels={false}
        />
      </div>
    </TitledScreenShell>
  );
}
