import { motion, type Variants } from "motion/react";

import { cn } from "@/lib/utils";

interface TextAnimateProps {
  children: string;
  className?: string;
  delay?: number;
  duration?: number;
  startOnView?: boolean;
  once?: boolean;
}

const containerVariants: Variants = {
  hidden: { opacity: 1 },
  show: {
    opacity: 1,
    transition: {
      delayChildren: 0,
      staggerChildren: 0.05,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, filter: "blur(10px)", y: 20 },
  show: {
    opacity: 1,
    filter: "blur(0px)",
    y: 0,
    transition: {
      y: { duration: 0.3 },
      opacity: { duration: 0.4 },
      filter: { duration: 0.3 },
    },
  },
};

export function TextAnimate({
  children,
  delay = 0,
  duration = 0.3,
  className,
  startOnView = true,
  once = false,
}: TextAnimateProps) {
  const segments = children.split(/(\s+)/);
  const staggerChildren = duration / segments.length;

  const variants = {
    container: {
      ...containerVariants,
      show: {
        // eslint-disable-next-line @typescript-eslint/no-misused-spread -- Variants type includes call signature but we spread the object form
        ...containerVariants.show,
        transition: {
          delayChildren: delay,
          staggerChildren,
        },
      },
    },
    item: itemVariants,
  };

  return (
    <motion.p
      variants={variants.container}
      initial="hidden"
      {...(startOnView ? { whileInView: "show" as const } : { animate: "show" as const })}
      className={cn("whitespace-pre-wrap", className)}
      viewport={{ once }}
      aria-label={children}
    >
      {segments.map((segment, i) => (
        <motion.span key={`word-${segment}-${i}`} variants={variants.item} className="inline-block whitespace-pre">
          {segment}
        </motion.span>
      ))}
    </motion.p>
  );
}
