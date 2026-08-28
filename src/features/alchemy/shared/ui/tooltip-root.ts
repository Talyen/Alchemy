let tooltipRootElement: HTMLElement | null = null;

export function setTooltipRoot(el: HTMLElement | null) {
  tooltipRootElement = el;
}

export function getTooltipRoot(): HTMLElement | null {
  return tooltipRootElement;
}
