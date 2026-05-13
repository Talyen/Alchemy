// Options screen with display, sound, gameplay, and save-data tabs.
import { useState } from "react";
import { House, Swords } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import { displayModeOptions, resolutionOptions, uiScaleOptions } from "../config";
import { ConfirmationDialog, DisplayModeSelect, PageLayout, ResolutionSelect, ScreenHeader, UiScaleSelect } from "../ui/shared-ui";
import type { DisplayMode, ResolutionOption, UiScale } from "../types";

type OptionsTab = "display" | "sound" | "gameplay" | "other";

// Keeps slider rows consistent so volume settings read as one sound board.
function SliderOption({ label, value, onChange, min = 0, max = 100 }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number }) {
  return (
    <div className="surface-muted rounded-[22px] border border-border/70 p-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-sm font-semibold text-primary">{value}%</p>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-3 w-full accent-primary" />
    </div>
  );
}

// Toggle row with a native switch role for boolean options.
function ToggleOption({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="surface-muted rounded-[22px] border border-border/70 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Switch checked={checked} onCheckedChange={onChange} />
      </div>
    </div>
  );
}

export function OptionsScreen({
  hasActiveBattle, onMainMenu, onReturnToBattle, selectedResolution, onResolutionChange, displayMode, onDisplayModeChange, showDisplayMode,
  uiScale, onUiScaleChange, masterVol, musicVol, sfxVol, onMasterVolChange, onMusicVolChange, onSfxVolChange,
  brightness, onBrightnessChange, muteInBackground, onMuteInBackgroundChange, autoEndTurn, onAutoEndTurnChange, onResetOptions,
  showClearSaveConfirm, onOpenClearSaveConfirm, onCloseClearSaveConfirm, onConfirmClearSave, onUnlockAll,
}: {
  hasActiveBattle: boolean; onMainMenu: () => void; onReturnToBattle: () => void;
  selectedResolution: ResolutionOption; onResolutionChange: (resolution: ResolutionOption) => void;
  displayMode: DisplayMode; onDisplayModeChange: (mode: DisplayMode) => void; showDisplayMode: boolean;
  uiScale: UiScale; onUiScaleChange: (scale: UiScale) => void;
  brightness: number; onBrightnessChange: (v: number) => void;
  masterVol: number; musicVol: number; sfxVol: number; onMasterVolChange: (v: number) => void; onMusicVolChange: (v: number) => void; onSfxVolChange: (v: number) => void;
  muteInBackground: boolean; onMuteInBackgroundChange: (checked: boolean) => void;
  autoEndTurn: boolean; onAutoEndTurnChange: (checked: boolean) => void;
  onResetOptions: () => void;
  showClearSaveConfirm: boolean; onOpenClearSaveConfirm: () => void; onCloseClearSaveConfirm: () => void; onConfirmClearSave: () => void;
  onUnlockAll: () => void;
}) {
  const [tab, setTab] = useState<OptionsTab>("display");
  const tabPanelClass = "col-start-1 row-start-1 pt-6 text-left";

  return (
    <PageLayout>
      <div className="alchemy-shell flex min-h-[520px] w-full max-w-3xl flex-col rounded-[28px] px-6 py-7 sm:px-8">
        <ScreenHeader title="Options" />

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {(["display", "sound", "gameplay", "other"] as const).map((t) => (
            <button key={t} type="button" className={cn("rounded-full border px-4 py-2 text-sm font-semibold capitalize transition-transform active:scale-95", tab === t ? "border-primary bg-primary/20 text-foreground" : "border-border/80 bg-card text-foreground")} onClick={() => setTab(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
          ))}
        </div>

        <div className="grid">
          <div className={cn(tabPanelClass, tab === "display" ? "state-swap" : "invisible pointer-events-none")} aria-hidden={tab !== "display"}>
            <div className="space-y-4">
              <ResolutionSelect selectedResolution={selectedResolution} resolutionOptions={resolutionOptions} onChange={onResolutionChange} />
              {showDisplayMode ? <DisplayModeSelect displayMode={displayMode} displayModeOptions={displayModeOptions} onChange={onDisplayModeChange} /> : null}
              <UiScaleSelect uiScale={uiScale} uiScaleOptions={uiScaleOptions} onChange={onUiScaleChange} />
              <SliderOption label="Brightness" value={brightness} onChange={onBrightnessChange} min={50} max={150} />
            </div>
          </div>

          <div className={cn(tabPanelClass, tab === "sound" ? "state-swap" : "invisible pointer-events-none")} aria-hidden={tab !== "sound"}>
            <div className="space-y-4">
              <SliderOption label="Master Volume" value={masterVol} onChange={onMasterVolChange} />
              <SliderOption label="Music Volume" value={musicVol} onChange={onMusicVolChange} />
              <SliderOption label="Sound Effects Volume" value={sfxVol} onChange={onSfxVolChange} />
              <ToggleOption label="Mute in Background" description="Silence music and effects while the game window is not focused." checked={muteInBackground} onChange={onMuteInBackgroundChange} />
            </div>
          </div>

          <div className={cn(tabPanelClass, tab === "gameplay" ? "state-swap" : "invisible pointer-events-none")} aria-hidden={tab !== "gameplay"}>
            <div className="space-y-4">
              <ToggleOption label="Auto-End Turn" description="Automatically end your turn when no cards in hand can be played." checked={autoEndTurn} onChange={onAutoEndTurnChange} />
            </div>
          </div>

          <div className={cn(tabPanelClass, tab === "other" ? "state-swap" : "invisible pointer-events-none")} aria-hidden={tab !== "other"}>
            <div className="space-y-4">
              {import.meta.env.DEV ? (
                <>
                <div className="surface-muted rounded-[22px] border border-primary/40 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Dev / QA Unlocks</p>
                      <p className="mt-1 text-sm text-muted-foreground">Unlock every compendium entry and grant every talent node for testing.</p>
                    </div>
                    <Button onClick={onUnlockAll}>Unlock All</Button>
                  </div>
                </div>
                </>
              ) : null}
              <div className="surface-muted rounded-[22px] border border-border/70 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Options</p>
                    <p className="mt-1 text-sm text-muted-foreground">Restore display, sound, and gameplay options to their defaults.</p>
                  </div>
                  <Button variant="outline" onClick={onResetOptions}>Reset to Default</Button>
                </div>
              </div>
              <div className="surface-muted rounded-[22px] border border-border/70 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Save Data</p>
                    <p className="mt-1 text-sm text-muted-foreground">Clear discovered collection progress, saved options, and the active run.</p>
                  </div>
                  <Button variant="destructive" onClick={onOpenClearSaveConfirm}>Clear Save Data</Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-auto flex flex-wrap justify-center gap-3 pt-6">
          <Button variant="outline" onClick={onMainMenu}><House className="h-4 w-4" /> Main Menu</Button>
          {hasActiveBattle ? <Button onClick={onReturnToBattle}><Swords className="h-4 w-4" /> Return to Battle</Button> : null}
        </div>
      </div>

      {showClearSaveConfirm ? <ConfirmationDialog title="Clear Save Data?" description="This will reset your saved options, active run, and all discovered collection progress. This cannot be undone." confirmLabel="Clear Save Data" dimBackground={false} onConfirm={onConfirmClearSave} onCancel={onCloseClearSaveConfirm} /> : null}
    </PageLayout>
  );
}
