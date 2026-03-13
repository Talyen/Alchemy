import { forwardRef } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

type ButtonProps = React.ComponentProps<typeof motion.button> & {
  variant?: ButtonVariant
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'border-zinc-600/70 bg-zinc-800/85 text-zinc-100',
  secondary: 'border-zinc-700/70 bg-zinc-900/80 text-zinc-200',
  ghost: 'border-transparent bg-transparent text-zinc-200',
  danger: 'border-red-500/60 bg-red-900/35 text-red-100',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', whileHover, whileTap, type = 'button', ...props },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type={type}
      data-ui-control
      className={cn(
        'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold whitespace-normal break-words',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-950',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANT_CLASS[variant],
        className,
      )}
      whileHover={whileHover ?? { scale: 1.02 }}
      whileTap={whileTap ?? { scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      {...props}
    />
  )
})
