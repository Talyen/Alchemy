export type CriticalControlRule = {
  id: string
  description: string
  primarySelector: string
  secondarySelector: string
  minGap: number
}

// Critical interaction pairs that should never overlap and should keep breathing room.
export const CRITICAL_CONTROL_RULES: CriticalControlRule[] = [
  {
    id: 'battle-menu-vs-draw-pile',
    description: 'Main menu trigger must stay clear of draw pile control.',
    primarySelector: 'button[aria-label="Open main menu"]',
    secondarySelector: '[data-testid="pile-draw"]',
    minGap: 8,
  },
  {
    id: 'battle-menu-vs-discard-pile',
    description: 'Main menu trigger must stay clear of discard pile control.',
    primarySelector: 'button[aria-label="Open main menu"]',
    secondarySelector: '[data-testid="pile-discard"]',
    minGap: 8,
  },
]
