// Options screen with display, sound, gameplay, and save-data tabs.
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import { aspectRatioOptions, displayModeOptions, uiScaleOptions } from "@/features/alchemy/shared/config";
import {
  ConfirmationDialog,
  DisplayModeSelect,
  HamburgerTrigger,
  PageLayout,
  AspectRatioSelect,
  ScreenHeader,
  UiScaleSelect,
  TabBar,
} from "../../shared/ui/shared-ui";
import type { AspectRatioOption, DisplayMode, UiScale } from "../../shared/types";
import { ErrorLogViewer } from "./error-log-viewer";

import { Gamepad2, Monitor, Sliders, Volume2 } from "lucide-react";

type OptionsTab = "display" | "sound" | "gameplay" | "other";

const optionsTabs = [
  { id: "display" as const, label: "Display", icon: Monitor },
  { id: "sound" as const, label: "Sound", icon: Volume2 },
  { id: "gameplay" as const, label: "Gameplay", icon: Gamepad2 },
  { id: "other" as const, label: "Other", icon: Sliders },
];

interface DisplayOptionsProps {
  selectedAspectRatio: AspectRatioOption;
  onAspectRatioChange: (aspectRatio: AspectRatioOption) => void;
  displayMode: DisplayMode;
  onDisplayModeChange: (mode: DisplayMode) => void;
  showDisplayMode: boolean;
  uiScale: UiScale;
  onUiScaleChange: (scale: UiScale) => void;
  brightness: number;
  onBrightnessChange: (value: number) => void;
}

interface AudioOptionsProps {
  masterVol: number;
  musicVol: number;
  sfxVol: number;
  onMasterVolChange: (value: number) => void;
  onMusicVolChange: (value: number) => void;
  onSfxVolChange: (value: number) => void;
  muteInBackground: boolean;
  onMuteInBackgroundChange: (checked: boolean) => void;
}

interface GameplayOptionsProps {
  autoEndTurn: boolean;
  onAutoEndTurnChange: (checked: boolean) => void;
}

interface SaveDataOptionsProps {
  showClearSaveConfirm: boolean;
  onOpenClearSaveConfirm: () => void;
  onCloseClearSaveConfirm: () => void;
  onConfirmClearSave: () => void;
  onResetOptions: () => void;
}

interface DevOptionsProps {
  onClearSave?: () => void;
  onUnlockAll: () => void;
  onOpenErrorLog?: () => void;
}

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
    <div className="surface-muted rounded-shell-panel border border-border/70 p-5">
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
    <div className="surface-muted rounded-shell-panel border border-border/70 p-5">
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
      <AspectRatioSelect
        selectedAspectRatio={display.selectedAspectRatio}
        aspectRatioOptions={aspectRatioOptions}
        onChange={display.onAspectRatioChange}
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
        <>
          <div className="surface-muted rounded-shell-panel border border-primary/40 p-5">
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
          <div className="surface-muted rounded-shell-panel border border-amber-600/40 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Error Log</p>
                <p className="mt-1 text-sm text-muted-foreground">View persisted crash logs — useful after a reload.</p>
              </div>
              <Button variant="outline" onClick={dev.onOpenErrorLog}>
                View Log
              </Button>
            </div>
          </div>
        </>
      ) : null}
      <div className="surface-muted rounded-shell-panel border border-border/70 p-5">
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
      <div className="surface-muted rounded-shell-panel border border-border/70 p-5">
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
  onOpenMenu,
  onBack,
  display,
  audio,
  gameplay,
  saveData,
  dev,
}: {
  onOpenMenu: (rect?: DOMRect) => void;
  onBack: () => void;
  display: DisplayOptionsProps;
  audio: AudioOptionsProps;
  gameplay: GameplayOptionsProps;
  saveData: SaveDataOptionsProps;
  dev: DevOptionsProps;
}) {
  const [tab, setTab] = useState<OptionsTab>("display");
  const [showErrorLog, setShowErrorLog] = useState(false);
  const tabPanelClass = "col-start-1 row-start-1 pt-6 text-left";

  const devWithLog = { ...dev, onOpenErrorLog: dev.onOpenErrorLog ?? (() => setShowErrorLog(true)) };

  if (showErrorLog) {
    return <ErrorLogViewer onClose={() => setShowErrorLog(false)} />;
  }

  return (
    <PageLayout>
      <div className="alchemy-shell flex min-h-[48.15cqh] w-full max-w-3xl flex-col rounded-shell-screen p-7">
        <div className="relative flex w-full items-center justify-center">
          <ScreenHeader title="Options" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2">
            <HamburgerTrigger onClick={onOpenMenu} label="Open options menu" />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <TabBar tabs={optionsTabs} activeTab={tab} onSelectTab={setTab} />
        </div>

        <div className="grid">
          <div
            className={cn(tabPanelClass, tab === "display" ? "state-fade" : "invisible pointer-events-none")}
            aria-hidden={tab !== "display"}
          >
            <DisplayOptionsPanel display={display} />
          </div>

          <div
            className={cn(tabPanelClass, tab === "sound" ? "state-fade" : "invisible pointer-events-none")}
            aria-hidden={tab !== "sound"}
          >
            <AudioOptionsPanel audio={audio} />
          </div>

          <div
            className={cn(tabPanelClass, tab === "gameplay" ? "state-fade" : "invisible pointer-events-none")}
            aria-hidden={tab !== "gameplay"}
          >
            <GameplayOptionsPanel gameplay={gameplay} />
          </div>

          <div
            className={cn(tabPanelClass, tab === "other" ? "state-fade" : "invisible pointer-events-none")}
            aria-hidden={tab !== "other"}
          >
            <OtherOptionsPanel saveData={saveData} dev={devWithLog} />
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <Button variant="outline" className="w-40" onClick={onBack}>
            Back
          </Button>
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
