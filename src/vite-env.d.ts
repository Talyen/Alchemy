/// <reference types="vite/client" />

interface Window {
  alchemyDesktop?: {
    isDesktop: boolean;
    setDisplayMode: (mode: "windowed" | "borderless-fullscreen" | "fullscreen") => Promise<void>;
    quit: () => Promise<void>;
  };
}
