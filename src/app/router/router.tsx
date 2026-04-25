import { Suspense, lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { createHashRouter, Outlet, useLocation } from 'react-router-dom';

import { GameViewport } from '@/shared/ui/GameViewport';
import { GlobalScreenMenu } from '@/shared/ui/GlobalScreenMenu';

const BattleScreen = lazy(async () => ({ default: (await import('@/features/battle/BattleScreen')).BattleScreen }));
const BestiaryScreen = lazy(async () => ({ default: (await import('@/features/bestiary/BestiaryScreen')).BestiaryScreen }));
const BattleRewardScreen = lazy(async () => ({ default: (await import('@/features/battle-reward/BattleRewardScreen')).BattleRewardScreen }));
const CampfireScreen = lazy(async () => ({ default: (await import('@/features/campfire/CampfireScreen')).CampfireScreen }));
const CharacterSelectScreen = lazy(
  async () => ({ default: (await import('@/features/character-select/CharacterSelectScreen')).CharacterSelectScreen }),
);
const CollectionScreen = lazy(async () => ({ default: (await import('@/features/collection/CollectionScreen')).CollectionScreen }));
const DestinationScreen = lazy(async () => ({ default: (await import('@/features/destination/DestinationScreen')).DestinationScreen }));
const MainMenuScreen = lazy(async () => ({ default: (await import('@/features/main-menu/MainMenuScreen')).MainMenuScreen }));
const MerchantShopScreen = lazy(async () => ({ default: (await import('@/features/merchant-shop/MerchantShopScreen')).MerchantShopScreen }));
const MysteryEventScreen = lazy(async () => ({ default: (await import('@/features/mystery/MysteryEventScreen')).MysteryEventScreen }));
const OptionsScreen = lazy(async () => ({ default: (await import('@/features/options/OptionsScreen')).OptionsScreen }));
const RunEndScreen = lazy(async () => ({ default: (await import('@/features/run-end/RunEndScreen')).RunEndScreen }));
const TalentsScreen = lazy(async () => ({ default: (await import('@/features/talents/TalentsScreen')).TalentsScreen }));
const TestLabScreen = lazy(async () => ({ default: (await import('@/features/test-lab/TestLabScreen')).TestLabScreen }));

function RouteFallback() {
  return (
    <div className="h-full">
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-[rgba(220,162,102,0.86)]" />
        <p className="text-sm font-semibold text-muted-foreground">
          Loading scene...
        </p>
      </div>
    </div>
  );
}

function lazyRoute(ScreenComponent: LazyExoticComponent<ComponentType>) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <ScreenComponent />
    </Suspense>
  );
}

function RootLayout() {
  const location = useLocation();
  const showScreenMenu = location.pathname !== '/' && location.pathname !== '/battle';

  return (
    <GameViewport>
      {showScreenMenu ? <GlobalScreenMenu /> : null}
      <div className="h-full">
        <Outlet />
      </div>
    </GameViewport>
  );
}

export const router = createHashRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: lazyRoute(MainMenuScreen) },
      { path: '/run/new', element: lazyRoute(CharacterSelectScreen) },
      { path: '/battle', element: lazyRoute(BattleScreen) },
      { path: '/battle/reward', element: lazyRoute(BattleRewardScreen) },
      { path: '/run/campfire', element: lazyRoute(CampfireScreen) },
      { path: '/run/destination', element: lazyRoute(DestinationScreen) },
      { path: '/run/mystery', element: lazyRoute(MysteryEventScreen) },
      { path: '/run/shop', element: lazyRoute(MerchantShopScreen) },
      { path: '/run/end', element: lazyRoute(RunEndScreen) },
      { path: '/collection', element: lazyRoute(CollectionScreen) },
      { path: '/talents', element: lazyRoute(TalentsScreen) },
      { path: '/bestiary', element: lazyRoute(BestiaryScreen) },
      { path: '/options', element: lazyRoute(OptionsScreen) },
      { path: '/test-lab', element: lazyRoute(TestLabScreen) },
    ],
  },
]);
