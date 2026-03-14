import { cn } from '@/lib/utils'

type Props = {
  className?: string
  testId?: string
}

export function NotificationDot({ className, testId }: Props) {
  return (
    <span
      aria-hidden="true"
      data-testid={testId}
      className={cn('inline-block h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_0_2px_rgba(9,9,11,0.92)]', className)}
    />
  )
}