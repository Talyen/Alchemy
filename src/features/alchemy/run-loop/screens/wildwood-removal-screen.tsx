// Free optional Wildwood Draft card-removal screen between boss encounters.
import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BattleCard } from "@/lib/game-data";
import { SELECTION_GRID_PAGE_SIZE } from "@/lib/game-constants";
import { CardSelectionGrid } from "../../shared/ui/card-selection-grid";
import { SelectableShopCard } from "../../shared/ui/shop-card-item";
import { ScreenDescription, ScreenHeader, StaggerGroup, StaggerItem } from "../../shared/ui/shared-ui";

type Props = {
  runDeck: BattleCard[];
  onRemove: (index: number) => void;
  onSkip: () => void;
};

export function WildwoodRemovalScreen({ runDeck, onRemove, onSkip }: Props) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const items = useMemo(() => runDeck.map((card, index) => ({ card, index })), [runDeck]);
  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-4 py-6 text-center">
      <StaggerGroup className="flex w-full flex-col items-center">
        <StaggerItem index={0}>
          <ScreenHeader title="Refine Your Deck" />
        </StaggerItem>
        <StaggerItem index={1}>
          <ScreenDescription className="mb-4">Remove one card, or continue without removing one.</ScreenDescription>
        </StaggerItem>
        <StaggerItem index={2} className="w-full">
          <CardSelectionGrid
            items={items}
            page={page}
            onPageChange={setPage}
            pageSize={SELECTION_GRID_PAGE_SIZE}
            paginationSize="default"
            paginationReserveSpace
            renderItem={({ card, index }) => (
              <SelectableShopCard
                card={card}
                isSelected={selectedIndex === index}
                onSelect={() => setSelectedIndex(index)}
              />
            )}
          />
        </StaggerItem>
        <StaggerItem index={3}>
          <div className="mt-5 flex justify-center gap-3">
            <Button size="lg" variant="outline" onClick={onSkip}>
              Skip
            </Button>
            <Button
              size="lg"
              disabled={selectedIndex === null}
              onClick={() => selectedIndex !== null && onRemove(selectedIndex)}
            >
              <Trash2 className="h-4 w-4" /> Remove Card
            </Button>
          </div>
        </StaggerItem>
      </StaggerGroup>
    </div>
  );
}
