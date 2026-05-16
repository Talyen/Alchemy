// Wildwood boss selection screen. Shows available bosses with their stats.
// Player picks one to fight directly as a single-boss challenge.
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { enemyBestiary } from "@/lib/game-data";
import { WILDWOOD_BOSSES } from "@/lib/content-systems/wildwood/bosses";
import { ScreenHeader } from "../ui/shared-ui";

export function WildwoodSelectScreen({ onSelect, onBack }: { onSelect: (bossId: string) => void; onBack: () => void }) {
  const [selectedBossId, setSelectedBossId] = useState<string | null>(null);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-4 py-6 text-center">
      <ScreenHeader title="Choose Your Prey" />

      <div className="flex flex-wrap items-start justify-center gap-6">
        {WILDWOOD_BOSSES.map((entry) => {
          const enemy = enemyBestiary.find((e) => e.id === entry.bossId);
          const isSelected = selectedBossId === entry.bossId;
          return (
            <button
              key={entry.bossId}
              type="button"
              className={`flex w-56 flex-col items-center gap-2 rounded-xl border p-4 transition-colors ${
                isSelected ? "border-primary bg-primary/10" : "border-border/60 bg-card/60 hover:border-muted-foreground/40"
              }`}
              onClick={() => setSelectedBossId(entry.bossId)}
            >
              {enemy ? (
                <img src={enemy.art} alt={entry.title} className="h-32 w-32 rounded-lg object-cover" />
              ) : null}
              <p className="text-lg font-semibold text-foreground">{entry.title}</p>
              <p className="text-sm text-muted-foreground">{entry.subtitle}</p>
              <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                {entry.descriptionLines.map((line, i) => (
                  <span key={i}>{line}</span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex gap-4">
        <Button size="lg" variant="outline" className="w-40" onClick={onBack}>Back</Button>
        <Button size="lg" className="w-40" disabled={!selectedBossId} onClick={() => { if (selectedBossId) onSelect(selectedBossId); }}>
          Hunt
        </Button>
      </div>
    </div>
  );
}
