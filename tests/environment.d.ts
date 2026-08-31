import type { AlchemyDesktopApi } from "@/lib/desktop-api";

declare global {
  interface Window {
    alchemyDesktop?: AlchemyDesktopApi;
  }
}

export {};
