/**
 * @r3/dsp/presets/preset-manager
 * EQ preset management - save, load, import, export
 * Fully validated with schema enforcement
 */

import { EQPreset, EQState, PresetMetadata } from '../types/index.js';
import { createParametricEQ } from '../filters/parametric-eq.js';

// ============================================================================
// Preset Validation
// ============================================================================

const PRESET_SCHEMA = {
  id: (v: unknown): v is string => typeof v === 'string' && v.length > 0,
  name: (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 100,
  category: (v: unknown): v is string => typeof v === 'string' && v.length > 0,
  description: (v: unknown): v is string => typeof v === 'string' && v.length <= 500,
  tags: (v: unknown): v is string[] => Array.isArray(v) && v.every((t) => typeof t === 'string'),
};

/**
 * Validate preset structure
 */
export function validatePreset(preset: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (typeof preset !== 'object' || preset === null) {
    return { valid: false, errors: ['Preset must be an object'] };
  }

  const p = preset as Record<string, unknown>;

  if (!PRESET_SCHEMA.id(p.id)) {
    errors.push('Invalid or missing preset ID');
  }

  if (!PRESET_SCHEMA.name(p.name)) {
    errors.push('Invalid or missing preset name');
  }

  if (!PRESET_SCHEMA.category(p.category)) {
    errors.push('Invalid or missing preset category');
  }

  if (!PRESET_SCHEMA.description(p.description)) {
    errors.push('Invalid preset description');
  }

  if (!PRESET_SCHEMA.tags(p.tags)) {
    errors.push('Invalid preset tags');
  }

  if (typeof p.createdAt !== 'number' || p.createdAt <= 0) {
    errors.push('Invalid preset createdAt timestamp');
  }

  if (typeof p.updatedAt !== 'number' || p.updatedAt <= 0) {
    errors.push('Invalid preset updatedAt timestamp');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Factory Presets
// ============================================================================

/**
 * Create factory presets for common use cases
 */
export function createFactoryPresets(): Map<string, EQPreset> {
  const presets = new Map<string, EQPreset>();

  // Vocal Enhancement
  presets.set('vocal-bright', {
    id: 'vocal-bright',
    name: 'Vocal Bright',
    category: 'Vocal',
    description: 'Brightens vocals with presence peak and high-end lift',
    tags: ['vocal', 'bright', 'presence'],
    state: {
      inputGain: 0,
      outputGain: 0,
      bypass: false,
      analyzerEnabled: true,
      linearPhase: false,
      oversampling: false,
      autoGain: false,
      bands: [
        { id: 0, enabled: true, type: 'highpass', frequency: 80, gain: 0, q: 0.7 },
        { id: 1, enabled: false, type: 'lowshelf', frequency: 100, gain: 0, q: 0.7 },
        { id: 2, enabled: true, type: 'peaking', frequency: 300, gain: -2, q: 1.0 },
        { id: 3, enabled: true, type: 'peaking', frequency: 1000, gain: 2, q: 1.0 },
        { id: 4, enabled: true, type: 'peaking', frequency: 3000, gain: 3, q: 1.5 },
        { id: 5, enabled: true, type: 'peaking', frequency: 6000, gain: 2, q: 1.0 },
        { id: 6, enabled: false, type: 'highshelf', frequency: 10000, gain: 0, q: 0.7 },
        { id: 7, enabled: false, type: 'lowpass', frequency: 18000, gain: 0, q: 0.7 },
      ] as any,
    } as any,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // Podcast - Clear and punchy
  presets.set('podcast-clear', {
    id: 'podcast-clear',
    name: 'Podcast Clear',
    category: 'Podcast',
    description: 'Optimized for spoken word with reduced rumble and sibilance control',
    tags: ['podcast', 'speech', 'voice'],
    state: {
      inputGain: -3,
      outputGain: 0,
      bypass: false,
      analyzerEnabled: true,
      linearPhase: false,
      oversampling: false,
      autoGain: false,
      bands: [
        { id: 0, enabled: true, type: 'highpass', frequency: 100, gain: 0, q: 0.7 },
        { id: 1, enabled: true, type: 'lowshelf', frequency: 150, gain: -4, q: 0.7 },
        { id: 2, enabled: true, type: 'peaking', frequency: 250, gain: -2, q: 1.0 },
        { id: 3, enabled: true, type: 'peaking', frequency: 1500, gain: 4, q: 1.0 },
        { id: 4, enabled: true, type: 'peaking', frequency: 3000, gain: 2, q: 1.5 },
        { id: 5, enabled: true, type: 'peaking', frequency: 7000, gain: -2, q: 2.0 },
        { id: 6, enabled: false, type: 'highshelf', frequency: 10000, gain: 0, q: 0.7 },
        { id: 7, enabled: false, type: 'lowpass', frequency: 18000, gain: 0, q: 0.7 },
      ] as any,
    } as any,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // Bass Boost - For low-end focused genres
  presets.set('bass-boost', {
    id: 'bass-boost',
    name: 'Bass Boost',
    category: 'Hip Hop',
    description: 'Enhances low-end punch and sub-bass presence',
    tags: ['bass', 'hip-hop', 'trap', 'urban'],
    state: {
      inputGain: 0,
      outputGain: 0,
      bypass: false,
      analyzerEnabled: true,
      linearPhase: false,
      oversampling: false,
      autoGain: false,
      bands: [
        { id: 0, enabled: true, type: 'highpass', frequency: 20, gain: 0, q: 0.7 },
        { id: 1, enabled: true, type: 'lowshelf', frequency: 80, gain: 6, q: 0.7 },
        { id: 2, enabled: true, type: 'peaking', frequency: 150, gain: 3, q: 1.0 },
        { id: 3, enabled: true, type: 'peaking', frequency: 400, gain: -1, q: 1.0 },
        { id: 4, enabled: false, type: 'peaking', frequency: 1000, gain: 0, q: 1.0 },
        { id: 5, enabled: false, type: 'peaking', frequency: 5000, gain: 0, q: 1.0 },
        { id: 6, enabled: false, type: 'highshelf', frequency: 10000, gain: 0, q: 0.7 },
        { id: 7, enabled: false, type: 'lowpass', frequency: 18000, gain: 0, q: 0.7 },
      ] as any,
    } as any,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // Reference Flat - Minimal coloration
  presets.set('reference-flat', {
    id: 'reference-flat',
    name: 'Reference Flat',
    category: 'Master',
    description: 'Flat response with high-pass and low-pass protection',
    tags: ['reference', 'mastering', 'neutral'],
    state: {
      inputGain: 0,
      outputGain: 0,
      bypass: false,
      analyzerEnabled: true,
      linearPhase: true,
      oversampling: false,
      autoGain: false,
      bands: [
        { id: 0, enabled: true, type: 'highpass', frequency: 20, gain: 0, q: 0.7 },
        { id: 1, enabled: false, type: 'lowshelf', frequency: 100, gain: 0, q: 0.7 },
        { id: 2, enabled: false, type: 'peaking', frequency: 1000, gain: 0, q: 1.0 },
        { id: 3, enabled: false, type: 'peaking', frequency: 1000, gain: 0, q: 1.0 },
        { id: 4, enabled: false, type: 'peaking', frequency: 1000, gain: 0, q: 1.0 },
        { id: 5, enabled: false, type: 'peaking', frequency: 5000, gain: 0, q: 1.0 },
        { id: 6, enabled: false, type: 'highshelf', frequency: 10000, gain: 0, q: 0.7 },
        { id: 7, enabled: true, type: 'lowpass', frequency: 20000, gain: 0, q: 0.7 },
      ] as any,
    } as any,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  return presets;
}

// ============================================================================
// Preset Manager Class
// ============================================================================

export class PresetManager {
  private presets: Map<string, EQPreset>;
  private storage: PresetStorage;

  constructor(storage?: PresetStorage) {
    this.presets = createFactoryPresets();
    this.storage = storage || new LocalStoragePresetStorage();
  }

  /**
   * Create a new preset from current EQ state
   */
  createPreset(
    name: string,
    state: EQState,
    category: string = 'Custom',
    description: string = '',
    tags: string[] = []
  ): EQPreset {
    const id = this.generatePresetId(name);
    const now = Date.now();

    const preset: EQPreset = {
      id,
      name,
      category,
      description,
      tags,
      state,
      createdAt: now,
      updatedAt: now,
    };

    // Validate before storing
    const validation = validatePreset(preset);
    if (!validation.valid) {
      throw new Error(`Invalid preset: ${validation.errors.join(', ')}`);
    }

    this.presets.set(id, preset);
    this.storage.savePreset(preset);

    return preset;
  }

  /**
   * Get preset by ID
   */
  getPreset(id: string): EQPreset | null {
    return this.presets.get(id) || null;
  }

  /**
   * Get all presets
   */
  getAllPresets(): EQPreset[] {
    return Array.from(this.presets.values());
  }

  /**
   * Get presets by category
   */
  getPresetsByCategory(category: string): EQPreset[] {
    return Array.from(this.presets.values()).filter((p) => p.category === category);
  }

  /**
   * Get presets by tag
   */
  getPresetsByTag(tag: string): EQPreset[] {
    return Array.from(this.presets.values()).filter((p) => p.tags.includes(tag));
  }

  /**
   * Search presets by name
   */
  searchPresets(query: string): EQPreset[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.presets.values()).filter(
      (p) => p.name.toLowerCase().includes(lowerQuery) || p.description.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Update existing preset
   */
  updatePreset(id: string, updates: Partial<EQPreset>): EQPreset {
    const existing = this.presets.get(id);
    if (!existing) {
      throw new Error(`Preset not found: ${id}`);
    }

    const updated: EQPreset = {
      ...existing,
      ...updates,
      id: existing.id, // Prevent ID changes
      createdAt: existing.createdAt, // Preserve creation time
      updatedAt: Date.now(),
    };

    const validation = validatePreset(updated);
    if (!validation.valid) {
      throw new Error(`Invalid preset: ${validation.errors.join(', ')}`);
    }

    this.presets.set(id, updated);
    this.storage.savePreset(updated);

    return updated;
  }

  /**
   * Delete preset
   */
  deletePreset(id: string): boolean {
    const exists = this.presets.has(id);
    if (exists) {
      this.presets.delete(id);
      this.storage.deletePreset(id);
    }
    return exists;
  }

  /**
   * Export preset as JSON
   */
  exportPreset(id: string): string {
    const preset = this.getPreset(id);
    if (!preset) {
      throw new Error(`Preset not found: ${id}`);
    }

    return JSON.stringify(preset, null, 2);
  }

  /**
   * Export all presets as JSON
   */
  exportAllPresets(): string {
    const allPresets = this.getAllPresets();
    return JSON.stringify(
      {
        version: '1.0',
        exportDate: new Date().toISOString(),
        presets: allPresets,
      },
      null,
      2
    );
  }

  /**
   * Import preset from JSON
   */
  importPreset(json: string): EQPreset {
    let data: unknown;

    try {
      data = JSON.parse(json);
    } catch (e) {
      throw new Error(`Failed to parse preset JSON: ${e}`);
    }

    const validation = validatePreset(data);
    if (!validation.valid) {
      throw new Error(`Invalid preset: ${validation.errors.join(', ')}`);
    }

    const preset = data as EQPreset;
    this.presets.set(preset.id, preset);
    this.storage.savePreset(preset);

    return preset;
  }

  /**
   * Load all presets from storage
   */
  async loadFromStorage(): Promise<void> {
    const loadedPresets = await this.storage.loadAllPresets();
    for (const preset of loadedPresets) {
      this.presets.set(preset.id, preset);
    }
  }

  /**
   * Generate unique preset ID from name
   */
  private generatePresetId(name: string): string {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    let id = base;
    let counter = 1;

    while (this.presets.has(id)) {
      id = `${base}-${counter}`;
      counter++;
    }

    return id;
  }

  /**
   * Get all categories
   */
  getCategories(): string[] {
    const categories = new Set<string>();
    for (const preset of this.presets.values()) {
      categories.add(preset.category);
    }
    return Array.from(categories).sort();
  }

  /**
   * Get all tags
   */
  getAllTags(): string[] {
    const tags = new Set<string>();
    for (const preset of this.presets.values()) {
      for (const tag of preset.tags) {
        tags.add(tag);
      }
    }
    return Array.from(tags).sort();
  }

  /**
   * Get preset metadata (lighter than full preset)
   */
  getPresetMetadata(): PresetMetadata[] {
    return Array.from(this.presets.values()).map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      tags: p.tags,
    }));
  }
}

// ============================================================================
// Storage Interface & Implementation
// ============================================================================

export interface PresetStorage {
  savePreset(preset: EQPreset): Promise<void>;
  deletePreset(id: string): Promise<void>;
  loadAllPresets(): Promise<EQPreset[]>;
}

/**
 * LocalStorage-based preset storage
 */
export class LocalStoragePresetStorage implements PresetStorage {
  private readonly STORAGE_KEY = 'r3-eq-presets';

  async savePreset(preset: EQPreset): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      const presets = this.loadFromStorage();
      presets[preset.id] = preset;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(presets));
    } catch (e) {
      console.error('Failed to save preset:', e);
    }
  }

  async deletePreset(id: string): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      const presets = this.loadFromStorage();
      delete presets[id];
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(presets));
    } catch (e) {
      console.error('Failed to delete preset:', e);
    }
  }

  async loadAllPresets(): Promise<EQPreset[]> {
    if (typeof window === 'undefined') return [];

    try {
      const presets = this.loadFromStorage();
      return Object.values(presets);
    } catch (e) {
      console.error('Failed to load presets:', e);
      return [];
    }
  }

  private loadFromStorage(): Record<string, EQPreset> {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }
}
