import type { ReactNode } from 'react';

import { GameProvider } from '@/app/providers/GameProvider';
import { SettingsProvider } from '@/app/providers/SettingsProvider';

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <SettingsProvider>
      <GameProvider>{children}</GameProvider>
    </SettingsProvider>
  );
}
