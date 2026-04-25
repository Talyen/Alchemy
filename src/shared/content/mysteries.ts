export type MysteryEventType = 'treasure-chest';

export type MysteryEventState = {
  goldFound: number | null;
  status: 'closed' | 'opened';
  title: string;
  type: MysteryEventType;
};

const mysteryEventPool: MysteryEventType[] = ['treasure-chest'];

export function getRandomMysteryEvent(): MysteryEventState {
  const type = mysteryEventPool[Math.floor(Math.random() * mysteryEventPool.length)] ?? 'treasure-chest';

  switch (type) {
    case 'treasure-chest':
    default:
      return {
        goldFound: null,
        status: 'closed',
        title: 'Treasure Chest',
        type: 'treasure-chest',
      };
  }
}