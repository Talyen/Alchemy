import type { CSSProperties, HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type GridProps = HTMLAttributes<HTMLDivElement> & {
  minColumnWidth?: string
  gap?: 'sm' | 'md' | 'lg'
}

const GAP_CLASS = {
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
} as const

export function Grid({ className, minColumnWidth = '14rem', gap = 'md', style, ...props }: GridProps) {
  const gridStyle: CSSProperties = {
    gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${minColumnWidth}), 1fr))`,
    ...style,
  }

  return (
    <div
      data-ui-container
      className={cn('grid w-full min-w-0 overflow-hidden', GAP_CLASS[gap], className)}
      style={gridStyle}
      {...props}
    />
  )
}
