import { CardGhostOverlay } from "@/features/alchemy/shared/ui/card-ghost-overlay";
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

export function CardGhostLayer() {
  const cardGhosts = useBattlePresentationStore((s) => s.cardGhosts);
  const removeCardGhost = useBattlePresentationStore((s) => s.removeCardGhost);
  return (
    <>
      {cardGhosts.map((ghost) => (
        <CardGhostOverlay key={ghost.id} ghost={ghost} onDone={() => removeCardGhost(ghost.id)} />
      ))}
    </>
  );
}
