import { Sword, Shield } from 'lucide-react'
import type { EnemyIntent } from '@/types'

interface Props {
  intent: EnemyIntent
}

export function IntentBadge({ intent }: Props) {
  const isOffense = intent.type === 'attack' || intent.type === 'bleed' || intent.type === 'poison' || intent.type === 'burn'
  const label = intent.type === 'attack'
    ? `${intent.value} dmg`
    : intent.type === 'bleed'
      ? `${intent.value} bleed`
      : intent.type === 'poison'
        ? `${intent.value} poison`
        : intent.type === 'burn'
          ? `${intent.value} burn`
          : `+${intent.value} ${intent.type === 'heal' ? 'heal' : 'block'}`

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800 border border-zinc-700/50">
      {isOffense ? (
        <Sword size={11} className="text-red-400" />
      ) : (
        <Shield size={11} className="text-sky-400" />
      )}
      <span className={`text-xs font-semibold ${isOffense ? 'text-red-300' : 'text-sky-300'}`}>
        {label}
      </span>
    </div>
  )
}
