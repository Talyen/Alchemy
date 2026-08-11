// Module-level registry for the root-space tooltip overlay element.
// AppInner mounts the `#tooltip-root` layer and registers it here so any
// portaled tooltip can target it without threading a ref through every
// consumer. Falls back to document.body when the layer is not mounted yet.
let tooltipRootElement: HTMLElement | null = null;

export function setTooltipRoot(el: HTMLElement | null) {
  tooltipRootElement = el;
}

export function getTooltipRoot(): HTMLElement | null {
  return tooltipRootElement;
}
