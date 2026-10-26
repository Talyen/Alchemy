import type { CombatTextEvent } from "@/lib/battle";
import type { CombatTextLane, StatusChip } from "../../../shared/types";

/** Both sides use authored status IDs, independent of translated labels or icons. */
export function combatStatusKey(target: CombatTextEvent["target"], status: StatusChip["id"] | CombatTextEvent["stat"]) {
  return `${target}:${status}`;
}

export function secondaryStatusFeedbackKey(event: CombatTextEvent, lane: CombatTextLane): string | undefined {
  if (event.feedback === "primary" || lane === "impact" || lane === "announcement") return;
  // Applied control uses a distinct chip ID from its damage buildup. Only explicit
  // secondary applications deduplicate; primary control and other notice outcomes stay.
  if (event.kind === "notice" && event.feedback === "secondary" && event.signal === undefined) {
    if (event.stat === "stun") return combatStatusKey(event.target, "stunned");
    if (event.stat === "freeze") return combatStatusKey(event.target, "frozen");
  }
  // Losses, failed gains, Cleanse and Purge are not a second display of present state.
  if (event.kind === "status" && event.amount > 0) return combatStatusKey(event.target, event.stat);
  if (event.kind === "multiply" && event.amount > 1) return combatStatusKey(event.target, event.stat);
  if (event.kind === "notice" && event.signal === "prepared") return combatStatusKey(event.target, event.stat);
  return;
}

function fullyVisible(element: HTMLElement, scene: HTMLElement): boolean {
  if (!element.isConnected || !scene.contains(element)) return false;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const view = element.ownerDocument.defaultView;
  if (!view) return false;
  const within = (start: number, end: number, lower: number, upper: number) =>
    start >= lower - 0.5 && end <= upper + 0.5;
  if (!within(rect.left, rect.right, 0, view.innerWidth) || !within(rect.top, rect.bottom, 0, view.innerHeight))
    return false;
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    const style = view.getComputedStyle(node);
    if (
      node.hidden ||
      node.getAttribute("aria-hidden") === "true" ||
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.visibility === "collapse" ||
      style.contentVisibility === "hidden" ||
      style.opacity === "0"
    )
      return false;
    if (node === element) continue;
    const clips = (overflow: string) => /^(hidden|clip|scroll|auto)$/.test(overflow);
    const clipX = clips(style.overflowX) || clips(style.overflow);
    const clipY = clips(style.overflowY) || clips(style.overflow);
    if (clipX || clipY) {
      const clip = node.getBoundingClientRect();
      if (clipX && !within(rect.left, rect.right, clip.left, clip.right)) return false;
      if (clipY && !within(rect.top, rect.bottom, clip.top, clip.bottom)) return false;
    }
  }
  return true;
}

/** Read during the existing geometry pass; a missing, hidden or clipped chip never deduplicates. */
export function visibleCombatStatusKeys(scene: HTMLElement | null): ReadonlySet<string> {
  const visible = new Set<string>();
  if (!scene?.isConnected) return visible;
  for (const row of scene.querySelectorAll<HTMLElement>("[data-combat-status-target]")) {
    const target = row.dataset.combatStatusTarget;
    if (target !== "player" && target !== "enemy") continue;
    for (const chip of row.querySelectorAll<HTMLElement>("[data-combat-status-id]")) {
      const id = chip.dataset.combatStatusId as StatusChip["id"] | undefined;
      if (id && fullyVisible(chip, scene)) visible.add(combatStatusKey(target, id));
    }
  }
  return visible;
}

/** Keep receipts and expiry intact so ordinary feedback remains available if the row disappears. */
export function updateStatusFeedbackVisibility(layer: HTMLElement | null, visible: ReadonlySet<string>) {
  for (const entry of layer?.querySelectorAll<HTMLElement>("[data-secondary-status-feedback]") ?? []) {
    const hidden = visible.has(entry.dataset.secondaryStatusFeedback!);
    const visibility = hidden ? "hidden" : "";
    if (entry.style.visibility !== visibility) entry.style.visibility = visibility;
    if (hidden) entry.setAttribute("aria-hidden", "true");
    else entry.removeAttribute("aria-hidden");
  }
}
