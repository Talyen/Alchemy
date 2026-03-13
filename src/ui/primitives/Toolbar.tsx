import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type ToolbarProps = HTMLAttributes<HTMLDivElement>

export function Toolbar({ className, ...props }: ToolbarProps) {
  return (
    <div
      data-ui-container
      className={cn('flex w-full min-w-0 flex-wrap items-center justify-start gap-2 rounded-lg', className)}
      {...props}
    />
  )
}
