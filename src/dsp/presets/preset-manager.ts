/**
 * @r3/dsp/presets/preset-manager
 * EQ preset management — factory presets match PRD Appendix D exactly
 */

import { EQPreset, EQState, PresetMetadata } from '../types/index';
import { FilterType } from '../types/index';

export function validatePreset(preset: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (typeof preset !== 'object' || preset === null) return { valid: false, errors: ['Preset must be an object'] };
  const p = preset as Record<string, unknown>;
  if (typeof p.id !== 'string' || !/^[a-z0-9-]+$/.test(p.id)) errors.push('Invalid preset ID (must match /^[a-z0-9-]+$/)');
  if (typeof p.name !== 'string' || !p.name || p.name.length > 100) errors.push('Invalid or missing preset name (max 100 chars)');
  if (typeof p.category !== 'string' || !p.category) errors.push('Invalid or missing preset category');
  if (typeof p.description !== 'string' || p.description.length > 500) errors.push('Invalid preset description (max 500 chars)');
  if (!Array.isArray(p.tags) || (p.tags as unknown[]).length > 20) errors.push('Invalid preset tags (max 20)');
  if (typeof p.createdAt !== 'number' || p.createdAt <= 0) errors.push('Invalid preset createdAt');
  if (typeof p.updatedAt !== 'number' || p.updatedAt <= 0) errors.push('Invalid preset updatedAt');
  return { valid: errors.length === 0, errors };
}

/** Build a full 8-band state with sensible defaults; pass only the bands you want active */
function makeState(
  active: Array<{ id: number; type: FilterType; freq: number; gain: number; q: number }>,
  opts: Partial<{ inputGain: number; outputGain: number; linearPhase: boolean }> = {}
): EQState {
  const defaultBands: Array<{ id: number; type: FilterType; freq: number; q: number }> = [
    { id: 0, type: FilterType.HighPass,  freq: 80,    q: 0.70 },
    { id: 1, type: FilterType.LowShelf,  freq: 100,   q: 0.70 },
    { id: 2, type: FilterType.Peaking,   freq: 300,   q: 1.00 },
    { id: 3, type: FilterType.Peaking,   freq: 1000,  q: 1.00 },
    { id: 4, type: FilterType.Peaking,   freq: 3000,  q: 1.00 },
    { id: 5, type: FilterType.Peaking,   freq: 6000,  q: 1.00 },
    { id: 6, type: FilterType.HighShelf, freq: 10000, q: 0.70 },
    { id: 7, type: FilterType.LowPass,   freq: 18000, q: 0.70 },
  ];
  const bands = defaultBands.map(def => {
    const override = active.find(a => a.id === def.id);
    if (override) {
      return { id: def.id, enabled: true, type: override.type, frequency: override.freq, gain: override.gain, q: override.q };
    }
    return { id: def.id, enabled: false, type: def.type, frequency: def.freq, gain: 0, q: def.q };
  });
  return {
    inputGain: opts.inputGain ?? 0,
    outputGain: opts.outputGain ?? 0,
    bypass: false,
    analyzerEnabled: true,
    linearPhase: opts.linearPhase ?? false,
    oversampling: false,
    autoGain: false,
    bands: bands as EQState['bands'],
  };
}

export function createFactoryPresets(): Map<string, EQPreset> {
  const presets = new Map<string, EQPreset>();
  const now = Date.now();

  // ── Flat (reference) ────────────────────────────────────────────────────────
  presets.set('flat', {
    id: 'flat', name: 'Flat', category: 'Reference',
    description: 'Flat response — no processing. Use as a clean starting point.',
    tags: ['flat', 'reference', 'neutral'],
    isFactory: true,
    state: makeState([]),
    createdAt: now, updatedAt: now,
  });

  // ── Vocal Clarity ───────────────────────────────────────────────────────────
  // PRD: HP@80Hz, Cut 350Hz -4dB, Boost 3.5kHz +3dB, De-ess 6.5kHz
  presets.set('vocal-clarity', {
    id: 'vocal-clarity', name: 'Vocal Clarity', category: 'Vocal',
    description: 'Lead vocals & voiceovers. HP removes rumble, cuts mud, boosts presence, de-esses harshness.',
    tags: ['vocal', 'clarity', 'presence', 'de-ess'],
    isFactory: true,
    state: makeState([
      { id: 0, type: FilterType.HighPass,  freq: 80,   gain: 0,   q: 0.70 },
      { id: 2, type: FilterType.Peaking,   freq: 350,  gain: -4,  q: 1.20 },
      { id: 4, type: FilterType.Peaking,   freq: 3500, gain: 3,   q: 1.50 },
      { id: 5, type: FilterType.Peaking,   freq: 6500, gain: -2,  q: 2.00 },
    ]),
    createdAt: now, updatedAt: now,
  });

  // ── Podcast Pro ─────────────────────────────────────────────────────────────
  // PRD: HP@100Hz, Cut 300Hz -5dB, Boost 2.5kHz +4dB
  presets.set('podcast-pro', {
    id: 'podcast-pro', name: 'Podcast Pro', category: 'Voice',
    description: 'Spoken word & broadcasting. Clean HP, reduce boxiness, boost intelligibility.',
    tags: ['podcast', 'speech', 'voice', 'broadcast'],
    isFactory: true,
    state: makeState([
      { id: 0, type: FilterType.HighPass,  freq: 100,  gain: 0,   q: 0.70 },
      { id: 2, type: FilterType.Peaking,   freq: 300,  gain: -5,  q: 1.00 },
      { id: 4, type: FilterType.Peaking,   freq: 2500, gain: 4,   q: 1.20 },
    ]),
    createdAt: now, updatedAt: now,
  });

  // ── Hip-Hop Heavy ───────────────────────────────────────────────────────────
  // PRD: Boost 100Hz +6dB, Boost 250Hz +3dB, Boost 10kHz +4dB
  presets.set('hip-hop-heavy', {
    id: 'hip-hop-heavy', name: 'Hip-Hop Heavy', category: 'Music',
    description: 'Hip-hop, trap & electronic. Heavy sub-bass boost, warm low-mids, crisp air.',
    tags: ['hip-hop', 'trap', 'bass', 'electronic'],
    isFactory: true,
    state: makeState([
      { id: 1, type: FilterType.LowShelf,  freq: 100,   gain: 6,  q: 0.70 },
      { id: 2, type: FilterType.Peaking,   freq: 250,   gain: 3,  q: 1.00 },
      { id: 6, type: FilterType.HighShelf, freq: 10000, gain: 4,  q: 0.70 },
    ]),
    createdAt: now, updatedAt: now,
  });

  // ── Mastering Reference ─────────────────────────────────────────────────────
  // PRD: Subtle ±1dB adjustments, linear phase
  presets.set('mastering-reference', {
    id: 'mastering-reference', name: 'Mastering Reference', category: 'Mastering',
    description: 'Transparent mastering. Subtle ±1dB high-frequency tilt for air and clarity.',
    tags: ['mastering', 'reference', 'linear-phase', 'transparent'],
    isFactory: true,
    state: makeState([
      { id: 1, type: FilterType.LowShelf,  freq: 80,    gain: -1, q: 0.70 },
      { id: 6, type: FilterType.HighShelf, freq: 12000, gain: 1,  q: 0.70 },
    ], { linearPhase: true }),
    createdAt: now, updatedAt: now,
  });

  // ── Acoustic Warmth ─────────────────────────────────────────────────────────
  // PRD: Boost 150Hz +2dB, Cut 300Hz -3dB, Boost 2.5kHz +3dB
  presets.set('acoustic-warmth', {
    id: 'acoustic-warmth', name: 'Acoustic Warmth', category: 'Instrument',
    description: 'Acoustic guitar, piano & strings. Add body, remove boxiness, enhance pick attack.',
    tags: ['acoustic', 'guitar', 'piano', 'warmth', 'instrument'],
    isFactory: true,
    state: makeState([
      { id: 2, type: FilterType.Peaking,   freq: 150,  gain: 2,  q: 0.80 },
      { id: 3, type: FilterType.Peaking,   freq: 300,  gain: -3, q: 1.20 },
      { id: 4, type: FilterType.Peaking,   freq: 2500, gain: 3,  q: 1.50 },
    ]),
    createdAt: now, updatedAt: now,
  });

  return presets;
}

// ── Storage ───────────────────────────────────────────────────────────────────

export interface PresetStorage {
  savePreset(preset: EQPreset): Promise<void>;
  deletePreset(id: string): Promise<void>;
  loadAllPresets(): Promise<EQPreset[]>;
}

export class LocalStoragePresetStorage implements PresetStorage {
  private readonly KEY = 'r3-native-eq-presets-v1';

  async savePreset(preset: EQPreset): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const all = this._load();
      all[preset.id] = preset;
      localStorage.setItem(this.KEY, JSON.stringify(all));
    } catch (e) { console.error('R3: failed to save preset', e); }
  }

  async deletePreset(id: string): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const all = this._load();
      delete all[id];
      localStorage.setItem(this.KEY, JSON.stringify(all));
    } catch (e) { console.error('R3: failed to delete preset', e); }
  }

  async loadAllPresets(): Promise<EQPreset[]> {
    if (typeof window === 'undefined') return [];
    try { return Object.values(this._load()); } catch { return []; }
  }

  private _load(): Record<string, EQPreset> {
    try {
      const raw = localStorage.getItem(this.KEY);
      return raw ? (JSON.parse(raw) as Record<string, EQPreset>) : {};
    } catch { return {}; }
  }
}

// ── PresetManager ──────────────────────────────────────────────────────────────

export class PresetManager {
  private presets: Map<string, EQPreset>;
  readonly storage: PresetStorage;

  constructor(storage?: PresetStorage) {
    this.presets = createFactoryPresets();
    this.storage = storage ?? new LocalStoragePresetStorage();
  }

  /** Load user presets from storage and merge with factory presets */
  async init(): Promise<void> {
    const saved = await this.storage.loadAllPresets();
    for (const p of saved) {
      if (!this.presets.has(p.id)) this.presets.set(p.id, p);
    }
  }

  createPreset(name: string, state: EQState, category = 'Custom', description = '', tags: string[] = []): EQPreset {
    const id = this._genId(name);
    const now = Date.now();
    const preset: EQPreset = { id, name: name.slice(0, 100), category, description: description.slice(0, 500), tags: tags.slice(0, 20), state, isFactory: false, createdAt: now, updatedAt: now };
    this.presets.set(id, preset);
    this.storage.savePreset(preset);
    return preset;
  }

  getPreset(id: string): EQPreset | null { return this.presets.get(id) ?? null; }
  getAllPresets(): EQPreset[] { return Array.from(this.presets.values()); }
  getFactoryPresets(): EQPreset[] { return this.getAllPresets().filter(p => p.isFactory); }
  getUserPresets(): EQPreset[] { return this.getAllPresets().filter(p => !p.isFactory); }
  getPresetsByCategory(cat: string): EQPreset[] { return this.getAllPresets().filter(p => p.category === cat); }
  getCategories(): string[] { return [...new Set(this.getAllPresets().map(p => p.category))].sort(); }

  deletePreset(id: string): boolean {
    const p = this.presets.get(id);
    if (!p || p.isFactory) return false;
    this.presets.delete(id);
    this.storage.deletePreset(id);
    return true;
  }

  search(query: string): EQPreset[] {
    const q = query.toLowerCase();
    return this.getAllPresets().filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  exportPreset(id: string): string | null {
    const p = this.presets.get(id);
    return p ? JSON.stringify(p, null, 2) : null;
  }

  importPreset(json: string): { preset: EQPreset | null; errors: string[] } {
    try {
      const obj = JSON.parse(json) as unknown;
      const v = validatePreset(obj);
      if (!v.valid) return { preset: null, errors: v.errors };
      const p = { ...(obj as EQPreset), isFactory: false, updatedAt: Date.now() };
      this.presets.set(p.id, p);
      this.storage.savePreset(p);
      return { preset: p, errors: [] };
    } catch { return { preset: null, errors: ['Invalid JSON'] }; }
  }

  getPresetMetadata(): PresetMetadata[] {
    return this.getAllPresets().map(p => ({ id: p.id, name: p.name, category: p.category, tags: p.tags }));
  }

  private _genId(name: string): string {
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'preset';
    let id = base, i = 1;
    while (this.presets.has(id)) { id = `${base}-${i++}`; }
    return id;
  }
}
