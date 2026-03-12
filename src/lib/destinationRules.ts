import type { DestinationType } from '@/components/game/ChooseDestinationScreen'

const REPEATABLE_ROOM_TYPES = new Set<DestinationType>(['enemy', 'elite', 'mystery'])

export function canRepeatDestinationType(type: DestinationType): boolean {
  return REPEATABLE_ROOM_TYPES.has(type)
}

export function canAppearAfter(previousType: DestinationType | null, nextType: DestinationType): boolean {
  if (!previousType) return true
  if (previousType !== nextType) return true
  return canRepeatDestinationType(nextType)
}
