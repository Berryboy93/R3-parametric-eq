/**
 * @r3/dsp/presets/preset-manager
 * EQ preset management
 */

import { EQPreset, EQState, PresetMetadata } from '../types/index';

export function validatePreset(preset: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (typeof preset !== 'object' || preset === null) return { valid: false, errors: ['Preset must be an object'] };
  const p = preset as Record<string, unknown>;
  if (typeof p.id !== 'string' || !p.id) errors.push('Invalid or missing preset ID');
  if (typeof p.name !== 'string' || !p.name) errors.push('Invalid or missing preset name');
  if (typeof p.category !== 'string' || !p.category) errors.push('Invalid or missing preset category');
  if (typeof p.description !== 'string') errors.push('Invalid preset description');
  if (!Array.isArray(p.tags)) errors.push('Invalid preset tags');
  if (typeof p.createdAt !== 'number' || p.createdAt <= 0) errors.push('Invalid preset createdAt');
  if (typeof p.updatedAt !== 'number' || p.updatedAt <= 0) errors.push('Invalid preset updatedAt');
  return { valid: errors.length === 0, errors };
}

export function createFactoryPresets(): Map<string, EQPreset> {
  const presets = new Map<string, EQPreset>();
  const now = Date.now();

  presets.set('flat', {
    id: 'flat', name: 'Flat', category: 'Reference',
    description: 'Flat response — no processing',
    tags: ['flat', 'reference', 'neutral'],
    state: {
      inputGain: 0, outputGain: 0, bypass: false, analyzerEnabled: true,
      linearPhase: false, oversampling: false, autoGain: false,
      bands: [
        { id: 0, enabled: false, type: 'highpass' as any, frequency: 80, gain: 0, q: 0.7 },
        { id: 1, enabled: false, type: 'lowshelf' as any, frequency: 100, gain: 0, q: 0.7 },
        { id: 2, enabled: false, type: 'peaking' as any, frequency: 300, gain: 0, q: 1.0 },
        { id: 3, enabled: false, type: 'peaking' as any, frequency: 1000, gain: 0, q: 1.0 },
        { id: 4, enabled: false, type: 'peaking' as any, frequency: 3000, gain: 0, q: 1.0 },
        { id: 5, enabled: false, type: 'peaking' as any, frequency: 6000, gain: 0, q: 1.0 },
        { id: 6, enabled: false, type: 'highshelf' as any, frequency: 10000, gain: 0, q: 0.7 },
        { id: 7, enabled: false, type: 'lowpass' as any, frequency: 18000, gain: 0, q: 0.7 },
      ] as any,
    } as any,
    createdAt: now, updatedAt: now,
  });

  presets.set('vocal-bright', {
    id: 'vocal-bright', name: 'Vocal Bright', category: 'Vocal',
    description: 'Brightens vocals with presence peak and high-end lift',
    tags: ['vocal', 'bright', 'presence'],
    state: {
      inputGain: 0, outputGain: 0, bypass: false, analyzerEnabled: true,
      linearPhase: false, oversampling: false, autoGain: false,
      bands: [
        { id: 0, enabled: true, type: 'highpass' as any, frequency: 80, gain: 0, q: 0.7 },
        { id: 1, enabled: false, type: 'lowshelf' as any, frequency: 100, gain: 0, q: 0.7 },
        { id: 2, enabled: true, type: 'peaking' as any, frequency: 300, gain: -2, q: 1.0 },
        { id: 3, enabled: true, type: 'peaking' as any, frequency: 1000, gain: 2, q: 1.0 },
        { id: 4, enabled: true, type: 'peaking' as any, frequency: 3000, gain: 3, q: 1.5 },
        { id: 5, enabled: true, type: 'peaking' as any, frequency: 6000, gain: 2, q: 1.0 },
        { id: 6, enabled: false, type: 'highshelf' as any, frequency: 10000, gain: 0, q: 0.7 },
        { id: 7, enabled: false, type: 'lowpass' as any, frequency: 18000, gain: 0, q: 0.7 },
      ] as any,
    } as any,
    createdAt: now, updatedAt: now,
  });

  presets.set('podcast-clear', {
    id: 'podcast-clear', name: 'Podcast Clear', category: 'Podcast',
    description: 'Optimized for spoken word with reduced rumble',
    tags: ['podcast', 'speech', 'voice'],
    state: {
      inputGain: -3, outputGain: 0, bypass: false, analyzerEnabled: true,
      linearPhase: false, oversampling: false, autoGain: false,
      bands: [
        { id: 0, enabled: true, type: 'highpass' as any, frequency: 100, gain: 0, q: 0.7 },
        { id: 1, enabled: true, type: 'lowshelf' as any, frequency: 150, gain: -4, q: 0.7 },
        { id: 2, enabled: true, type: 'peaking' as any, frequency: 250, gain: -2, q: 1.0 },
        { id: 3, enabled: true, type: 'peaking' as any, frequency: 1500, gain: 4, q: 1.0 },
        { id: 4, enabled: true, type: 'peaking' as any, frequency: 3000, gain: 2, q: 1.5 },
        { id: 5, enabled: true, type: 'peaking' as any, frequency: 7000, gain: -2, q: 2.0 },
        { id: 6, enabled: false, type: 'highshelf' as any, frequency: 10000, gain: 0, q: 0.7 },
        { id: 7, enabled: false, type: 'lowpass' as any, frequency: 18000, gain: 0, q: 0.7 },
      ] as any,
    } as any,
    createdAt: now, updatedAt: now,
  });

  presets.set('bass-boost', {
    id: 'bass-boost', name: 'Bass Boost', category: 'Hip Hop',
    description: 'Enhances low-end punch and sub-bass presence',
    tags: ['bass', 'hip-hop', 'trap'],
    state: {
      inputGain: 0, outputGain: 0, bypass: false, analyzerEnabled: true,
      linearPhase: false, oversampling: false, autoGain: false,
      bands: [
        { id: 0, enabled: true, type: 'highpass' as any, frequency: 20, gain: 0, q: 0.7 },
        { id: 1, enabled: true, type: 'lowshelf' as any, frequency: 80, gain: 6, q: 0.7 },
        { id: 2, enabled: true, type: 'peaking' as any, frequency: 150, gain: 3, q: 1.0 },
        { id: 3, enabled: true, type: 'peaking' as any, frequency: 400, gain: -1, q: 1.0 },
        { id: 4, enabled: false, type: 'peaking' as any, frequency: 1000, gain: 0, q: 1.0 },
        { id: 5, enabled: false, type: 'peaking' as any, frequency: 5000, gain: 0, q: 1.0 },
        { id: 6, enabled: false, type: 'highshelf' as any, frequency: 10000, gain: 0, q: 0.7 },
        { id: 7, enabled: false, type: 'lowpass' as any, frequency: 18000, gain: 0, q: 0.7 },
      ] as any,
    } as any,
    createdAt: now, updatedAt: now,
  });

  presets.set('air', {
    id: 'air', name: 'Air', category: 'Master',
    description: 'Adds sparkle and air to the high frequencies',
    tags: ['air', 'mastering', 'brightness'],
    state: {
      inputGain: 0, outputGain: 0, bypass: false, analyzerEnabled: true,
      linearPhase: false, oversampling: false, autoGain: false,
      bands: [
        { id: 0, enabled: true, type: 'highpass' as any, frequency: 30, gain: 0, q: 0.7 },
        { id: 1, enabled: false, type: 'lowshelf' as any, frequency: 100, gain: 0, q: 0.7 },
        { id: 2, enabled: false, type: 'peaking' as any, frequency: 300, gain: 0, q: 1.0 },
        { id: 3, enabled: false, type: 'peaking' as any, frequency: 1000, gain: 0, q: 1.0 },
        { id: 4, enabled: false, type: 'peaking' as any, frequency: 3000, gain: 0, q: 1.0 },
        { id: 5, enabled: false, type: 'peaking' as any, frequency: 8000, gain: 0, q: 1.0 },
        { id: 6, enabled: true, type: 'highshelf' as any, frequency: 12000, gain: 4, q: 0.7 },
        { id: 7, enabled: false, type: 'lowpass' as any, frequency: 20000, gain: 0, q: 0.7 },
      ] as any,
    } as any,
    createdAt: now, updatedAt: now,
  });

  return presets;
}

export interface PresetStorage {
  savePreset(preset: EQPreset): Promise<void>;
  deletePreset(id: string): Promise<void>;
  loadAllPresets(): Promise<EQPreset[]>;
}

export class LocalStoragePresetStorage implements PresetStorage {
  private readonly STORAGE_KEY = 'r3-eq-presets';

  async savePreset(preset: EQPreset): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const presets = this.loadFromStorage();
      presets[preset.id] = preset;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(presets));
    } catch (e) { console.error('Failed to save preset:', e); }
  }

  async deletePreset(id: string): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const presets = this.loadFromStorage();
      delete presets[id];
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(presets));
    } catch (e) { console.error('Failed to delete preset:', e); }
  }

  async loadAllPresets(): Promise<EQPreset[]> {
    if (typeof window === 'undefined') return [];
    try { return Object.values(this.loadFromStorage()); }
    catch (e) { return []; }
  }

  private loadFromStorage(): Record<string, EQPreset> {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch { return {}; }
  }
}

export class PresetManager {
  private presets: Map<string, EQPreset>;
  private storage: PresetStorage;

  constructor(storage?: PresetStorage) {
    this.presets = createFactoryPresets();
    this.storage = storage || new LocalStoragePresetStorage();
  }

  createPreset(name: string, state: EQState, category = 'Custom', description = '', tags: string[] = []): EQPreset {
    const id = this.generateId(name);
    const now = Date.now();
    const preset: EQPreset = { id, name, category, description, tags, state, createdAt: now, updatedAt: now };
    this.presets.set(id, preset);
    this.storage.savePreset(preset);
    return preset;
  }

  getPreset(id: string): EQPreset | null { return this.presets.get(id) || null; }
  getAllPresets(): EQPreset[] { return Array.from(this.presets.values()); }
  getPresetsByCategory(category: string): EQPreset[] { return this.getAllPresets().filter(p => p.category === category); }
  getCategories(): string[] { return [...new Set(this.getAllPresets().map(p => p.category))].sort(); }

  deletePreset(id: string): boolean {
    const exists = this.presets.has(id);
    if (exists) { this.presets.delete(id); this.storage.deletePreset(id); }
    return exists;
  }

  getPresetMetadata(): PresetMetadata[] {
    return this.getAllPresets().map(p => ({ id: p.id, name: p.name, category: p.category, tags: p.tags }));
  }

  private generateId(name: string): string {
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    let id = base, counter = 1;
    while (this.presets.has(id)) { id = `${base}-${counter}`; counter++; }
    return id;
  }
}
