import { useState } from "react";

import { ErrorLogViewer } from "./error-log-viewer";

import { FadeSlot } from "../../shared/ui/fade-slot";
import { ConfirmationDialog, PageLayout, ScreenHeaderRow, ScreenShell, TabBar } from "../../shared/ui/shared-ui";
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
  onBack,
  onMenu,
  display,
  audio,
  gameplay,
  saveData,
  dev,
}: {
  onBack: () => void;
  onMenu?: ((rect: DOMRect) => void) | undefined;
  display: DisplayOptionsProps;
  audio: AudioOptionsProps;
  gameplay: GameplayOptionsProps;
  saveData: SaveDataOptionsProps;
  dev: DevOptionsProps;
}) {
  const [tab, setTab] = useState<OptionsTab>("display");
  const [showErrorLog, setShowErrorLog] = useState(false);

  return (
    <PageLayout>
      <FadeSlot swapKey={showErrorLog ? "error-log" : "options"} className="min-h-[57.78cqh] w-full">
        {showErrorLog ? (
          <ErrorLogViewer onClose={() => setShowErrorLog(false)} />
        ) : (
          <ScreenShell maxWidthClass="max-w-4xl">
            <ScreenHeaderRow title="Options" onBack={onBack} onMenu={onMenu} />

            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <TabBar tabs={optionsTabs} activeTab={tab} onSelectTab={setTab} className="flex-nowrap" />
            </div>

            <FadeSlot swapKey={tab} className="min-h-[42cqh] pt-6 text-left">
              {tab === "display" ? <DisplayOptionsPanel display={display} /> : null}
              {tab === "sound" ? <AudioOptionsPanel audio={audio} /> : null}
              {tab === "gameplay" ? <GameplayOptionsPanel gameplay={gameplay} /> : null}
              {tab === "other" ? (
                <OtherOptionsPanel saveData={saveData} dev={{ ...dev, onOpenErrorLog: () => setShowErrorLog(true) }} />
              ) : null}
            </FadeSlot>
          </ScreenShell>
        )}
      </FadeSlot>

      <ConfirmationDialog
        open={saveData.showClearSaveConfirm}
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
    </PageLayout>
  );
}
