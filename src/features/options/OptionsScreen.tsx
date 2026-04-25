import { useState } from 'react';

import { resolutionOptions, useSettings } from '@/app/providers/SettingsProvider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AnimatedScreenTitle } from '@/shared/ui/AnimatedScreenTitle';

export function OptionsScreen() {
  const { resetSettings, settings, updateSettings } = useSettings();
  const [tab, setTab] = useState('display');

  return (
    <div className="h-full px-6 py-8" data-testid="screen-options">
      <div className="mx-auto flex h-full max-w-4xl flex-col items-center justify-center gap-8">
        <div className="space-y-1 text-center">
          <AnimatedScreenTitle ta="center">Options</AnimatedScreenTitle>
          <p className="text-sm text-muted-foreground">
            Prototype settings persist in local storage between sessions.
          </p>
        </div>

        <Tabs onValueChange={setTab} value={tab}>
          <TabsList className="grid w-full max-w-3xl grid-cols-4">
            <TabsTrigger value="display">Display</TabsTrigger>
            <TabsTrigger value="audio">Audio</TabsTrigger>
            <TabsTrigger value="gameplay">Gameplay</TabsTrigger>
            <TabsTrigger value="other">Other</TabsTrigger>
          </TabsList>

          <TabsContent value="display">
            <Card className="w-full max-w-3xl p-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-muted-foreground">Resolution</p>
                  <Select onValueChange={(value) => updateSettings({ resolution: value as (typeof resolutionOptions)[number] })} value={settings.resolution}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a resolution" />
                    </SelectTrigger>
                    <SelectContent>
                      {resolutionOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="audio">
            <Card className="w-full max-w-3xl p-6">
              <div className="space-y-5">
                {[
                  {
                    label: 'Master volume',
                    value: settings.masterVolume,
                    onChange: (value: number) => updateSettings({ masterVolume: value }),
                  },
                  {
                    label: 'Music volume',
                    value: settings.musicVolume,
                    onChange: (value: number) => updateSettings({ musicVolume: value }),
                  },
                  {
                    label: 'SFX volume',
                    value: settings.sfxVolume,
                    onChange: (value: number) => updateSettings({ sfxVolume: value }),
                  },
                ].map((entry) => (
                  <div className="space-y-2" key={entry.label}>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{entry.label}</span>
                      <span>{entry.value}%</span>
                    </div>
                    <Slider max={100} min={0} onValueChange={(value) => entry.onChange(value[0] ?? 0)} step={1} value={[entry.value]} />
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="gameplay">
            <Card className="w-full max-w-3xl p-6">
              <div className="space-y-2">
                <p className="font-semibold">Gameplay</p>
                <p className="text-sm text-muted-foreground">Gameplay toggles will land here as combat and run systems expand.</p>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="other">
            <Card className="w-full max-w-3xl p-6">
              <div className="space-y-2">
                <p className="font-semibold">Other</p>
                <p className="text-sm text-muted-foreground">Miscellaneous prototype options and debug affordances will live here.</p>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        <Button onClick={resetSettings} variant="outline">
          Reset to Default
        </Button>
      </div>
    </div>
  );
}
