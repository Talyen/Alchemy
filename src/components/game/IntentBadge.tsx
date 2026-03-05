import { Sword, Shield } from 'lucide-react'
import type { EnemyIntent } from '@/types'

interface Props {
  intent: EnemyIntent
}

export function IntentBadge({ intent }: Props) {
  const isAttack = intent.type === 'attack'

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800 border border-zinc-700/50">
      {isAttack ? (
        <Sword size={11} className="text-red-400" />
      ) : (
        <Shield size={11} className="text-sky-400" />
      )}
      <span className={`text-xs font-semibold ${isAttack ? 'text-red-300' : 'text-sky-300'}`}>
        {isAttack ? `${intent.value} dmg` : `+${intent.value} block`}
      </span>
    </div>
  )
}
