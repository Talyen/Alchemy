// Options screen with display, sound, gameplay, and save-data tabs.
import { useState } from "react";
import { House, Swords } from "lucide-react";
import { motion } from "motion/react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import { displayModeOptions, resolutionOptions, uiScaleOptions } from "../config";
import {
  ConfirmationDialog,
  DisplayModeSelect,
  PageLayout,
  ResolutionSelect,
  ScreenHeader,
  UiScaleSelect,
} from "../ui/shared-ui";
import type { DisplayMode, ResolutionOption, UiScale } from "../types";
import { useBattleStore } from "../stores/battle-store";

type OptionsTab = "display" | "sound" | "gameplay" | "other";

type OptionsNavigationProps = {
  onMainMenu: () => void;
  onReturnToBattle: () => void;
};

type DisplayOptionsProps = {
  selectedResolution: ResolutionOption;
  onResolutionChange: (resolution: ResolutionOption) => void;
  displayMode: DisplayMode;
  onDisplayModeChange: (mode: DisplayMode) => void;
  showDisplayMode: boolean;
  uiScale: UiScale;
  onUiScaleChange: (scale: UiScale) => void;
  brightness: number;
  onBrightnessChange: (value: number) => void;
};

type AudioOptionsProps = {
  masterVol: number;
  musicVol: number;
  sfxVol: number;
  onMasterVolChange: (value: number) => void;
  onMusicVolChange: (value: number) => void;
  onSfxVolChange: (value: number) => void;
  muteInBackground: boolean;
  onMuteInBackgroundChange: (checked: boolean) => void;
};

type GameplayOptionsProps = {
  autoEndTurn: boolean;
  onAutoEndTurnChange: (checked: boolean) => void;
};

type SaveDataOptionsProps = {
  showClearSaveConfirm: boolean;
  onOpenClearSaveConfirm: () => void;
  onCloseClearSaveConfirm: () => void;
  onConfirmClearSave: () => void;
  onResetOptions: () => void;
};

type DevOptionsProps = {
  onUnlockAll: () => void;
};

// Keeps slider rows consistent so volume settings read as one sound board.
function SliderOption({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="surface-muted rounded-[22px] border border-border/70 p-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-sm font-semibold text-primary">{value}%</p>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 w-full accent-primary"
      />
    </div>
  );
}

// Toggle row with a native switch role for boolean options.
function ToggleOption({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
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

// Display options stay together because these controls all affect the rendered game stage.
function DisplayOptionsPanel({ display }: { display: DisplayOptionsProps }) {
  return (
    <div className="space-y-4">
      <ResolutionSelect
        selectedResolution={display.selectedResolution}
        resolutionOptions={resolutionOptions}
        onChange={display.onResolutionChange}
      />
      {display.showDisplayMode ? (
        <DisplayModeSelect
          displayMode={display.displayMode}
          displayModeOptions={displayModeOptions}
          onChange={display.onDisplayModeChange}
        />
      ) : null}
      <UiScaleSelect uiScale={display.uiScale} uiScaleOptions={uiScaleOptions} onChange={display.onUiScaleChange} />
      <SliderOption
        label="Brightness"
        value={display.brightness}
        onChange={display.onBrightnessChange}
        min={50}
        max={150}
      />
    </div>
  );
}

// Audio controls share the same slider/toggle visual language for quick scanning.
function AudioOptionsPanel({ audio }: { audio: AudioOptionsProps }) {
  return (
    <div className="space-y-4">
      <SliderOption label="Master Volume" value={audio.masterVol} onChange={audio.onMasterVolChange} />
      <SliderOption label="Music Volume" value={audio.musicVol} onChange={audio.onMusicVolChange} />
      <SliderOption label="Sound Effects Volume" value={audio.sfxVol} onChange={audio.onSfxVolChange} />
      <ToggleOption
        label="Mute in Background"
        description="Silence music and effects while the game window is not focused."
        checked={audio.muteInBackground}
        onChange={audio.onMuteInBackgroundChange}
      />
    </div>
  );
}

// Gameplay options are separated from save/dev actions so future combat preferences have a clear home.
function GameplayOptionsPanel({ gameplay }: { gameplay: GameplayOptionsProps }) {
  return (
    <div className="space-y-4">
      <ToggleOption
        label="Auto-End Turn"
        description="Automatically end your turn when no cards in hand can be played."
        checked={gameplay.autoEndTurn}
        onChange={gameplay.onAutoEndTurnChange}
      />
    </div>
  );
}

// Destructive save actions and dev unlocks live in the secondary tab to avoid crowding core settings.
function OtherOptionsPanel({ saveData, dev }: { saveData: SaveDataOptionsProps; dev: DevOptionsProps }) {
  return (
    <div className="space-y-4">
      {import.meta.env.DEV ? (
        <div className="surface-muted rounded-[22px] border border-primary/40 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Dev / QA Unlocks</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Unlock every compendium entry and grant every talent node for testing.
              </p>
            </div>
            <Button onClick={dev.onUnlockAll}>Unlock All</Button>
          </div>
        </div>
      ) : null}
      <div className="surface-muted rounded-[22px] border border-border/70 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Options</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Restore display, sound, and gameplay options to their defaults.
            </p>
          </div>
          <Button variant="outline" onClick={saveData.onResetOptions}>
            Reset to Default
          </Button>
        </div>
      </div>
      <div className="surface-muted rounded-[22px] border border-border/70 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Save Data</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Clear discovered collection progress, saved options, and the active run.
            </p>
          </div>
          <Button variant="destructive" onClick={saveData.onOpenClearSaveConfirm}>
            Clear Save Data
          </Button>
        </div>
      </div>
    </div>
  );
}

export function OptionsScreen({
  navigation,
  display,
  audio,
  gameplay,
  saveData,
  dev,
}: {
  navigation: OptionsNavigationProps;
  display: DisplayOptionsProps;
  audio: AudioOptionsProps;
  gameplay: GameplayOptionsProps;
  saveData: SaveDataOptionsProps;
  dev: DevOptionsProps;
}) {
  const [tab, setTab] = useState<OptionsTab>("display");
  const tabPanelClass = "col-start-1 row-start-1 pt-6 text-left";
  const hasActiveBattle = useBattleStore((s) => s.hasActiveBattle);

  return (
    <PageLayout>
      <div className="alchemy-shell flex min-h-[520px] w-full max-w-3xl flex-col rounded-[28px] px-6 py-7 sm:px-8">
        <ScreenHeader title="Options" />

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {(["display", "sound", "gameplay", "other"] as const).map((t) => (
            <motion.span
              key={t}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
            >
              <button
                type="button"
                className={cn(
                  "rounded-full bg-card px-4 py-2 text-sm font-semibold capitalize text-foreground ring-1 ring-offset-1 ring-offset-card transition-all duration-200",
                  tab === t ? "ring-primary/70" : "ring-border/30 hover:ring-border/50",
                )}
                onClick={() => setTab(t)}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            </motion.span>
          ))}
        </div>

        <div className="grid">
          <div
            className={cn(tabPanelClass, tab === "display" ? "state-swap" : "invisible pointer-events-none")}
            aria-hidden={tab !== "display"}
          >
            <DisplayOptionsPanel display={display} />
          </div>

          <div
            className={cn(tabPanelClass, tab === "sound" ? "state-swap" : "invisible pointer-events-none")}
            aria-hidden={tab !== "sound"}
          >
            <AudioOptionsPanel audio={audio} />
          </div>

          <div
            className={cn(tabPanelClass, tab === "gameplay" ? "state-swap" : "invisible pointer-events-none")}
            aria-hidden={tab !== "gameplay"}
          >
            <GameplayOptionsPanel gameplay={gameplay} />
          </div>

          <div
            className={cn(tabPanelClass, tab === "other" ? "state-swap" : "invisible pointer-events-none")}
            aria-hidden={tab !== "other"}
          >
            <OtherOptionsPanel saveData={saveData} dev={dev} />
          </div>
        </div>

        <div className="mt-auto flex flex-wrap justify-center gap-3 pt-6">
          <Button variant="outline" onClick={navigation.onMainMenu}>
            <House className="h-4 w-4" /> Main Menu
          </Button>
          {hasActiveBattle ? (
            <Button onClick={navigation.onReturnToBattle}>
              <Swords className="h-4 w-4" /> Return to Battle
            </Button>
          ) : null}
        </div>
      </div>

      {saveData.showClearSaveConfirm ? (
        <ConfirmationDialog
          title="Clear Save Data?"
          description="This will reset your saved options, active run, and all discovered collection progress. This cannot be undone."
          confirmLabel="Clear Save Data"
          dimBackground={false}
          onConfirm={saveData.onConfirmClearSave}
          onCancel={saveData.onCloseClearSaveConfirm}
        />
      ) : null}
    </PageLayout>
  );
}
