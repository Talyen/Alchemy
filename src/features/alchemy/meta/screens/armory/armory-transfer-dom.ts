import type { ArmorySlot } from "@/lib/gear";
import { ARMORY_GEAR_SLOT_TESTID, ARMORY_TRINKET_SLOT_TESTID } from "./parts/armory-slot-shell";

export function measureArmorySlot(slot: ArmorySlot) {
  const selector =
    slot === "trinket"
      ? `[data-testid="${ARMORY_TRINKET_SLOT_TESTID}"]`
      : `[data-testid="${ARMORY_GEAR_SLOT_TESTID}"][data-slot="${slot}"]`;
  return document.querySelector(selector)?.getBoundingClientRect();
}

export function measureArmoryItem(isTrinket: boolean, id?: string) {
  const testId = isTrinket ? "armory-trinket-item" : "armory-inventory-item";
  const attribute = isTrinket ? "data-trinket-id" : "data-instance-id";
  // Compare IDs as data, without interpolating save-owned values into CSS.
  const elements = document.querySelectorAll(`[data-testid="${testId}"]`);
  const element =
    id === undefined ? elements[0] : Array.from(elements).find((item) => item.getAttribute(attribute) === id);
  return element?.getBoundingClientRect();
}

export function measureArmoryPanel() {
  return document.querySelector('[data-testid="armory-right-panel"]')?.getBoundingClientRect();
}

export function blurArmoryFocus() {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}
