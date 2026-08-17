// High-frequency transfer overlay leaf — subscribes to presentation store without re-rendering BattleScreen.
import { useBattlePresentationStore } from "../battle-presentation-store";
import { CardTransferOverlay } from "./card-transfer-overlay";

export function CardTransferLayer() {
  const cardTransfers = useBattlePresentationStore((s) => s.cardTransfers);
  return (
    <>
      {cardTransfers.map((transfer) => (
        <CardTransferOverlay key={transfer.id} transfer={transfer} />
      ))}
    </>
  );
}
