import { useMemo } from "react";
import { motion, type Variants } from "motion/react";

import { cn } from "@/lib/utils";
import { useReducedMotionPreference } from "./use-reduced-motion-preference";

interface TextAnimateProps {
  children: string;
  className?: string;
  delay?: number;
  /**
   * Total stagger budget in seconds spread across all words. Per-word motion
   * timing stays fixed in `itemVariants`; longer text gets tighter staggering.
   */
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
  // Split on whitespace runs but keep the separators so intentional spacing
  // and line breaks survive `whitespace-pre-wrap` instead of collapsing.
  const tokens = useMemo(() => children.split(/(\s+)/).filter((part) => part.length > 0), [children]);
  const wordCount = useMemo(() => tokens.filter((part) => !/^\s+$/.test(part)).length, [tokens]);
  const staggerChildren = wordCount > 0 ? duration / wordCount : 0.05;
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
  const animationDisabled = useReducedMotionPreference();
  if (animationDisabled) {
    return (
      <p className={cn("whitespace-pre-wrap", className)} aria-label={children}>
        {children}
      </p>
    );
  }

  return (
    <motion.p
      variants={containerVariants}
      initial="hidden"
      {...(startOnView ? { whileInView: "show" as const } : { animate: "show" as const })}
      className={cn("whitespace-pre-wrap", className)}
      viewport={{ once }}
      aria-label={children}
    >
      {tokens.map((token, i) =>
        /^\s+$/.test(token) ? (
          <span key={`sep-${i}`} aria-hidden="true">
            {token}
          </span>
        ) : (
          <span key={`word-${i}`} className="inline-block" aria-hidden="true">
            <motion.span variants={itemVariants} className="inline-block">
              {token}
            </motion.span>
          </span>
        ),
      )}
    </motion.p>
  );
}
