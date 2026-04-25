import type { CardTemplateId } from '@/entities/cards/types';

type AssetDescriptor = {
  id: string;
  title: string;
  path: string;
};

export const logos = [
  {
    id: 'alchemy-core',
    title: 'Alchemy',
    path: '/assets/ui/Alchemy Logo.png',
  },
] as const;

export const primaryLogo = logos[0];

export const templateSheets: AssetDescriptor[] = [
  {
    id: 'core-frames',
    title: 'Card Frame Sheet',
    path: '/assets/templates/Card Template Set.png',
  },
];

export const templateFrames: Record<CardTemplateId, AssetDescriptor> = {
  void: { id: 'void', title: 'Void', path: '/assets/templates/frames/Void.webp' },
  nature: { id: 'nature', title: 'Nature', path: '/assets/templates/frames/Nature.webp' },
  arcane: { id: 'arcane', title: 'Arcane', path: '/assets/templates/frames/Arcane.webp' },
  fire: { id: 'fire', title: 'Fire', path: '/assets/templates/frames/Fire.webp' },
  frost: { id: 'frost', title: 'Frost', path: '/assets/templates/frames/Frost.webp' },
  mechanical: {
    id: 'mechanical',
    title: 'Mechanical',
    path: '/assets/templates/frames/Mechanical.webp',
  },
  holy: { id: 'holy', title: 'Holy', path: '/assets/templates/frames/Holy.webp' },
  death: { id: 'death', title: 'Death', path: '/assets/templates/frames/Death.webp' },
};

export const characterArt = {
  knight: '/assets/characters/Knight.webp',
} as const;

export const cardArt = [
  'Anvil',
  'Apple',
  'Bash',
  'Blessed Aegis',
  'Block',
  'Bread',
  'Cleanse',
  'Fangs',
  'Fireball',
  'Frostbolt',
  'Gold',
  'Haste',
  'Heal',
  'Health Potion',
  'Imp',
  'Knight',
  'Lizard Scout',
  'Mana Berries',
  'Mana Crystal',
  'Mana Crystals',
  'Mana Potion',
  'Meteor',
  'Panacea Potion',
  'Plate Mail',
  'Poison Dagger',
  'Skeleton',
  'Slash',
  'Stab',
  'Steal',
  'Wish',
].map((name) => ({
  id: name.toLowerCase().replaceAll(' ', '-'),
  title: name,
  path: `/assets/card-art/${name}.webp`,
}));

export const cardArtById = Object.fromEntries(cardArt.map((entry) => [entry.id, entry])) as Record<
  string,
  (typeof cardArt)[number]
>;
