// Options screen with display, sound, gameplay, and save-data tabs.
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ConfirmationDialog, HamburgerTrigger, PageLayout, ScreenHeader, TabBar } from "../../shared/ui/shared-ui";
import {
  AudioOptionsPanel,
  DisplayOptionsPanel,
  GameplayOptionsPanel,
  OtherOptionsPanel,
  type AudioOptionsProps,
  type DevOptionsProps,
  type DisplayOptionsProps,
  type GameplayOptionsProps,
  type SaveDataOptionsProps,
} from "./options-panels";

import { Gamepad2, Monitor, Sliders, Volume2 } from "lucide-react";

type OptionsTab = "display" | "sound" | "gameplay" | "other";

const optionsTabs = [
  { id: "display" as const, label: "Display", icon: Monitor },
  { id: "sound" as const, label: "Sound", icon: Volume2 },
  { id: "gameplay" as const, label: "Gameplay", icon: Gamepad2 },
  { id: "other" as const, label: "Other", icon: Sliders },
];

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
  const tabPanelClass = "col-start-1 row-start-1 pt-6 text-left";

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
            <OtherOptionsPanel saveData={saveData} dev={dev} />
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
          title="Clear Save Data"
          description={
            <>
              Are you sure you wish to clear all Save Data?
              <br />
              This cannot be undone.
            </>
          }
          confirmLabel="Clear Save Data"
          dimBackground={false}
          onConfirm={saveData.onConfirmClearSave}
          onCancel={saveData.onCloseClearSaveConfirm}
        />
      ) : null}
    </PageLayout>
  );
}
