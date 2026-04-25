import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { useLocalStorage } from '@/shared/hooks/use-local-storage';

export type ResolutionSetting = '1920x1080' | '2560x1440' | '3840x2160';

export const resolutionOptions: ResolutionSetting[] = ['1920x1080', '2560x1440', '3840x2160'];

type SettingsState = {
  masterVolume: number;
  musicVolume: number;
  resolution: ResolutionSetting;
  sfxVolume: number;
};

type SettingsContextValue = {
  settings: SettingsState;
  updateSettings: (patch: Partial<SettingsState>) => void;
  resetSettings: () => void;
};

const defaultSettings: SettingsState = {
  masterVolume: 80,
  musicVolume: 65,
  resolution: '1920x1080',
  sfxVolume: 75,
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

type SettingsProviderProps = {
  children: ReactNode;
};

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [settings, setSettings] = useLocalStorage<SettingsState>({
    key: 'alchemy-settings',
    defaultValue: defaultSettings,
  });

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      updateSettings: (patch) => setSettings((current) => ({ ...current, ...patch })),
      resetSettings: () => setSettings(defaultSettings),
    }),
    [settings, setSettings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);

  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }

  return context;
}
