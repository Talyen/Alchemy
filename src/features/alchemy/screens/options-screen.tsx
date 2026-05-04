// Options screen with display, sound, and save-data tabs.
import { useState } from "react";
import { House, Swords } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setMusicVolume } from "@/lib/audio";

import { PageLayout, ResolutionSelect, ConfirmationDialog } from "../ui/shared-ui";
import { resolutionOptions } from "../config";
import type { ResolutionOption } from "../types";

export function OptionsScreen({
  hasActiveBattle, onMainMenu, onReturnToBattle, selectedResolution, onResolutionChange,
  showClearSaveConfirm, onOpenClearSaveConfirm, onCloseClearSaveConfirm, onConfirmClearSave,
  musicVol, sfxVol, onMusicVolChange, onSfxVolChange,
}: {
  hasActiveBattle: boolean; onMainMenu: () => void; onReturnToBattle: () => void;
  selectedResolution: ResolutionOption; onResolutionChange: (resolution: ResolutionOption) => void;
  showClearSaveConfirm: boolean; onOpenClearSaveConfirm: () => void; onCloseClearSaveConfirm: () => void; onConfirmClearSave: () => void;
  musicVol: number; sfxVol: number; onMusicVolChange: (v: number) => void; onSfxVolChange: (v: number) => void;
}) {
  const [tab, setTab] = useState<"display" | "sound" | "other">("display");

  return (
    <PageLayout>
      <div className="alchemy-shell flex w-full max-w-3xl flex-col rounded-[28px] px-6 py-7 sm:px-8">
        <h1 className="text-center text-3xl font-semibold text-foreground">Options</h1>

        <div className="mt-6 flex justify-center gap-2">
          {(["display", "sound", "other"] as const).map((t) => (
            <button key={t} type="button" className={cn("rounded-full border px-4 py-2 text-sm font-semibold capitalize", tab === t ? "border-primary bg-primary/20 text-primary" : "border-border/80 bg-card text-foreground")} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>

        <div className="mt-6 text-left">
          {tab === "display" ? <ResolutionSelect selectedResolution={selectedResolution} resolutionOptions={resolutionOptions} onChange={onResolutionChange} /> : null}
          {tab === "sound" ? (
            <div className="space-y-5">
              <div className="surface-muted rounded-[22px] border border-border/70 p-5">
                <p className="text-sm font-semibold text-foreground">Music Volume</p>
                <input type="range" min={0} max={100} value={musicVol} onChange={(e) => { onMusicVolChange(Number(e.target.value)); setMusicVolume(Number(e.target.value) / 100); }} className="mt-3 w-full accent-primary" />
              </div>
              <div className="surface-muted rounded-[22px] border border-border/70 p-5">
                <p className="text-sm font-semibold text-foreground">Sound Effects Volume</p>
                <input type="range" min={0} max={100} value={sfxVol} onChange={(e) => onSfxVolChange(Number(e.target.value))} className="mt-3 w-full accent-primary" />
              </div>
            </div>
          ) : null}
          {tab === "other" ? (
            <div className="surface-muted rounded-[22px] border border-border/70 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Save Data</p>
                  <p className="mt-1 text-sm text-muted-foreground">Clear discovered collection progress and saved options.</p>
                </div>
                <Button variant="destructive" onClick={onOpenClearSaveConfirm}>Clear Save Data</Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="outline" onClick={onMainMenu}><House className="h-4 w-4" /> Main Menu</Button>
        {hasActiveBattle ? <Button onClick={onReturnToBattle}><Swords className="h-4 w-4" /> Return to Battle</Button> : null}
      </div>

      {showClearSaveConfirm ? <ConfirmationDialog title="Clear Save Data?" description="This will reset your saved resolution setting and all discovered collection progress. This cannot be undone." confirmLabel="Clear Save Data" onConfirm={onConfirmClearSave} onCancel={onCloseClearSaveConfirm} /> : null}
    </PageLayout>
  );
}
