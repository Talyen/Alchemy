import type { AlchemyDesktopApi } from "@/lib/desktop-api";

declare global {
  const __ALCHEMY_EDITION__: "demo" | "full";
  interface Window {
    alchemyDesktop?: AlchemyDesktopApi;
  }
}

export {};
