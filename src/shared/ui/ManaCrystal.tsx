import { IconDiamond } from '@tabler/icons-react';

import { manaTypes, type ManaType } from '@/entities/cards/types';

type ManaCrystalIconProps = {
  active?: boolean;
  size?: number;
  type?: ManaType;
};

const spentColor = 'rgba(154, 159, 170, 0.68)';

export const manaTypePresentation: Record<
  ManaType,
  { color: string; glow: string; label: string }
> = {
  arcane: { color: '#59a9ff', glow: 'rgba(89, 169, 255, 0.48)', label: 'Mana' },
};

export const manaTypeOrder = [...manaTypes];

export function ManaCrystalIcon({ active = true, size = 16, type = 'arcane' }: ManaCrystalIconProps) {
  const presentation = manaTypePresentation[type];

  return (
    <IconDiamond
      color={active ? presentation.color : spentColor}
      size={size}
      stroke={2.1}
      style={
        active
          ? { filter: `drop-shadow(0 0 6px ${presentation.glow})` }
          : { opacity: 0.58 }
      }
    />
  );
}

export function ManaCrystalSwatch({ size = 16, type }: { size?: number; type: ManaType }) {
  return (
    <span aria-label={`${manaTypePresentation[type].label} mana`} style={{ alignItems: 'center', display: 'inline-flex', justifyContent: 'center' }}>
      <ManaCrystalIcon size={size} type={type} />
    </span>
  );
}