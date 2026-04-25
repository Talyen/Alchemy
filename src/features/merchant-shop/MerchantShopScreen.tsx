import { IconCoins, IconRefresh } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

import { useGame } from '@/app/providers/GameProvider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CardView } from '@/entities/cards/CardView';
import { cardsById } from '@/shared/content/cards';
import { effectColorPalette } from '@/shared/content/keywords';
import { AnimatedScreenTitle } from '@/shared/ui/AnimatedScreenTitle';

export function MerchantShopScreen() {
  const navigate = useNavigate();
  const { buyShopOffer, leaveMerchantShop, player, refreshShopOffers, shopOffers, shopRefreshAvailable } = useGame();

  const canRefresh = shopRefreshAvailable && (player?.gold ?? 0) >= 40;

  if (!player) {
    return (
      <div className="h-full px-6 py-8" data-testid="screen-merchant-shop">
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <AnimatedScreenTitle ta="center">Merchant&apos;s Shop</AnimatedScreenTitle>
          <p className="text-muted-foreground">No active run is available.</p>
          <Button onClick={() => navigate('/')} variant="outline">Return to Main Menu</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full px-6 py-8" data-testid="screen-merchant-shop">
      <div className="mx-auto flex h-full max-w-6xl flex-col items-center justify-center gap-8">
        <AnimatedScreenTitle ta="center">Merchant&apos;s Shop</AnimatedScreenTitle>
        <p className="max-w-[560px] text-center text-sm text-muted-foreground">
          Spend your gold on new cards for the run. The merchant can refresh once for 40 gold.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <IconCoins color={effectColorPalette.gold} size={18} stroke={2.2} />
            <span className="text-lg font-extrabold" style={{ color: effectColorPalette.gold }}>
              {player.gold}
            </span>
          </div>

          <Button
            disabled={!canRefresh}
            onClick={refreshShopOffers}
            variant="outline"
          >
            {shopRefreshAvailable ? <IconRefresh size={18} /> : null}
            {shopRefreshAvailable ? (
              <span className="inline-flex items-center gap-2">
                <span>Refresh Stock</span>
                <IconCoins color={effectColorPalette.gold} size={16} stroke={2.2} />
                <span className="font-extrabold" style={{ color: effectColorPalette.gold }}>
                  40
                </span>
              </span>
            ) : (
              'No Refresh Available'
            )}
          </Button>
        </div>

        <div className="grid w-full max-w-5xl gap-8 md:grid-cols-3">
          {shopOffers.map((offer) => {
            const card = cardsById[offer.cardId];
            const affordable = player.gold >= offer.cost;

            return (
              <Card className="flex flex-col items-center gap-4 p-5" key={`${offer.cardId}-${offer.cost}`}>
                <div className="w-[246px]">
                  <CardView card={card} disabled={!affordable} />
                </div>
                <Button className="w-[246px]" disabled={!affordable} onClick={() => buyShopOffer(card.id)}>
                  <span className="inline-flex items-center gap-2">
                    <span>Buy for</span>
                    <IconCoins color={effectColorPalette.gold} size={16} stroke={2.2} />
                    <span className="font-extrabold" style={{ color: effectColorPalette.gold }}>
                      {offer.cost}
                    </span>
                  </span>
                </Button>
              </Card>
            );
          })}
        </div>

        <Button
          onClick={() => {
            leaveMerchantShop();
            navigate('/run/destination');
          }}
          size="lg"
          variant="outline"
        >
          Leave
        </Button>
      </div>
    </div>
  );
}
