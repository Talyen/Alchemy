// Options screen with display, sound, gameplay, and save-data tabs.
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { BUTTON_WIDTH_DIALOG } from "@/features/alchemy/shared/config";
import { cn } from "@/lib/utils";
import { ErrorLogViewer } from "./error-log-viewer";

import {
  ConfirmationDialog,
  HamburgerTrigger,
  PageLayout,
  ScreenHeaderRow,
  ScreenShell,
  TabBar,
} from "../../shared/ui/shared-ui";
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
  const [showErrorLog, setShowErrorLog] = useState(false);
  const tabPanelClass = "col-start-1 row-start-1 pt-6 text-left";

  if (showErrorLog) {
    return <ErrorLogViewer onClose={() => setShowErrorLog(false)} />;
  }

  return (
    <PageLayout>
      <ScreenShell maxWidthClass="max-w-3xl">
        <ScreenHeaderRow
          title="Options"
          trailing={<HamburgerTrigger onClick={onOpenMenu} label="Open options menu" />}
        />

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <TabBar tabs={optionsTabs} activeTab={tab} onSelectTab={setTab} />
        </div>

        <div className="grid">
          <div
            className={cn(tabPanelClass, tab === "display" ? "state-fade" : "pointer-events-none invisible")}
            aria-hidden={tab !== "display"}
          >
            <DisplayOptionsPanel display={display} />
          </div>

          <div
            className={cn(tabPanelClass, tab === "sound" ? "state-fade" : "pointer-events-none invisible")}
            aria-hidden={tab !== "sound"}
          >
            <AudioOptionsPanel audio={audio} />
          </div>

          <div
            className={cn(tabPanelClass, tab === "gameplay" ? "state-fade" : "pointer-events-none invisible")}
            aria-hidden={tab !== "gameplay"}
          >
            <GameplayOptionsPanel gameplay={gameplay} />
          </div>

          <div
            className={cn(tabPanelClass, tab === "other" ? "state-fade" : "pointer-events-none invisible")}
            aria-hidden={tab !== "other"}
          >
            <OtherOptionsPanel saveData={saveData} dev={{ ...dev, onOpenErrorLog: () => setShowErrorLog(true) }} />
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <Button size="lg" variant="outline" className={BUTTON_WIDTH_DIALOG} onClick={onBack}>
            Back
          </Button>
        </div>
      </ScreenShell>

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
