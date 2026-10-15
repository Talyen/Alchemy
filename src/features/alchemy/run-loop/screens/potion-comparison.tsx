import { useGameTranslation } from "@/components/use-game-translation";

import { MoveRight } from "lucide-react";
import type { BattleCard } from "@/lib/game-data";
import { viewCardWidthClass, getCardInspectionShineColors } from "../../shared/config";
import { BattleCardButton } from "../../shared/ui/cards/card-button";
import { CardTitle, getCardDisplayTitle } from "../../shared/ui/cards/card-description-ui";

export function PotionComparison({ original, result }: { original: BattleCard; result: BattleCard }) {
  const i18n = useGameTranslation();
  return (
    <div
      className="grid grid-cols-[1fr_auto_1fr] items-start gap-x-8 gap-y-3"
      aria-label={i18n.text("ui.potion-comparison.1", "Brew comparison")}
    >
      <BattleCardButton
        card={original}
        ariaLabel={i18n.text("ui.potion-comparison.2", "Original: {{value0}}", {
          value0: i18n.read(() => getCardDisplayTitle(original)),
        })}
        className={viewCardWidthClass}
        shineColor={getCardInspectionShineColors(original)}
        shimmerActive={false}
        shimmerToken={undefined}
      />
      <MoveRight aria-hidden="true" className="h-10 w-10 self-center text-gold-pale" />
      <BattleCardButton
        card={result}
        ariaLabel={i18n.text("ui.potion-comparison.3", "Inspect brew result: {{value0}}", {
          value0: i18n.read(() => getCardDisplayTitle(result)),
        })}
        className={viewCardWidthClass}
        shineColor={getCardInspectionShineColors(result)}
        shimmerActive={false}
        shimmerToken={undefined}
      />
      <div className="col-start-1 text-center">
        <CardTitle card={original} />
      </div>
      <div className="col-start-3 text-center">
        <CardTitle card={result} />
      </div>
    </div>
  );
}
