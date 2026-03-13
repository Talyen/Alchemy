import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { GoldIcon } from './GoldIcon'
import { getKeywordsFromText, renderKeywordText } from './keywordGlossary'
import { getViewportPopoverPosition } from '@/lib/viewportPopover'
import { ViewportPopover } from '@/components/ui/ViewportPopover'

interface TrinketInfoCardProps {
  id?: string
  name: string
  description: string
  iconSrc?: string
  size?: 'compact' | 'default'
  className?: string
  keywordTooltipEnabled?: boolean
}

function toClassName(parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

function getDefaultIconSrc(id?: string): string | undefined {
  if (!id) return undefined
  return `assets/trinkets/${id.replace(/_/g, '-')}.png`
}

export function TrinketInfoCard({ id, name, description, iconSrc, size = 'default', className, keywordTooltipEnabled = true }: TrinketInfoCardProps) {
  const [imgFailed, setImgFailed] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState<{ left: number; top: number; placeAbove: boolean } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const resolvedIcon = useMemo(() => iconSrc ?? getDefaultIconSrc(id), [iconSrc, id])
  const keywords = useMemo(() => getKeywordsFromText(description), [description])
  const iconSize = size === 'compact' ? 'h-9 w-9' : 'h-11 w-11'
  const isLongTitle = name.length >= 18
  const titleSize = size === 'compact'
    ? (isLongTitle ? 'text-[11px]' : 'text-xs')
    : (isLongTitle ? 'text-[13px]' : 'text-sm')

  const updateTooltipPosition = () => {
    if (!wrapperRef.current) return
    const rect = wrapperRef.current.getBoundingClientRect()
    setTooltipPosition(getViewportPopoverPosition(rect, { width: 224 }))
  }

  const onWrapperEnter = () => {
    if (!keywordTooltipEnabled) return
    updateTooltipPosition()
    timerRef.current = setTimeout(() => setShowTooltip(true), 300)
  }

  const onWrapperLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setShowTooltip(false)
    setTooltipPosition(null)
  }

  useLayoutEffect(() => {
    if (!showTooltip) return
    updateTooltipPosition()
    window.addEventListener('resize', updateTooltipPosition)
    window.addEventListener('scroll', updateTooltipPosition, true)

    return () => {
      window.removeEventListener('resize', updateTooltipPosition)
      window.removeEventListener('scroll', updateTooltipPosition, true)
    }
  }, [showTooltip])

  return (
    <div ref={wrapperRef} className="relative z-[220]" onMouseEnter={onWrapperEnter} onMouseLeave={onWrapperLeave}>
      <ViewportPopover
        open={keywordTooltipEnabled && showTooltip && keywords.length > 0}
        position={tooltipPosition}
        className="w-56 rounded-xl border border-zinc-700/80 bg-zinc-950 px-3 py-2.5 z-[999] pointer-events-none"
      >
        <p className="text-[11px] text-zinc-600 uppercase tracking-widest mb-2">Keywords</p>
        <div className="flex flex-col gap-2">
          {keywords.map(({ name: keywordName, Icon, color, description: keywordDescription }) => (
            <div key={keywordName} className="flex items-start gap-2">
              {keywordName === 'Gold' ? (
                <GoldIcon size={16} glimmer={false} />
              ) : (
                <Icon
                  size={16}
                  style={{ color, fill: 'none', flexShrink: 0, pointerEvents: 'none' }}
                />
              )}
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] font-semibold leading-none" style={{ color }}>{keywordName}</span>
                <p className="text-[11px] text-zinc-400 leading-snug">{keywordDescription}</p>
              </div>
            </div>
          ))}
        </div>
      </ViewportPopover>

      <div
        className={toClassName([
          'rounded-2xl border border-zinc-700/80 bg-zinc-900/55 p-4 min-h-[132px]',
          className,
        ])}
      >
        <div className="flex items-center gap-3 min-h-[100px]">
          {resolvedIcon && !imgFailed ? (
            <img
              src={resolvedIcon}
              alt={name}
              className={`${iconSize} object-contain`}
              style={{ imageRendering: 'pixelated' }}
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div className={`${iconSize} rounded-md border border-zinc-700/70 bg-zinc-900/80 flex items-center justify-center`}>
              <Sparkles size={size === 'compact' ? 14 : 16} className="text-zinc-500" />
            </div>
          )}

          <div className="min-w-0 flex-1 min-h-[84px] flex flex-col justify-center gap-1">
            <p className={`${titleSize} font-semibold leading-tight text-zinc-200`}>{name}</p>
            <p className="text-[11px] leading-snug text-zinc-400">{renderKeywordText(description)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}