import { focusableControls, focusControl, focusScreenStart, isFocusAvailable } from "./focus-eligibility";

interface DialogFocusScope {
  panel: HTMLDivElement;
  lastFocused: HTMLElement | null;
}

// One owner supplies containment, recovery, and controller traversal. Opening
// order is independent of portal/DOM order; hidden or preparing panels yield.
const scopes: DialogFocusScope[] = [];
let owner: DialogFocusScope | undefined;
let restoreTarget: HTMLElement | null = null;
let observer: MutationObserver | undefined;
let frame: number | undefined;

function activeScope() {
  return scopes.findLast(({ panel }) => isFocusAvailable(panel));
}

export function activeDialogFocusRoot(): HTMLDivElement | undefined {
  return activeScope()?.panel;
}

function initialControl(panel: HTMLDivElement): HTMLElement {
  return (
    [...panel.querySelectorAll<HTMLElement>("[data-dialog-cancel], [data-dialog-initial-focus]")].find(
      isFocusAvailable,
    ) ??
    focusableControls(panel)[0] ??
    panel
  );
}

function focusScope(scope: DialogFocusScope, retainFocus = true) {
  const retained = retainFocus ? scope.lastFocused : null;
  const control =
    retained && scope.panel.contains(retained) && isFocusAvailable(retained) ? retained : initialControl(scope.panel);
  control.focus({ preventScroll: true });
  // Layout may reach the panel one frame before its prepared controls.
  if (
    control === scope.panel &&
    [...scope.panel.querySelectorAll<HTMLElement>("[data-dialog-cancel], [data-dialog-initial-focus]")].some(
      (candidate) => !candidate.matches(":disabled") && !candidate.closest('[hidden], [inert], [aria-hidden="true"]'),
    )
  )
    scheduleReconcile();
}

function reconcile() {
  const nextOwner = activeScope();
  const previousOwner = owner;
  // A closing panel retains restoration responsibility through its inert fade
  // until another panel acquires focus or the closing panel unregisters.
  if (nextOwner) {
    owner = nextOwner;
    restoreTarget = null;
    const active = document.activeElement;
    if (
      owner !== previousOwner ||
      !(active instanceof HTMLElement) ||
      !owner.panel.contains(active) ||
      !isFocusAvailable(active) ||
      active === owner.panel
    )
      focusScope(owner);
    return;
  }
  if (restoreTarget) {
    const target = restoreTarget;
    // Preserve the opener through screen preparation. A completed action can
    // disable its opener permanently, so recover to an available screen control.
    if (isFocusAvailable(target)) {
      restoreTarget = null;
      focusControl(target);
    } else if ((!target.isConnected || target.matches(":disabled")) && focusScreenStart()) {
      restoreTarget = null;
    }
  }
  releaseListenersIfIdle();
}

function scheduleReconcile() {
  if (frame !== undefined) return;
  frame = requestAnimationFrame(() => {
    frame = undefined;
    reconcile();
  });
}

function onFocus(event: FocusEvent) {
  const scope = activeScope();
  if (scope) {
    owner = scope;
    if (event.target instanceof HTMLElement && scope.panel.contains(event.target)) {
      scope.lastFocused = event.target === scope.panel ? null : event.target;
    } else focusScope(scope, false);
  } else if (event.target instanceof HTMLElement && event.target !== document.body) {
    restoreTarget = null;
    releaseListenersIfIdle();
  }
}

function cancelRestore() {
  restoreTarget = null;
  releaseListenersIfIdle();
}

function ensureListeners() {
  if (observer) return;
  document.addEventListener("focusin", onFocus);
  document.addEventListener("pointerdown", cancelRestore, true);
  observer = new MutationObserver(scheduleReconcile);
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["inert", "hidden", "aria-hidden", "disabled", "tabindex", "class", "style"],
  });
}

function releaseListenersIfIdle() {
  if (scopes.length || restoreTarget) return;
  observer?.disconnect();
  observer = undefined;
  document.removeEventListener("focusin", onFocus);
  document.removeEventListener("pointerdown", cancelRestore, true);
  if (frame !== undefined) cancelAnimationFrame(frame);
  frame = undefined;
  owner = undefined;
}

export function registerDialogFocus(panel: HTMLDivElement, returnTarget: HTMLElement | null): () => void {
  restoreTarget = null;
  if (frame !== undefined) cancelAnimationFrame(frame);
  frame = undefined;
  const scope: DialogFocusScope = { panel, lastFocused: null };
  scopes.push(scope);
  ensureListeners();
  scheduleReconcile();
  return () => {
    const index = scopes.indexOf(scope);
    if (index < 0) return;
    // A quick dismissal can precede the first ownership frame. The newest
    // unclaimed panel still owns restoration after native inert drops focus.
    const wasOwner = owner === scope || (!owner && scopes.at(-1) === scope);
    scopes.splice(index, 1);
    // Covered panels never restore their opener through the foreground panel.
    if (wasOwner) {
      owner = undefined;
      const next = activeScope();
      if (next) {
        owner = next;
        if (returnTarget && next.panel.contains(returnTarget) && isFocusAvailable(returnTarget))
          next.lastFocused = returnTarget;
        focusScope(next);
      } else if (returnTarget && returnTarget !== document.body && returnTarget !== document.documentElement) {
        restoreTarget = returnTarget;
        reconcile();
        if (restoreTarget) scheduleReconcile();
      } else {
        const active = document.activeElement;
        if (active instanceof HTMLElement && panel.contains(active)) active.blur();
      }
    }
    releaseListenersIfIdle();
  };
}

export function trapDialogTab(
  panel: HTMLDivElement,
  event: { key: string; shiftKey: boolean; defaultPrevented: boolean; preventDefault: () => void },
) {
  if (event.key !== "Tab" || event.defaultPrevented || activeDialogFocusRoot() !== panel) return;
  const elements = focusableControls(panel);
  const current = elements.indexOf(document.activeElement as HTMLElement);
  if (elements.length === 0) {
    event.preventDefault();
    panel.focus();
  } else if (current < 0 || (event.shiftKey ? current === 0 : current === elements.length - 1)) {
    event.preventDefault();
    elements[event.shiftKey ? elements.length - 1 : 0]?.focus();
  }
}
