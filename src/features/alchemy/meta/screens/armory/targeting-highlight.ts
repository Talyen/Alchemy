export const VALID_TARGET_RING =
  "ring-inset ring-2 ring-emerald-400/40 bg-emerald-950/10 hover:ring-emerald-400/80 hover:bg-emerald-950/20";
export const VALID_TARGET_SHADOW = "shadow-[0_0_0_1px_rgba(134,239,172,0.38),0_0_10px_rgba(34,197,94,0.16)]";
export const SALVAGE_TARGET_RING =
  "ring-inset ring-2 ring-red-400/40 bg-red-950/10 hover:ring-red-300/60 hover:bg-red-950/20";
export const SALVAGE_TARGET_SHADOW = "shadow-[0_0_0_1px_rgba(248,113,113,0.38),0_0_10px_rgba(239,68,68,0.16)]";

export function targetingRingClass(mode: "salvage" | "currency" | null): string[] {
  if (mode === "salvage") return [SALVAGE_TARGET_RING, SALVAGE_TARGET_SHADOW, "rounded-shell-hero"];
  if (mode === "currency") return [VALID_TARGET_RING, VALID_TARGET_SHADOW, "rounded-shell-hero"];
  return [];
}
