/**
 * ApiPresetStorage — PresetStorage backed by the R3 NATIVE REST API.
 * Implements the same PresetStorage interface as LocalStoragePresetStorage
 * so the PresetManager requires no changes.
 */

import type { EQPreset } from '../types/index';
import type { PresetStorage } from './preset-manager';

export class ApiPresetStorage implements PresetStorage {
  private readonly base: string;

  constructor(base = '/api') {
    this.base = base;
  }

  async savePreset(preset: EQPreset): Promise<void> {
    try {
      const res = await fetch(`${this.base}/presets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preset),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error('[ApiPresetStorage] save failed:', body);
      }
    } catch (err) {
      console.error('[ApiPresetStorage] save error:', err);
    }
  }

  async deletePreset(id: string): Promise<void> {
    try {
      const res = await fetch(`${this.base}/presets/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error('[ApiPresetStorage] delete failed:', body);
      }
    } catch (err) {
      console.error('[ApiPresetStorage] delete error:', err);
    }
  }

  async loadAllPresets(): Promise<EQPreset[]> {
    try {
      const res = await fetch(`${this.base}/presets`);
      if (!res.ok) return [];
      return (await res.json()) as EQPreset[];
    } catch (err) {
      console.error('[ApiPresetStorage] load error:', err);
      return [];
    }
  }
}
