import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type CardProps = HTMLAttributes<HTMLDivElement>

export function Card({ className, ...props }: CardProps) {
  return (
    <article
      data-ui-container
      data-ui-boundary
      className={cn(
        'flex w-full min-w-0 flex-col gap-3 overflow-hidden rounded-xl border border-zinc-700/60 bg-zinc-900/80 p-4 whitespace-normal break-words',
        className,
      )}
      {...props}
    />
  )
}
