import type { TrinketEntry } from "@/lib/game-data";
import { getTrinketShineGradient } from "@/features/alchemy/shared/config";

import { ShineText } from "./shine-text";

interface Props {
  trinket: Pick<TrinketEntry, "id" | "title">;
  className?: string | undefined;
}

export function TrinketItemTitle({ trinket, className }: Props) {
  return (
    <ShineText gradient={getTrinketShineGradient(trinket.id)} className={className}>
      {trinket.title}
    </ShineText>
  );
}
