export type PopoverPosition = {
  left: number
  top: number
  placeAbove: boolean
}

type PopoverOptions = {
  width: number
  padding?: number
  minHeightForAbove?: number
  offset?: number
  preferAbove?: boolean
}

export function getViewportPopoverPosition(rect: DOMRect, options: PopoverOptions): PopoverPosition {
  const width = options.width
  const padding = options.padding ?? 12
  const minHeightForAbove = options.minHeightForAbove ?? 186
  const offset = options.offset ?? 10

  const half = width / 2
  const unclampedLeft = rect.left + rect.width / 2
  const minLeft = padding + half
  const maxLeft = window.innerWidth - padding - half
  const left = Math.max(minLeft, Math.min(maxLeft, unclampedLeft))
  const preferAbove = options.preferAbove ?? true
  const placeAbove = preferAbove || rect.top > minHeightForAbove

  return {
    left: Math.round(left),
    top: Math.round(placeAbove ? rect.top - offset : rect.bottom + offset),
    placeAbove,
  }
}
