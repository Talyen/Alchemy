import { IconSearch } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';

import { useGame } from '@/app/providers/GameProvider';
import { Button } from '@/components/ui/button';
import { EnemyGalleryGrid } from '@/features/bestiary/EnemyGalleryGrid';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CardView } from '@/entities/cards/CardView';
import { useElementSize } from '@/shared/hooks/use-element-size';
import { AnimatedScreenTitle } from '@/shared/ui/AnimatedScreenTitle';

const CARD_RATIO = 375 / 524;
const CARD_GAP = 16;
const CARD_ROWS = 2;
const CARD_VERTICAL_BLEED = 72;
const CARD_HORIZONTAL_BLEED = 28;
const GLOBAL_CARD_SCALE = 0.9;

function getCardGridLayout(width: number, height: number, totalCards: number) {
  if (width <= 0 || height <= 0 || totalCards === 0) {
    return {
      cardWidth: 220,
      columns: 3,
      pageSize: 6,
    };
  }

  const columns = width >= 1120 ? 3 : 2;
  const usableWidth = Math.max(width - CARD_HORIZONTAL_BLEED * 2, 0);
  const usableHeight = Math.max(height - CARD_VERTICAL_BLEED, 0);
  const widthPerCard = (usableWidth - CARD_GAP * (columns - 1)) / columns;
  const heightPerCard = (usableHeight - CARD_GAP * (CARD_ROWS - 1)) / CARD_ROWS;
  const cardWidth = Math.min(widthPerCard, heightPerCard * CARD_RATIO) * GLOBAL_CARD_SCALE;

  return {
    cardWidth,
    columns,
    pageSize: columns * CARD_ROWS,
  };
}

export function CollectionScreen() {
  const { allCards, unlockedCardIds } = useGame();
  const [activeTab, setActiveTab] = useState<string | null>('cards');
  const [filterText, setFilterText] = useState('');
  const [page, setPage] = useState(1);
  const { ref, height, width } = useElementSize<HTMLDivElement>();
  const normalizedFilter = filterText.trim().toLowerCase();

  const filteredCards = useMemo(
    () =>
      allCards.filter((card) => {
        if (!normalizedFilter) {
          return true;
        }

        return [card.title, card.description, ...card.keywords].some((entry) => entry.toLowerCase().includes(normalizedFilter));
      }),
    [allCards, normalizedFilter],
  );

  const gridLayout = useMemo(() => getCardGridLayout(width, height, filteredCards.length), [filteredCards.length, height, width]);
  const totalPages = Math.max(1, Math.ceil(filteredCards.length / gridLayout.pageSize));

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, totalPages));
  }, [totalPages]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, filterText]);

  const pagedCards = useMemo(() => {
    const startIndex = (page - 1) * gridLayout.pageSize;

    return filteredCards.slice(startIndex, startIndex + gridLayout.pageSize);
  }, [filteredCards, gridLayout.pageSize, page]);

  const collectionSlots = useMemo(
    () => [...pagedCards, ...Array.from({ length: Math.max(gridLayout.pageSize - pagedCards.length, 0) }, () => null)],
    [gridLayout.pageSize, pagedCards],
  );

  return (
    <div className="h-full px-6 py-8" data-testid="screen-collection">
      <div className="mx-auto flex h-full max-w-6xl flex-col gap-6">
        <div className="space-y-3 text-center">
          <AnimatedScreenTitle ta="center">Collections</AnimatedScreenTitle>
          <div className="relative mx-auto w-full max-w-xs">
            <IconSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              className="pl-10"
              onChange={(event) => setFilterText(event.currentTarget.value)}
              placeholder="Filter"
              value={filterText}
            />
          </div>
        </div>

        <Tabs onValueChange={setActiveTab} value={activeTab ?? 'cards'}>
          <TabsList className="mx-auto grid w-full max-w-xl grid-cols-3">
            <TabsTrigger value="cards">Cards</TabsTrigger>
            <TabsTrigger value="bestiary">Bestiary</TabsTrigger>
            <TabsTrigger value="trinkets">Trinkets</TabsTrigger>
          </TabsList>

          <TabsContent value="cards">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden pt-5">
              <div className="min-h-0 flex-1 overflow-auto px-3 py-7" ref={ref}>
                <div
                  style={{
                    alignContent: 'start',
                    display: 'grid',
                    gap: CARD_GAP,
                    gridTemplateColumns: `repeat(${gridLayout.columns}, minmax(0, ${Math.max(120, Math.floor(gridLayout.cardWidth))}px))`,
                    justifyContent: 'center',
                    minHeight: '100%',
                    overflow: 'visible',
                  }}
                >
                {collectionSlots.map((card, index) =>
                  card ? (
                    <div key={card.id} style={{ overflow: 'visible', width: '100%' }}>
                      <CardView card={card} disabled={!unlockedCardIds.includes(card.id)} />
                    </div>
                  ) : (
                    <div key={`empty-slot-${page}-${index}`} />
                  ),
                )}
                </div>
              </div>

            {totalPages > 1 ? (
              <div className="mt-4 flex justify-center" data-testid="collection-pagination">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} size="sm" variant="outline">
                    Prev
                  </Button>
                  {Array.from({ length: totalPages }).map((_, index) => {
                    const nextPage = index + 1;

                    return (
                      <Button key={nextPage} onClick={() => setPage(nextPage)} size="sm" variant={nextPage === page ? 'default' : 'outline'}>
                        {nextPage}
                      </Button>
                    );
                  })}
                  <Button disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} size="sm" variant="outline">
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
            </div>
          </TabsContent>

          <TabsContent className="min-h-0 flex-1 overflow-auto pt-6" value="bestiary">
            <EnemyGalleryGrid filterText={filterText} />
          </TabsContent>

          <TabsContent className="flex flex-1 items-center justify-center pt-6" value="trinkets">
            <p className="text-center text-muted-foreground">
              No trinkets collected yet.
            </p>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
