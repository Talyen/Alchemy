// Wildwood boss selection screen. Shows available bosses with their stats.
// Player picks one to fight directly as a single-boss challenge.
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { enemyBestiary } from "@/lib/game-data";
import { WILDWOOD_BOSS_IDS } from "@/lib/content-systems/wildwood/bosses";
import { ShineBorder } from "@/components/ui/shine-border";
import { cn } from "@/lib/utils";
import { battleCardWidthClass, cardSurfaceClass } from "../config";
import { EnemyTooltip } from "../ui/enemy-tooltip";
import { ScreenHeader } from "../ui/shared-ui";

export function WildwoodSelectScreen({ onSelect, onBack }: { onSelect: (bossId: string) => void; onBack: () => void }) {
  const [selectedBossId, setSelectedBossId] = useState<string | null>(null);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-4 py-6 text-center">
      <ScreenHeader title="Choose Your Prey" />

      <div className="flex flex-wrap items-start justify-center gap-6">
        {WILDWOOD_BOSS_IDS.map((bossId) => {
          const enemy = enemyBestiary.find((e) => e.id === bossId);
          const isSelected = selectedBossId === bossId;

          return (
            <button
              key={bossId}
              type="button"
              className={cn(
                "group/wildwood-boss relative flex h-[clamp(388px,calc(29.4cqh+92px),540px)] w-[clamp(270px,24cqh,368px)] flex-col items-center rounded-[30px] border border-border/60 bg-card/60 p-4 text-center",
              )}
              aria-label={enemy?.title ?? bossId}
              data-testid={`wildwood-boss-${bossId}`}
              onClick={() => setSelectedBossId(bossId)}
            >
              {enemy ? (
                <div
                  data-testid={`wildwood-boss-tooltip-${bossId}`}
                  className="pointer-events-none opacity-0 transition-opacity duration-150 group-hover/wildwood-boss:pointer-events-auto group-hover/wildwood-boss:opacity-100 group-focus-visible/wildwood-boss:pointer-events-auto group-focus-visible/wildwood-boss:opacity-100"
                >
                  <EnemyTooltip entry={enemy} />
                </div>
              ) : null}
              {isSelected && (
                <ShineBorder
                  shineColor={["#450a0a", "#ef4444", "#991b1b", "#7f1d1d"]}
                  borderWidth={2}
                  duration={8}
                  className="z-10 rounded-[30px]"
                />
              )}
              {enemy ? (
                <div className={cn(cardSurfaceClass, battleCardWidthClass)}>
                  <img
                    src={enemy.art}
                    alt={enemy.title}
                    className="block w-full rounded-[30px] aspect-[3/4] object-cover"
                    loading="eager"
                  />
                </div>
              ) : null}
              <div className={cn("mt-3 flex h-12 flex-col items-center justify-start", battleCardWidthClass)}>
                <p className="font-display text-base font-bold leading-tight text-amber-100/75">
                  {enemy?.title ?? bossId}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex gap-4">
        <Button size="lg" variant="outline" className="w-40" onClick={onBack}>
          Back
        </Button>
        <Button
          size="lg"
          className="w-40"
          disabled={!selectedBossId}
          onClick={() => {
            if (selectedBossId) onSelect(selectedBossId);
          }}
        >
          Hunt
        </Button>
      </div>
    </div>
  );
}
