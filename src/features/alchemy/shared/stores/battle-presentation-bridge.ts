// Thin bridge so shared/stores lifecycle code can clear VFX without importing run-loop.
type BattlePresentationBridge = {
  clearCardGhosts: () => void;
  resetPresentation: () => void;
};

const noopBridge: BattlePresentationBridge = {
  clearCardGhosts: () => {},
  resetPresentation: () => {},
};

let bridge: BattlePresentationBridge = noopBridge;

export function registerBattlePresentationBridge(next: BattlePresentationBridge): void {
  bridge = next;
}

export function clearBattlePresentationCardGhosts(): void {
  bridge.clearCardGhosts();
}

export function resetBattlePresentation(): void {
  bridge.resetPresentation();
}
