// Destination choice screen — pick the next node on the map.
import { useMemo } from "react";

import { keywordDefinitions } from "@/lib/game-data";

import { getBossEnemy, keywordAliases } from "../config";
import { DestinationChoices, ScreenHeader } from "../ui/shared-ui";
import { DESTINATIONS, type Destination } from "../types";
import { useScreenStore } from "../stores/screen-store";
import { useRunStore } from "../stores/run-store";

export function DestinationScreen({ onChoose }: { onChoose: (destination: Destination) => void }) {
  const destinationOptions = useScreenStore((s) => s.rewardState.destinations);
  const currentAct = useRunStore((s) => s.currentAct);
  const bossOnly = destinationOptions.length === 1 && destinationOptions[0] === DESTINATIONS.BOSS_COMBAT;
  const boss = bossOnly ? getBossEnemy(currentAct) : null;

  const bossShineColors = useMemo(() => {
    if (!bossOnly) return [];
    const boss = getBossEnemy(currentAct);
    const matchedIds = new Set<string>();

    // Boss headers borrow the enemy's combat vocabulary so the warning colors match the fight.
    const traitText = boss.traits.map((t) => t.description).join(" ");
    for (const alias of keywordAliases) {
      if (traitText.includes(alias.match)) {
        matchedIds.add(alias.keywordId);
      }
    }

    for (const effect of boss.attackEffects) {
      if (effect.kind === "damage" && effect.damageType in keywordDefinitions) {
        matchedIds.add(effect.damageType);
      } else if (effect.kind === "player-status" && effect.status in keywordDefinitions) {
        matchedIds.add(effect.status);
      }
    }

    const colors: string[] = [];
    for (const id of matchedIds) {
      const def = keywordDefinitions[id as keyof typeof keywordDefinitions];
      if (def?.shineColors) {
        colors.push(...def.shineColors);
      }
    }
    return colors.length > 0 ? colors : ["#cbd5e1", "#64748b", "#cbd5e1"];
  }, [bossOnly, currentAct]);
  const bossTextGradient = `linear-gradient(60deg, ${bossShineColors.join(",")})`;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-4 py-6 text-center">
      {bossOnly ? (
        <ScreenHeader
          title={
            <span
              className="boss-title-shine bg-clip-text text-transparent [background-size:300%_300%]"
              style={{ backgroundImage: bossTextGradient }}
            >
              {boss?.title}
            </span>
          }
        />
      ) : (
        <ScreenHeader title="Choose Destination" />
      )}
      <DestinationChoices destinationOptions={destinationOptions} onChoose={onChoose} />
    </div>
  );
}
