import { useMotionValue, useSpring, useTransform } from 'framer-motion'

/** Shared 3-D tilt hook. Attach the returned style + handlers to any motion element. */
export function useTilt(maxAngle = 10, perspective = 600) {
  const rawX = useMotionValue(0.5)
  const rawY = useMotionValue(0.5)
  const rotateY = useSpring(useTransform(rawX, [0, 1], [-maxAngle, maxAngle]), { stiffness: 400, damping: 35 })
  const rotateX = useSpring(useTransform(rawY, [0, 1], [maxAngle, -maxAngle]), { stiffness: 400, damping: 35 })

  const onMouseMove = (e: { currentTarget: { getBoundingClientRect(): DOMRect }; clientX: number; clientY: number }) => {
    const r = e.currentTarget.getBoundingClientRect()
    rawX.set((e.clientX - r.left) / r.width)
    rawY.set((e.clientY - r.top)  / r.height)
  }
  const onMouseLeave = () => { rawX.set(0.5); rawY.set(0.5) }

  return {
    tiltStyle: { rotateX, rotateY, transformPerspective: perspective } as const,
    onMouseMove,
    onMouseLeave,
  }
}
