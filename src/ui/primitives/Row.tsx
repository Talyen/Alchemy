import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type RowGap = 'xs' | 'sm' | 'md' | 'lg'
type RowAlign = 'start' | 'center' | 'end' | 'stretch'
type RowJustify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'

type RowProps = HTMLAttributes<HTMLDivElement> & {
  gap?: RowGap
  align?: RowAlign
  justify?: RowJustify
  wrap?: boolean
}

const GAP_CLASS: Record<RowGap, string> = {
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
}

const ALIGN_CLASS: Record<RowAlign, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
}

const JUSTIFY_CLASS: Record<RowJustify, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
  evenly: 'justify-evenly',
}

export function Row({ className, gap = 'md', align = 'center', justify = 'start', wrap = false, ...props }: RowProps) {
  return (
    <div
      data-ui-container
      className={cn(
        'flex w-full min-w-0 whitespace-normal break-words',
        GAP_CLASS[gap],
        ALIGN_CLASS[align],
        JUSTIFY_CLASS[justify],
        wrap ? 'flex-wrap' : 'flex-nowrap',
        className,
      )}
      {...props}
    />
  )
}
