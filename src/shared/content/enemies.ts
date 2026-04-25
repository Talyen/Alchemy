import { cardArtById } from '@/shared/assets/registry';

export type EnemyState = {
  artPath: string;
  description: string;
  health: number;
  id: string;
  intent: {
    damage: number;
    label: string;
  };
  maxHealth: number;
  name: string;
  statusEffects: {
    burn: number;
    bleed: number;
    bleedLeech: number;
    freeze: number;
    poison: number;
    stun: number;
    skipTurn: boolean;
  };
};

export function createSkeletonEnemy(battleIndex: number): EnemyState {
  return {
    artPath: cardArtById.skeleton.path,
    description: 'An animated sentinel that strikes with steady pressure and rewards early defensive planning.',
    health: 18 + battleIndex * 8,
    id: `skeleton-${battleIndex}`,
    intent: {
      damage: 5 + battleIndex * 2,
      label: battleIndex % 2 === 0 ? 'Grave Chop' : 'Bone Jab',
    },
    maxHealth: 18 + battleIndex * 8,
    name: 'Skeleton',
    statusEffects: {
      burn: 0,
      bleed: 0,
      bleedLeech: 0,
      freeze: 0,
      poison: 0,
      stun: 0,
      skipTurn: false,
    },
  };
}

export const enemyGallery = [
  {
    id: 'imp',
    name: 'Imp',
    description: 'A dependable first foe for battle tuning: low complexity, visible intent, and clean physical pressure.',
    intent: 'Swipe',
    health: 24,
    maxHealth: 24,
    artPath: cardArtById.imp.path,
  },
  {

    id: 'knight',
    name: 'Knight',
    description: 'Telegraphed heavy strikes paired with periodic defense buffs.',
    intent: 'Guarded Cleave',
    health: 42,
    maxHealth: 42,
    artPath: cardArtById.knight.path,
  },
  {
    id: 'skeleton',
    name: 'Skeleton',
    description: 'Consistent chip damage and future resurrection hooks.',
    intent: 'Bone Jab',
    health: 30,
    maxHealth: 30,
    artPath: cardArtById.skeleton.path,
  },
];
