import { IconBolt, IconDroplet, IconFlame, IconHammer, IconShield, IconSkull, IconSnowflake } from '@tabler/icons-react';
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { keywordDefinitions } from '@/shared/content/keywords';

export type CombatantStatusIcon = {
  color: string;
  description: string;
  id: string;
  icon: typeof IconShield;
  label: string;
  value: number;
};

type CombatantStatusCardProps = {
  currentHealth: number;
  highlightColor?: string | null;
  maxHealth: number;
  name: string;
  statusIcons?: CombatantStatusIcon[];
  width?: string;
};

function withAlpha(color: string, alpha: string) {
  return color.startsWith('#') && color.length === 7 ? `${color}${alpha}` : color;
}

export function CombatantStatusCard({ currentHealth, highlightColor = null, maxHealth, name, statusIcons = [], width = '100%' }: CombatantStatusCardProps) {
  const visibleStatuses = statusIcons.filter((entry) => entry.value > 0);
  const combatantId = name.toLowerCase().replaceAll(' ', '-');
  const segmentCount = Math.max(1, Math.ceil(maxHealth / 10));
  const healthPercent = Math.max(0, Math.min(100, (currentHealth / maxHealth) * 100));
  const [damageTrailHealth, setDamageTrailHealth] = useState(currentHealth);
  const previousHealthRef = useRef(currentHealth);
  const damageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const damageTrailPercent = Math.max(0, Math.min(100, (damageTrailHealth / maxHealth) * 100));
  const damageDeltaPercent = Math.max(damageTrailPercent - healthPercent, 0);

  useEffect(() => {
    const previousHealth = previousHealthRef.current;

    if (damageTimerRef.current) {
      clearTimeout(damageTimerRef.current);
      damageTimerRef.current = null;
    }

    if (currentHealth < previousHealth) {
      setDamageTrailHealth(previousHealth);
      damageTimerRef.current = setTimeout(() => {
        setDamageTrailHealth(currentHealth);
        damageTimerRef.current = null;
      }, 220);
    } else {
      setDamageTrailHealth(currentHealth);
    }

    previousHealthRef.current = currentHealth;
  }, [currentHealth]);

  useEffect(
    () => () => {
      if (damageTimerRef.current) {
        clearTimeout(damageTimerRef.current);
      }
    },
    [],
  );

  return (
    <TooltipProvider delayDuration={80}>
      <div
      data-testid={`combatant-${combatantId}`}
      style={{
        background: 'rgba(14, 10, 10, 0.92)',
        border: '1px solid rgba(220, 162, 102, 0.26)',
        borderRadius: 20,
        boxShadow: highlightColor ? `0 0 0 1px ${withAlpha(highlightColor, '26')}, 0 10px 24px rgba(0, 0, 0, 0.26)` : '0 10px 24px rgba(0, 0, 0, 0.24)',
        marginTop: 14,
        padding: '14px 14px 12px',
        width,
      }}
    >
      <div className="space-y-2.5">
        <p className="text-center text-lg font-bold">
          {name}
        </p>
        {/* The solid bar reacts immediately, then the darker trail collapses to show recent damage. */}
        <div
          data-testid={`combatant-${combatantId}-health-track`}
          style={{
            background: 'rgba(52, 11, 15, 0.96)',
            border: '1px solid rgba(255, 112, 118, 0.56)',
            borderRadius: 999,
            boxShadow: highlightColor ? `0 0 0 1px ${withAlpha(highlightColor, '40')}, 0 0 10px ${withAlpha(highlightColor, '28')}` : undefined,
            height: 20,
            overflow: 'hidden',
            position: 'relative',
            transition: 'box-shadow 220ms ease',
            width: '100%',
          }}
        >
          <motion.div
            animate={{ width: `${healthPercent}%` }}
            style={{
              background: '#c72a33',
              borderRadius: 999,
              height: '100%',
              inset: 0,
              position: 'absolute',
            }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          />
          {damageDeltaPercent > 0 ? (
            <motion.div
              animate={{ left: `${healthPercent}%`, width: `${damageDeltaPercent}%` }}
              style={{
                background: '#651219',
                height: '100%',
                position: 'absolute',
                top: 0,
              }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
            />
          ) : null}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${segmentCount}, minmax(0, 1fr))`,
              inset: 0,
              pointerEvents: 'none',
              position: 'absolute',
            }}
          >
            {Array.from({ length: segmentCount }).map((_, index) => (
              <div
                key={`${combatantId}-segment-${index}`}
                style={
                  index < segmentCount - 1
                    ? {
                        borderRight: '2px solid rgba(33, 5, 6, 0.75)',
                      }
                    : undefined
                }
              />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-bold text-[#f1d8d8]">
            {currentHealth} / {maxHealth} HP
          </p>
          <div className="flex min-h-5 flex-wrap items-center justify-end gap-2">
            {visibleStatuses.map((status) => {
              const Icon = status.icon;

              return (
                <Tooltip key={status.id}>
                  <TooltipTrigger asChild>
                    <span className="inline-flex cursor-help items-center gap-1 whitespace-nowrap text-sm font-bold" style={{ color: status.color }}>
                      <Icon size={14} stroke={2} />
                      <span>{status.value}</span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{`${status.label}: ${status.value}`}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}

export const playerStatusIcons = {
  armor: {
    color: keywordDefinitions.armor.color,
    description: keywordDefinitions.armor.description,
    icon: IconShield,
    label: 'Armor',
  },
  block: {
    color: keywordDefinitions.block.color,
    description: keywordDefinitions.block.description,
    icon: IconShield,
    label: 'Block',
  },
  forge: {
    color: keywordDefinitions.forge.color,
    description: keywordDefinitions.forge.description,
    icon: IconHammer,
    label: 'Forge',
  },
};

export const enemyStatusIcons = {
  bleed: {
    color: keywordDefinitions.bleed.color,
    description: keywordDefinitions.bleed.description,
    icon: IconDroplet,
    label: 'Bleed',
  },
  burn: {
    color: keywordDefinitions.burn.color,
    description: keywordDefinitions.burn.description,
    icon: IconFlame,
    label: 'Burn',
  },
  freeze: {
    color: keywordDefinitions.freeze.color,
    description: keywordDefinitions.freeze.description,
    icon: IconSnowflake,
    label: 'Freeze',
  },
  poison: {
    color: keywordDefinitions.poison.color,
    description: keywordDefinitions.poison.description,
    icon: IconSkull,
    label: 'Poison',
  },
  skipTurn: {
    color: keywordDefinitions.stun.color,
    description: 'This combatant will miss their next turn.',
    icon: IconBolt,
    label: 'Skip Turn',
  },
  stun: {
    color: keywordDefinitions.stun.color,
    description: keywordDefinitions.stun.description,
    icon: IconBolt,
    label: 'Stun',
  },
};