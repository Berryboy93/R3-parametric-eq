/**
 * @r3/dsp/filters/eq-band
 * Single EQ band state management and validation
 */

import { EQBand, FilterType, ButterworthSlope } from '../types/index';

const FREQUENCY_MIN = 20;
const FREQUENCY_MAX = 20000;
const GAIN_MIN = -24;
const GAIN_MAX = 24;
const Q_MIN = 0.1;
const Q_MAX = 24;

export function createDefaultBand(id: number, type: FilterType): EQBand {
  const defaults: Record<FilterType, Partial<EQBand>> = {
    [FilterType.HighPass]: { frequency: 80, gain: 0, q: 0.7, slope: ButterworthSlope.Slope24dB },
    [FilterType.LowShelf]: { frequency: 100, gain: 0, q: 0.7 },
    [FilterType.Peaking]: { frequency: 1000, gain: 0, q: 1.0 },
    [FilterType.HighShelf]: { frequency: 10000, gain: 0, q: 0.7 },
    [FilterType.LowPass]: { frequency: 18000, gain: 0, q: 0.7, slope: ButterworthSlope.Slope24dB },
  };
  const config = defaults[type];
  return { id, enabled: true, type, frequency: config.frequency ?? 1000, gain: config.gain ?? 0, q: config.q ?? 1.0, slope: config.slope };
}

export function cloneBand(band: EQBand): EQBand { return { ...band }; }

export function validateFrequency(freq: number): boolean {
  return Number.isFinite(freq) && freq >= FREQUENCY_MIN && freq <= FREQUENCY_MAX;
}
export function validateGain(gain: number): boolean {
  return Number.isFinite(gain) && gain >= GAIN_MIN && gain <= GAIN_MAX;
}
export function validateQ(q: number): boolean {
  return Number.isFinite(q) && q >= Q_MIN && q <= Q_MAX;
}
export function validateBand(band: EQBand): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!validateFrequency(band.frequency)) errors.push(`Frequency out of range: ${band.frequency}`);
  if (!validateGain(band.gain)) errors.push(`Gain out of range: ${band.gain}`);
  if (!validateQ(band.q)) errors.push(`Q out of range: ${band.q}`);
  return { valid: errors.length === 0, errors };
}

export function setBandFrequency(band: EQBand, frequency: number): EQBand {
  return { ...band, frequency: Math.max(FREQUENCY_MIN, Math.min(FREQUENCY_MAX, frequency)) };
}
export function setBandGain(band: EQBand, gain: number): EQBand {
  return { ...band, gain: Math.max(GAIN_MIN, Math.min(GAIN_MAX, gain)) };
}
export function setBandQ(band: EQBand, q: number): EQBand {
  return { ...band, q: Math.max(Q_MIN, Math.min(Q_MAX, q)) };
}
export function setBandEnabled(band: EQBand, enabled: boolean): EQBand { return { ...band, enabled }; }
export function resetBand(band: EQBand): EQBand { return createDefaultBand(band.id, band.type); }
export function updateBand(band: EQBand, updates: Partial<EQBand>): EQBand { return { ...band, ...updates, id: band.id }; }

export function getSuggestedFrequencyRange(type: FilterType): [number, number] {
  const ranges: Record<FilterType, [number, number]> = {
    [FilterType.HighPass]: [20, 200],
    [FilterType.LowShelf]: [20, 250],
    [FilterType.Peaking]: [200, 15000],
    [FilterType.HighShelf]: [2000, 20000],
    [FilterType.LowPass]: [10000, 20000],
  };
  return ranges[type];
}

export function getFilterTypeName(type: FilterType): string {
  const names: Record<FilterType, string> = {
    [FilterType.HighPass]: 'HP',
    [FilterType.LowShelf]: 'LS',
    [FilterType.Peaking]: 'PK',
    [FilterType.HighShelf]: 'HS',
    [FilterType.LowPass]: 'LP',
  };
  return names[type];
}

export function getFilterTypeFullName(type: FilterType): string {
  const names: Record<FilterType, string> = {
    [FilterType.HighPass]: 'High Pass',
    [FilterType.LowShelf]: 'Low Shelf',
    [FilterType.Peaking]: 'Peaking',
    [FilterType.HighShelf]: 'High Shelf',
    [FilterType.LowPass]: 'Low Pass',
  };
  return names[type];
}

export function getSuggestedQRange(type: FilterType): [number, number] {
  switch (type) {
    case FilterType.HighPass:
    case FilterType.LowPass:
    case FilterType.LowShelf:
    case FilterType.HighShelf:
      return [0.5, 2];
    default:
      return [0.1, 12];
  }
}
