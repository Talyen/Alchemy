import { useState } from "react";
import { cn } from "@/lib/utils";

import { ErrorLogViewer } from "./error-log-viewer";

import { FadeSlot } from "../../shared/ui/use-fade";
import { ConfirmationDialog } from "../../shared/ui/dialogs";
import { PageLayout, ScreenHeaderRow, ScreenShell } from "../../shared/ui/layout-components";
import { TabBar } from "../../shared/ui/tab-bar";
import {
  AudioOptionsPanel,
  DisplayOptionsPanel,
  InterfaceOptionsPanel,
  GameplayOptionsPanel,
  OtherOptionsPanel,
  type AudioOptionsProps,
  type DevOptionsProps,
  type DisplayOptionsProps,
  type GameplayOptionsProps,
  type InterfaceOptionsProps,
  type SaveDataOptionsProps,
} from "./options-panels";

import { Gamepad2, Monitor, PanelsTopLeft, Sliders, Volume2 } from "lucide-react";

type OptionsTab = "display" | "interface" | "sound" | "gameplay" | "other";

const optionsTabs = [
  { id: "display" as const, label: "Display", icon: Monitor },
  { id: "interface" as const, label: "Interface", icon: PanelsTopLeft },
  { id: "sound" as const, label: "Sound", icon: Volume2 },
  { id: "gameplay" as const, label: "Gameplay", icon: Gamepad2 },
  { id: "other" as const, label: "Other", icon: Sliders },
];

export function OptionsScreen({
  onBack,
  onMenu,
  display,
  interface: interfaceOptions,
  audio,
  gameplay,
  saveData,
  dev,
}: {
  onBack: () => void;
  onMenu?: ((rect: DOMRect) => void) | undefined;
  display: DisplayOptionsProps;
  interface: InterfaceOptionsProps;
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

            <FadeSlot swapKey={tab} className="grid min-h-[42cqh] pt-6 text-left">
              {[
                { id: "display", panel: <DisplayOptionsPanel display={display} /> },
                { id: "interface", panel: <InterfaceOptionsPanel interfaceOptions={interfaceOptions} /> },
                { id: "sound", panel: <AudioOptionsPanel audio={audio} /> },
                { id: "gameplay", panel: <GameplayOptionsPanel gameplay={gameplay} /> },
                {
                  id: "other",
                  panel: (
                    <OtherOptionsPanel
                      saveData={saveData}
                      dev={{ ...dev, onOpenErrorLog: () => setShowErrorLog(true) }}
                    />
                  ),
                },
              ].map(({ id, panel }) => (
                <div
                  key={id}
                  className={cn("col-start-1 row-start-1", tab !== id && "invisible")}
                  inert={tab !== id}
                  aria-hidden={tab !== id}
                >
                  {panel}
                </div>
              ))}
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
