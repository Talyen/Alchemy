const STORAGE_KEY = 'alchemy.uiDebug'

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string') return false
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

function readDebugEnvFlag(): boolean {
  const fromUiDebug = normalizeBoolean(import.meta.env.UI_DEBUG)
  const fromViteUiDebug = normalizeBoolean(import.meta.env.VITE_UI_DEBUG)
  return fromUiDebug || fromViteUiDebug
}

export function isUiDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored !== null) return normalizeBoolean(stored)
  return readDebugEnvFlag()
}

function setDebugAttribute(enabled: boolean) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-ui-debug', enabled ? 'true' : 'false')
}

export function setUiDebugEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, String(enabled))
  setDebugAttribute(enabled)
}

export function initUiDebugMode() {
  if (typeof window === 'undefined') return

  const enabled = isUiDebugEnabled()
  setDebugAttribute(enabled)

  // Ctrl+Shift+U toggles UI debug mode quickly during development.
  window.addEventListener('keydown', (event) => {
    if (!event.ctrlKey || !event.shiftKey || event.code !== 'KeyU') return
    event.preventDefault()
    const nextEnabled = !isUiDebugEnabled()
    setUiDebugEnabled(nextEnabled)
    console.info(`[ui-debug] ${nextEnabled ? 'enabled' : 'disabled'}`)
  })

  ;(window as Window & { toggleUiDebug?: () => void }).toggleUiDebug = () => {
    setUiDebugEnabled(!isUiDebugEnabled())
  }
}
