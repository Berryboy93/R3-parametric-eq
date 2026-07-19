/**
 * usePresetManager — React hook wrapping PresetManager
 * Provides reactive user presets + factory presets with save/delete/import/export
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { PresetManager } from '../dsp/presets/preset-manager';
import { ApiPresetStorage } from '../dsp/presets/api-storage';
import type { EQPreset, EQState } from '../dsp';

export function usePresetManager() {
  const managerRef = useRef(new PresetManager(new ApiPresetStorage()));
  const [userPresets, setUserPresets] = useState<EQPreset[]>([]);
  const [initialized, setInitialized] = useState(false);

  const manager = managerRef.current;

  useEffect(() => {
    manager.init().then(() => {
      setUserPresets(manager.getUserPresets());
      setInitialized(true);
    });
  }, [manager]);

  const savePreset = useCallback(
    (name: string, state: EQState, category = 'Custom', description = '') => {
      const preset = manager.createPreset(name, state, category, description);
      setUserPresets(manager.getUserPresets());
      return preset;
    },
    [manager]
  );

  const deletePreset = useCallback(
    (id: string) => {
      manager.deletePreset(id);
      setUserPresets(manager.getUserPresets());
    },
    [manager]
  );

  const exportPreset = useCallback(
    (id: string) => {
      const json = manager.exportPreset(id);
      if (!json) return;
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `r3-preset-${id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [manager]
  );

  const importPreset = useCallback(
    (json: string): { preset: EQPreset | null; errors: string[] } => {
      const result = manager.importPreset(json);
      if (result.preset) setUserPresets(manager.getUserPresets());
      return result;
    },
    [manager]
  );

  const factoryPresets = manager.getFactoryPresets();

  return {
    factoryPresets,
    userPresets,
    allPresets: [...factoryPresets, ...userPresets] as EQPreset[],
    savePreset,
    deletePreset,
    exportPreset,
    importPreset,
    initialized,
    manager,
  };
}
