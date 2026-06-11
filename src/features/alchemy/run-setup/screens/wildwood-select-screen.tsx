// Wildwood boss selection screen. Shows available bosses with their stats.
// Player picks one to fight directly as a single-boss challenge.
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { enemyBestiary } from "@/lib/game-data";
import { WILDWOOD_BOSS_IDS } from "@/lib/content-systems/wildwood/bosses";
import { ShineBorder } from "@/components/ui/shine-border";
import { cn } from "@/lib/utils";
import { battleCardWidthClass, cardSurfaceClass, SHINE_PALETTES } from "@/features/alchemy/shared/config";
import { EnemyTooltip } from "../../shared/ui/enemy-tooltip";
import { PressableMotion } from "../../shared/ui/pressable-motion";
import { ScreenHeader, StaggerGroup, StaggerItem } from "../../shared/ui/shared-ui";
import { TiltSurface } from "../../shared/ui/tilt-surface";

export function WildwoodSelectScreen({ onSelect, onBack }: { onSelect: (bossId: string) => void; onBack: () => void }) {
  const [selectedBossId, setSelectedBossId] = useState<string | null>(null);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-4 py-6 text-center">
      <ScreenHeader title="Choose Your Prey" />

      <StaggerGroup className="flex flex-wrap items-start justify-center gap-6">
        {WILDWOOD_BOSS_IDS.map((bossId, index) => {
          const enemy = enemyBestiary.find((e) => e.id === bossId);
          const isSelected = selectedBossId === bossId;
          const selectBoss = () => setSelectedBossId(bossId);

          return (
            <StaggerItem key={bossId} index={index}>
              <PressableMotion disableHoverScale>
                <TiltSurface
                  as="button"
                  ariaLabel={enemy?.title ?? bossId}
                  ariaPressed={isSelected}
                  onClick={selectBoss}
                  testId={`wildwood-boss-${bossId}`}
                  className={cn(
                    "group/wildwood-boss relative flex h-[clamp(388px,calc(29.4cqh+92px),540px)] w-[clamp(270px,24cqh,368px)] flex-col items-center rounded-shell-hero border border-border/60 bg-card/60 p-4 text-center",
                  )}
                >
                  {enemy ? (
                    <div
                      data-testid={`wildwood-boss-tooltip-${bossId}`}
                      className="pointer-events-none opacity-0 transition-opacity duration-150 group-hover/wildwood-boss:pointer-events-auto group-hover/wildwood-boss:opacity-100 group-focus-within/wildwood-boss:pointer-events-auto group-focus-within/wildwood-boss:opacity-100"
                    >
                      <EnemyTooltip entry={enemy} />
                    </div>
                  ) : null}
                  {isSelected && (
                    <ShineBorder
                      shineColor={[...SHINE_PALETTES.wildwoodBossSelection]}
                      borderWidth={2}
                      duration={8}
                      className="z-10 rounded-shell-hero"
                    />
                  )}
                  {enemy ? (
                    <div className={cn(cardSurfaceClass, battleCardWidthClass)}>
                      <img
                        src={enemy.art}
                        alt=""
                        aria-hidden
                        className="block w-full rounded-shell-hero aspect-[3/4] object-cover"
                      />
                    </div>
                  ) : null}
                  <div className={cn("mt-3 flex h-12 flex-col items-center justify-start", battleCardWidthClass)}>
                    <p className="font-display text-base font-bold leading-tight text-amber-100/75">
                      {enemy?.title ?? bossId}
                    </p>
                  </div>
                </TiltSurface>
              </PressableMotion>
            </StaggerItem>
          );
        })}
      </StaggerGroup>

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
