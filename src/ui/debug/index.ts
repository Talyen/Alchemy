import { initUiDebugMode } from './debugMode'
import { startResponsiveLayoutValidation } from './responsiveValidation'

export function initUiGuardrailsRuntime() {
  if (!import.meta.env.DEV) return () => undefined

  initUiDebugMode()
  const stopValidation = startResponsiveLayoutValidation()

  return () => {
    stopValidation()
  }
}
