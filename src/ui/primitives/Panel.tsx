import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type PanelProps = HTMLAttributes<HTMLDivElement>

export function Panel({ className, ...props }: PanelProps) {
  return (
    <div
      data-ui-container
      data-ui-boundary
      className={cn(
        'w-full min-w-0 overflow-hidden rounded-2xl border border-zinc-700/70 bg-zinc-950/92 p-4 text-zinc-100',
        className,
      )}
      {...props}
    />
  )
}
