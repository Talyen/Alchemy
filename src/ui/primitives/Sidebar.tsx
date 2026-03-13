import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type SidebarProps = HTMLAttributes<HTMLElement>

export function Sidebar({ className, ...props }: SidebarProps) {
  return (
    <aside
      data-ui-container
      data-ui-boundary
      className={cn(
        'flex h-full w-full min-w-0 max-w-sm flex-col gap-4 overflow-y-auto overflow-x-hidden border-r border-zinc-700/70 bg-zinc-950/90 p-4',
        className,
      )}
      {...props}
    />
  )
}
