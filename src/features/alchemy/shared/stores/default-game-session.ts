import * as audio from "@/lib/audio";
import { generateRunSeed } from "./run-state-init";
import { createSessionRuntime } from "./session-runtime";
import { useUiStore } from "./ui-store";

/** The shipping application owns one session; independent consumers create their own. */
export const defaultGameSession = createSessionRuntime(
  {
    runtimeInputs: { generateRunSeed },
    feedback: {
      playUISound: (sound) => audio.playUISound(sound),
      playGoldGain: () => audio.playGoldGain(),
      playGoldSpend: () => audio.playGoldSpend(),
      playVictory: () => audio.playVictory(),
      playRunVictory: () => audio.playRunVictory(),
      playDefeat: () => audio.playDefeat(),
      stopAllSfx: () => audio.stopAllSfx(),
      clearCardHover: () => useUiStore.getState().clearCardHover(),
      clearBattleUi: () => {
        useUiStore.getState().setCardInspection(null);
        useUiStore.getState().setEnemyInspectionOpen(false);
        useUiStore.getState().clearCardHover();
      },
      resetTransientUi: () => useUiStore.setState(useUiStore.getInitialState(), true),
      clearSaveConfirmation: () => useUiStore.getState().setShowClearSaveConfirm(false),
    },
  },
  true,
);
