import { readDeviceDisplayPreferences, writeDeviceDisplayPreferences } from "@/features/alchemy/shared/storage";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { DEFAULT_DEVICE_DISPLAY, normalizeDisplayPercent, type DeviceDisplayPreferences } from "@/lib/settings-values";

// Slider ticks fire far more often than anyone needs to hit localStorage: a
// ~60-byte synchronous write per tick is cheap but pointless, so persistence
// trails behind a short debounce. In-memory state (what the UI reads) still
// updates synchronously.
const DEVICE_DISPLAY_WRITE_DELAY_MS = 150;

interface DeviceDisplayStore extends DeviceDisplayPreferences {
  setGameSizePercent: (value: number) => void;
  setTooltipSizePercent: (value: number) => void;
  resetSizes: () => void;
}

export const useDeviceDisplayStore = create<DeviceDisplayStore>((set) => ({
  ...DEFAULT_DEVICE_DISPLAY,
  setGameSizePercent: (value) => set({ gameSizePercent: normalizeDisplayPercent("gameSizePercent", value) }),
  setTooltipSizePercent: (value) => set({ tooltipSizePercent: normalizeDisplayPercent("tooltipSizePercent", value) }),
  resetSizes: () => set({ ...DEFAULT_DEVICE_DISPLAY }),
}));

// Explicit init (called from main.tsx before first render) instead of reading
// storage at import time, so module import order can never observe or poison
// the stored values. Safe to call more than once; tests call it directly.
export function initDeviceDisplayPreferences(): void {
  useDeviceDisplayStore.setState(readDeviceDisplayPreferences());
  markDeviceDisplayClean();
}

let pendingWriteTimer: ReturnType<typeof setTimeout> | null = null;
let hasUnwrittenChanges = false;

function markDeviceDisplayClean(): void {
  if (pendingWriteTimer !== null) {
    clearTimeout(pendingWriteTimer);
    pendingWriteTimer = null;
  }
  hasUnwrittenChanges = false;
}

// Synchronous flush for abrupt exits (pagehide) and tests. Reads live state
// at flush time, so a stale scheduled write can never clobber newer values.
// No-ops when nothing changed, so pagehide never pays for a redundant write.
export function flushDeviceDisplayPreferences(): void {
  if (!hasUnwrittenChanges) return;
  const { gameSizePercent, tooltipSizePercent } = useDeviceDisplayStore.getState();
  writeDeviceDisplayPreferences({ gameSizePercent, tooltipSizePercent });
  markDeviceDisplayClean();
}

useDeviceDisplayStore.subscribe(() => {
  hasUnwrittenChanges = true;
  if (pendingWriteTimer !== null) clearTimeout(pendingWriteTimer);
  pendingWriteTimer = setTimeout(flushDeviceDisplayPreferences, DEVICE_DISPLAY_WRITE_DELAY_MS);
});

if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("pagehide", flushDeviceDisplayPreferences);
}

export function useDeviceDisplayPreferences(): DeviceDisplayPreferences {
  return useDeviceDisplayStore(
    useShallow((s) => ({ gameSizePercent: s.gameSizePercent, tooltipSizePercent: s.tooltipSizePercent })),
  );
}
