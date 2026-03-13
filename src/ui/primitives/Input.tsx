import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

type InputProps = React.InputHTMLAttributes<HTMLInputElement>

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      data-ui-control
      className={cn(
        'h-11 w-full min-w-0 rounded-lg border border-zinc-700/70 bg-zinc-900/85 px-3 py-2 text-sm text-zinc-100',
        'placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-950',
        className,
      )}
      {...props}
    />
  )
})
