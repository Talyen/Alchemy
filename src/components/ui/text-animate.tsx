import { useMemo } from "react";
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
  const words = useMemo(() => children.trim().split(/\s+/).filter(Boolean), [children]);
  const staggerChildren = words.length > 0 ? duration / words.length : 0.05;

  const containerVariants = useMemo<Variants>(
    () => ({
      hidden: { opacity: 1 },
      show: {
        opacity: 1,
        transition: {
          delayChildren: delay,
          staggerChildren,
        },
      },
    }),
    [delay, staggerChildren],
  );

  return (
    <motion.p
      variants={containerVariants}
      initial="hidden"
      {...(startOnView ? { whileInView: "show" as const } : { animate: "show" as const })}
      className={cn("whitespace-pre-wrap", className)}
      viewport={{ once }}
      aria-label={children}
    >
      {words.map((word, i) => (
        <span key={`${word}-${i}`} className="inline-block">
          <motion.span variants={itemVariants} className="inline-block">
            {word}
          </motion.span>
          {i < words.length - 1 ? "\u0020" : null}
        </span>
      ))}
    </motion.p>
  );
}
