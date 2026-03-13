import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type StackGap = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
type StackAlign = 'start' | 'center' | 'end' | 'stretch'

type StackProps = HTMLAttributes<HTMLDivElement> & {
  gap?: StackGap
  align?: StackAlign
}

const GAP_CLASS: Record<StackGap, string> = {
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
  xl: 'gap-8',
}

const ALIGN_CLASS: Record<StackAlign, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
}

export function Stack({ className, gap = 'md', align = 'stretch', ...props }: StackProps) {
  return (
    <div
      data-ui-container
      className={cn(
        'flex w-full min-w-0 flex-col whitespace-normal break-words',
        GAP_CLASS[gap],
        ALIGN_CLASS[align],
        className,
      )}
      {...props}
    />
  )
}
