import { motion } from 'motion/react';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type AnimatedScreenTitleProps = {
  accentColor?: string;
  children: ReactNode;
  className?: string;
  order?: 1 | 2 | 3 | 4 | 5 | 6;
  ta?: CSSProperties['textAlign'];
};

function getAlignment(textAlign: CSSProperties['textAlign']) {
  if (textAlign === 'center') {
    return 'center';
  }

  if (textAlign === 'right') {
    return 'flex-end';
  }

  return 'flex-start';
}

export function AnimatedScreenTitle({ accentColor = 'rgba(220, 162, 102, 0.72)', children, className, order = 1, ta = 'left' }: AnimatedScreenTitleProps) {
  const Tag = `h${order}` as const;

  return (
    <div style={{ alignItems: getAlignment(ta), display: 'inline-flex', flexDirection: 'column', gap: 8 }}>
      <motion.div
        animate={{ filter: 'blur(0px)', opacity: 1, scale: 1, y: 0 }}
        initial={{ filter: 'blur(8px)', opacity: 0, scale: 0.985, y: 16 }}
        transition={{ duration: 0.34, ease: 'easeOut' }}
      >
        <Tag
          className={cn(
            'font-semibold tracking-tight text-foreground',
            order === 1 && 'text-4xl sm:text-5xl',
            order === 2 && 'text-3xl sm:text-4xl',
            order === 3 && 'text-2xl sm:text-3xl',
            className,
          )}
          style={{ textAlign: ta }}
        >
          {children}
        </Tag>
      </motion.div>

      <motion.div
        animate={{ opacity: 1, scaleX: 1 }}
        initial={{ opacity: 0, scaleX: 0.3 }}
        style={{
          background: accentColor,
          borderRadius: 999,
          height: 3,
          transformOrigin: ta === 'center' ? 'center' : ta === 'right' ? 'right' : 'left',
          width: 72,
        }}
        transition={{ delay: 0.08, duration: 0.28, ease: 'easeOut' }}
      />
    </div>
  );
}