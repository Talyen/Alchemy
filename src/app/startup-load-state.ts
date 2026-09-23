import { STARTUP_BAR_REVEAL_THRESHOLD } from "@/lib/game-constants";
import { advanceStartupBar, computeStartupLoadTarget } from "./startup-bar-progress";

export interface StartupLoadState {
  readonly imageLoaded: number;
  readonly imageTotal: number;
  readonly imagesSettled: boolean;
  readonly fontsSettled: boolean;
  readonly bootstrapReady: boolean;
  readonly minimumElapsed: boolean;
  readonly display: number;
  readonly lastFrameMs: number | null;
  readonly ready: boolean;
}

export type StartupLoadEvent =
  | { type: "image-progress"; loaded: number; total: number }
  | { type: "images-settled" }
  | { type: "fonts-settled" }
  | { type: "bootstrap-ready"; ready: boolean }
  | { type: "minimum-elapsed" }
  | { type: "frame"; timestamp: number };

export function createStartupLoadState(imageTotal: number, bootstrapReady: boolean): StartupLoadState {
  return {
    imageLoaded: 0,
    imageTotal,
    imagesSettled: imageTotal === 0,
    fontsSettled: false,
    bootstrapReady,
    minimumElapsed: false,
    display: 0,
    lastFrameMs: null,
    ready: false,
  };
}

export function advanceStartupLoad(state: StartupLoadState, event: StartupLoadEvent): StartupLoadState {
  if (state.ready) return state;
  switch (event.type) {
    case "image-progress":
      return { ...state, imageLoaded: event.loaded, imageTotal: event.total };
    case "images-settled":
      return { ...state, imageLoaded: state.imageTotal, imagesSettled: true };
    case "fonts-settled":
      return { ...state, fontsSettled: true };
    case "bootstrap-ready":
      return { ...state, bootstrapReady: event.ready };
    case "minimum-elapsed":
      return { ...state, minimumElapsed: true };
    case "frame": {
      const complete = state.imagesSettled && state.fontsSettled && state.bootstrapReady;
      const target = computeStartupLoadTarget({
        imageLoaded: state.imageLoaded,
        imageTotal: state.imageTotal,
        imagesSettled: state.imagesSettled,
        fontsReady: state.fontsSettled,
        bootstrapReady: state.bootstrapReady,
      });
      const elapsedSeconds = state.lastFrameMs === null ? 0 : (event.timestamp - state.lastFrameMs) / 1000;
      const display = advanceStartupBar(state.display, elapsedSeconds, target, complete);
      return {
        ...state,
        display,
        lastFrameMs: event.timestamp,
        ready: complete && state.minimumElapsed && display >= STARTUP_BAR_REVEAL_THRESHOLD,
      };
    }
  }
}
