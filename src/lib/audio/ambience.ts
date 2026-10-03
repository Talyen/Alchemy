import type { Screen } from "../routing/screens";
import { screenAmbienceSounds } from "./sound-registry";
import { audioState } from "./state";
import { getSoundUrl } from "./url";
import { releaseAudioElement } from "./element";
import { isNonPlayerAudioHost } from "./host";
import { clamp01 } from "../math";
import { SFX_AMBIENCE_VOLUME } from "../game-constants";
import { logError } from "../error-logger";

let requested: string | undefined;
let active: { name: string; element: HTMLAudioElement } | undefined;

function disposeActive() {
  const previous = active;
  active = undefined;
  if (!previous) return;
  previous.element.onerror = null;
  previous.element.onended = null;
  releaseAudioElement(previous.element);
}

export function stopScreenAmbience() {
  requested = undefined;
  disposeActive();
}

export function syncScreenAmbience() {
  if (!requested || audioState.muted || isNonPlayerAudioHost()) {
    disposeActive();
    return;
  }
  if (active?.name !== requested) disposeActive();
  if (!active && typeof Audio !== "undefined") {
    const name = requested;
    try {
      const element = new Audio(getSoundUrl(name));
      const cue = { name, element };
      active = cue;
      element.loop = true;
      const failed = () => {
        // A late callback from a departed room must not stop the next room's loop.
        if (active !== cue) return;
        disposeActive();
        logError(`Could not play screen ambience: ${name}`, "other");
      };
      element.onerror = failed;
      element.volume = clamp01(SFX_AMBIENCE_VOLUME * audioState.sfxVolume * audioState.masterVolume);
      void Promise.resolve(element.play()).catch(failed);
    } catch (error) {
      disposeActive();
      logError("Could not initialize screen ambience", "other", { error: String(error) });
    }
  }
  if (active) active.element.volume = clamp01(SFX_AMBIENCE_VOLUME * audioState.sfxVolume * audioState.masterVolume);
}

export function setScreenAmbience(screen: Screen) {
  requested = (screenAmbienceSounds as Partial<Record<Screen, string>>)[screen];
  syncScreenAmbience();
}
