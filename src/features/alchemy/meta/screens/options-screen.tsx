import { useGameTranslation } from "@/components/use-game-translation";

import "./options/options-layout.css";
import { useState } from "react";
import { cn } from "@/lib/utils";

import { ErrorLogViewer } from "./options/error-log-viewer";

import { FadeSlot } from "../../shared/ui/use-fade";
import { ConfirmationDialog } from "../../shared/ui/dialogs";
import { PageLayout, ScreenHeaderRow, ScreenShell } from "../../shared/ui/layout-components";
import { TabBar } from "../../shared/ui/tab-bar";
import {
  AudioOptionsPanel,
  DisplayOptionsPanel,
  GameplayOptionsPanel,
  OtherOptionsPanel,
  type DevOptionsProps,
  type DisplayOptionsProps,
  type OptionsPreferences,
  type SaveDataOptionsProps,
} from "./options/options-panels";

import { Swords, Monitor, Sliders, Volume2 } from "lucide-react";

type OptionsTab = "display" | "sound" | "gameplay" | "other";

const optionsTabs = [
  { id: "display" as const, label: "Display", icon: Monitor },
  { id: "sound" as const, label: "Sound", icon: Volume2 },
  { id: "gameplay" as const, label: "Gameplay", icon: Swords },
  { id: "other" as const, label: "Other", icon: Sliders },
];

export function OptionsScreen({
  onBack,
  onMenu,
  display,
  preferences,
  saveData,
  dev,
}: {
  onBack: () => void;
  onMenu?: ((rect: DOMRect) => void) | undefined;
  display: DisplayOptionsProps;
  preferences: OptionsPreferences;
  saveData: SaveDataOptionsProps;
  dev: DevOptionsProps;
}) {
  const i18n = useGameTranslation();
  const [tab, setTab] = useState<OptionsTab>("display");
  const [showErrorLog, setShowErrorLog] = useState(false);

  return (
    <PageLayout>
      <FadeSlot swapKey={showErrorLog ? "error-log" : "options"} className="w-full">
        {showErrorLog ? (
          <ErrorLogViewer onClose={() => setShowErrorLog(false)} />
        ) : (
          <ScreenShell maxWidthClass="max-w-4xl" className="p-4">
            <ScreenHeaderRow title={i18n.text("ui.options-screen.1", "Options")} onBack={onBack} onMenu={onMenu} />

            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <TabBar tabs={optionsTabs} activeTab={tab} onSelectTab={setTab} />
            </div>

            <FadeSlot swapKey={tab} className="grid pt-4 text-left">
              {[
                { id: "display", panel: <DisplayOptionsPanel display={display} preferences={preferences} /> },
                { id: "sound", panel: <AudioOptionsPanel preferences={preferences} /> },
                { id: "gameplay", panel: <GameplayOptionsPanel preferences={preferences} /> },
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
                  {i18n.displayText(panel)}
                </div>
              ))}
            </FadeSlot>
          </ScreenShell>
        )}
      </FadeSlot>

      <ConfirmationDialog
        open={saveData.showClearSaveConfirm}
        title={i18n.text("ui.options-screen.2", "Clear Save Data")}
        description={i18n.displayText(
          <>
            {i18n.text("options.clear-confirm", "Are you sure you wish to clear all Save Data? This cannot be undone")}
          </>,
        )}
        confirmLabel={i18n.text("ui.options-screen.3", "Clear Save Data")}
        dimBackground={false}
        onConfirm={saveData.onConfirmClearSave}
        onCancel={saveData.onCloseClearSaveConfirm}
      />
    </PageLayout>
  );
}
