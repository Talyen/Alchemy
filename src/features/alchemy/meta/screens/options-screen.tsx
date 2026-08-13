// Options screen with display, sound, gameplay, and save-data tabs.
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { BUTTON_WIDTH_DIALOG } from "@/features/alchemy/shared/config";
import { ErrorLogViewer } from "./error-log-viewer";

import { FadeSlot } from "../../shared/ui/fade-slot";
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

        <FadeSlot swapKey={tab} className="min-h-[42cqh] pt-6 text-left">
          {tab === "display" ? <DisplayOptionsPanel display={display} /> : null}
          {tab === "sound" ? <AudioOptionsPanel audio={audio} /> : null}
          {tab === "gameplay" ? <GameplayOptionsPanel gameplay={gameplay} /> : null}
          {tab === "other" ? (
            <OtherOptionsPanel saveData={saveData} dev={{ ...dev, onOpenErrorLog: () => setShowErrorLog(true) }} />
          ) : null}
        </FadeSlot>

        <div className="mt-6 flex justify-center">
          <Button size="lg" variant="outline" className={BUTTON_WIDTH_DIALOG} onClick={onBack}>
            Back
          </Button>
        </div>
      </ScreenShell>

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
