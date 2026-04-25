import {
  IconCampfire,
  IconCrown,
  IconFlask2,
  IconShoppingBag,
  IconSparkles,
  IconSwords,
} from '@tabler/icons-react';

export type DestinationType =
  | 'alchemists-hut'
  | 'campfire'
  | 'elite-combat'
  | 'merchant-shop'
  | 'mystery'
  | 'normal-combat';

export type DestinationDefinition = {
  accent: string;
  icon: typeof IconSwords;
  id: DestinationType;
  summary: string;
  title: string;
};

export const destinationDefinitions: Record<DestinationType, DestinationDefinition> = {
  'alchemists-hut': {
    accent: '#61b56f',
    icon: IconFlask2,
    id: 'alchemists-hut',
    summary: 'A careful alchemist offers a potent brew before the next encounter.',
    title: "Alchemist's Hut",
  },
  campfire: {
    accent: '#ef7f44',
    icon: IconCampfire,
    id: 'campfire',
    summary: 'Rest, recover, and steady yourself before rejoining the route.',
    title: 'Campfire',
  },
  'elite-combat': {
    accent: '#a13f58',
    icon: IconCrown,
    id: 'elite-combat',
    summary: 'A harder fight with a tougher foe awaits.',
    title: 'Elite Combat',
  },
  'merchant-shop': {
    accent: '#d4a84d',
    icon: IconShoppingBag,
    id: 'merchant-shop',
    summary: 'A wandering merchant offers a small edge before the next battle.',
    title: "Merchant's Shop",
  },
  mystery: {
    accent: '#7c5ce0',
    icon: IconSparkles,
    id: 'mystery',
    summary: 'An unknown event may help or hinder the expedition.',
    title: 'Mystery',
  },
  'normal-combat': {
    accent: '#c14f4f',
    icon: IconSwords,
    id: 'normal-combat',
    summary: 'Advance directly into the next standard encounter.',
    title: 'Combat',
  },
};

const destinationPool: DestinationType[] = [
  'normal-combat',
  'elite-combat',
  'campfire',
  'mystery',
  'merchant-shop',
  'alchemists-hut',
];

export function getRandomDestinations() {
  const pool = [...destinationPool];
  const picked: DestinationDefinition[] = [];

  while (picked.length < 3 && pool.length > 0) {
    const index = Math.floor(Math.random() * pool.length);
    const [nextId] = pool.splice(index, 1);
    picked.push(destinationDefinitions[nextId]);
  }

  return picked;
}
