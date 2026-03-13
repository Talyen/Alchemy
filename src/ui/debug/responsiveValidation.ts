type TargetViewport = {
  name: 'small' | 'medium' | 'large'
  width: number
  height: number
}

type ValidationIssue = {
  kind: 'overlap' | 'overflow' | 'offscreen' | 'touch-target' | 'control-overlap'
  viewport: string
  detail: string
}

const TARGET_VIEWPORTS: TargetViewport[] = [
  { name: 'small', width: 800, height: 600 },
  { name: 'medium', width: 1280, height: 720 },
  { name: 'large', width: 1920, height: 1080 },
]

const MIN_TARGET_SIZE = 44

function isVisible(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false
  if (element.offsetParent === null) return false
  const style = window.getComputedStyle(element)
  return style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity || '1') > 0
}

function intersects(a: DOMRect, b: DOMRect): number {
  const left = Math.max(a.left, b.left)
  const right = Math.min(a.right, b.right)
  const top = Math.max(a.top, b.top)
  const bottom = Math.min(a.bottom, b.bottom)
  return Math.max(0, right - left) * Math.max(0, bottom - top)
}

function describeElement(element: HTMLElement): string {
  const id = element.id ? `#${element.id}` : ''
  const className = (element.className || '').toString().trim().split(/\s+/).slice(0, 3).join('.')
  const classPart = className ? `.${className}` : ''
  return `${element.tagName.toLowerCase()}${id}${classPart}`
}

function getViewportLabel(width: number, height: number): string {
  const ranked = TARGET_VIEWPORTS
    .map((target) => {
      const dx = Math.abs(width - target.width)
      const dy = Math.abs(height - target.height)
      return { name: target.name, delta: dx + dy }
    })
    .sort((a, b) => a.delta - b.delta)

  return ranked[0]?.name ?? 'custom'
}

function collectUiElements() {
  const boundaries = Array.from(document.querySelectorAll('[data-ui-boundary]')).filter(isVisible)
  const containers = Array.from(document.querySelectorAll('[data-ui-container]')).filter(isVisible)
  const controls = Array.from(document.querySelectorAll('[data-ui-control], [data-ui-hit-target]')).filter(isVisible)
  return { boundaries, containers, controls }
}

function validateCurrentViewport(): ValidationIssue[] {
  const { boundaries, containers, controls } = collectUiElements()
  const issues: ValidationIssue[] = []
  const viewport = {
    name: getViewportLabel(window.innerWidth, window.innerHeight),
    width: window.innerWidth,
    height: window.innerHeight,
  }

  for (const element of containers) {
    const rect = element.getBoundingClientRect()

    const parent = element.parentElement
    if (parent) {
      const parentRect = parent.getBoundingClientRect()
      const overflowsParent =
        rect.left < parentRect.left - 1 ||
        rect.top < parentRect.top - 1 ||
        rect.right > parentRect.right + 1 ||
        rect.bottom > parentRect.bottom + 1
      if (overflowsParent) {
        issues.push({
          kind: 'overflow',
          viewport: viewport.name,
          detail: `${describeElement(element)} exceeds parent bounds`,
        })
      }
    }
  }

  for (const element of boundaries) {
    if (element.hasAttribute('data-ui-overlay')) continue
    const rect = element.getBoundingClientRect()
    if (rect.left < -1 || rect.top < -1 || rect.right > viewport.width + 1 || rect.bottom > viewport.height + 1) {
      issues.push({
        kind: 'offscreen',
        viewport: viewport.name,
        detail: `${describeElement(element)} projects outside ${viewport.width}x${viewport.height}`,
      })
    }
  }

  for (let i = 0; i < boundaries.length; i += 1) {
    const a = boundaries[i]
    const aRect = a.getBoundingClientRect()
    for (let j = i + 1; j < boundaries.length; j += 1) {
      const b = boundaries[j]
      const bRect = b.getBoundingClientRect()
      if (intersects(aRect, bRect) > 144) {
        issues.push({
          kind: 'overlap',
          viewport: viewport.name,
          detail: `${describeElement(a)} overlaps ${describeElement(b)}`,
        })
      }
    }
  }

  for (const control of controls) {
    const rect = control.getBoundingClientRect()
    if (rect.width < MIN_TARGET_SIZE || rect.height < MIN_TARGET_SIZE) {
      issues.push({
        kind: 'touch-target',
        viewport: viewport.name,
        detail: `${describeElement(control)} is below ${MIN_TARGET_SIZE}px target size`,
      })
    }
  }

  for (let i = 0; i < controls.length; i += 1) {
    const a = controls[i]
    const aRect = a.getBoundingClientRect()
    for (let j = i + 1; j < controls.length; j += 1) {
      const b = controls[j]

      // Ignore nested controls so icon wrappers inside buttons don't register as collisions.
      if (a.contains(b) || b.contains(a)) continue

      const bRect = b.getBoundingClientRect()
      if (intersects(aRect, bRect) > 16) {
        issues.push({
          kind: 'control-overlap',
          viewport: viewport.name,
          detail: `${describeElement(a)} overlaps interactive ${describeElement(b)}`,
        })
      }
    }
  }

  return issues
}

export function startResponsiveLayoutValidation() {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return () => undefined
  }

  let rafHandle = 0
  const issueHistory = new Map<string, number>()

  const runValidation = () => {
    rafHandle = 0
    const issues = validateCurrentViewport()
    const now = Date.now()

    for (const issue of issues) {
      const key = `${issue.kind}:${issue.viewport}:${issue.detail}`
      const lastSeen = issueHistory.get(key) ?? 0
      if (now - lastSeen < 3000) continue
      issueHistory.set(key, now)
      console.warn(`[ui-layout][${issue.viewport}][${issue.kind}] ${issue.detail}`)
    }
  }

  const scheduleValidation = () => {
    if (rafHandle !== 0) return
    rafHandle = window.requestAnimationFrame(runValidation)
  }

  const observer = new MutationObserver(scheduleValidation)
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: false,
    attributeFilter: ['class', 'style', 'hidden', 'data-ui-container', 'data-ui-boundary', 'data-ui-control'],
  })

  window.addEventListener('resize', scheduleValidation)
  window.addEventListener('orientationchange', scheduleValidation)
  scheduleValidation()

  return () => {
    observer.disconnect()
    window.removeEventListener('resize', scheduleValidation)
    window.removeEventListener('orientationchange', scheduleValidation)
    if (rafHandle !== 0) window.cancelAnimationFrame(rafHandle)
  }
}
