/**
 * usePresetManager — React hook wrapping PresetManager
 * Provides reactive user presets + factory presets with save/delete/import/export.
 * Surfaces load and save errors so the UI can show actionable feedback.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { PresetManager } from '../dsp/presets/preset-manager';
import { ApiPresetStorage } from '../dsp/presets/api-storage';
import type { EQPreset, EQState } from '../dsp';

export function usePresetManager() {
  const managerRef = useRef(new PresetManager(new ApiPresetStorage()));
  const [userPresets, setUserPresets] = useState<EQPreset[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const manager = managerRef.current;

  useEffect(() => {
    manager.init().then(() => {
      setUserPresets(manager.getUserPresets());
      setInitialized(true);
      setLoadError(null);
    }).catch(() => {
      setLoadError('Could not load presets — check your connection and try again.');
      setInitialized(true);
    });
  }, [manager]);

  const savePreset = useCallback(
    async (name: string, state: EQState, category = 'Custom', description = '') => {
      try {
        const preset = await manager.createPreset(name, state, category, description);
        setUserPresets(manager.getUserPresets());
        setSaveError(null);
        return preset;
      } catch {
        // The preset was added in-memory by createPreset; still reflect it locally
        setUserPresets(manager.getUserPresets());
        setSaveError('Could not save preset — please try again.');
        return null;
      }
    },
    [manager]
  );

  const deletePreset = useCallback(
    async (id: string) => {
      try {
        await manager.deletePreset(id);
        setSaveError(null);
      } catch {
        setSaveError('Could not delete preset — please try again.');
      }
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
    async (json: string): Promise<{ preset: EQPreset | null; errors: string[] }> => {
      try {
        const result = await manager.importPreset(json);
        if (result.preset) setUserPresets(manager.getUserPresets());
        return result;
      } catch {
        setSaveError('Could not save imported preset — please try again.');
        return { preset: null, errors: ['Storage error — preset could not be saved.'] };
      }
    },
    [manager]
  );

  const dismissLoadError = useCallback(() => setLoadError(null), []);
  const dismissSaveError = useCallback(() => setSaveError(null), []);

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
    loadError,
    saveError,
    dismissLoadError,
    dismissSaveError,
  };
}
