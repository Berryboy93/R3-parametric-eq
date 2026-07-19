/**
 * @r3/dsp/filters/eq-band
 * Single EQ band state management and validation
 */

import { EQBand, FilterType, ButterworthSlope } from '../types/index.js';
import { calculateBiquadCoefficients, resetFilterState, BiquadState } from './biquad.js';

// ============================================================================
// Constants
// ============================================================================

const FREQUENCY_MIN = 20;
const FREQUENCY_MAX = 20000;
const GAIN_MIN = -24;
const GAIN_MAX = 24;
const Q_MIN = 0.1;
const Q_MAX = 24;

// ============================================================================
// Band Factories and Builders
// ============================================================================

/**
 * Create a default EQ band configuration
 */
export function createDefaultBand(id: number, type: FilterType): EQBand {
  const defaults: Record<FilterType, Partial<EQBand>> = {
    [FilterType.HighPass]: {
      frequency: 80,
      gain: 0,
      q: 0.7,
      slope: ButterworthSlope.Slope24dB,
    },
    [FilterType.LowShelf]: {
      frequency: 100,
      gain: 0,
      q: 0.7,
    },
    [FilterType.Peaking]: {
      frequency: 1000,
      gain: 0,
      q: 1.0,
    },
    [FilterType.HighShelf]: {
      frequency: 10000,
      gain: 0,
      q: 0.7,
    },
    [FilterType.LowPass]: {
      frequency: 18000,
      gain: 0,
      q: 0.7,
      slope: ButterworthSlope.Slope24dB,
    },
  };

  const config = defaults[type];
  return {
    id,
    enabled: true,
    type,
    frequency: config.frequency ?? 1000,
    gain: config.gain ?? 0,
    q: config.q ?? 1.0,
    slope: config.slope,
  };
}

/**
 * Create an exact copy of a band (immutable)
 */
export function cloneBand(band: EQBand): EQBand {
  return { ...band };
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate frequency parameter
 * Must be within 20-20000 Hz
 */
export function validateFrequency(freq: number): boolean {
  return Number.isFinite(freq) && freq >= FREQUENCY_MIN && freq <= FREQUENCY_MAX;
}

/**
 * Validate gain parameter
 * Must be within -24 to +24 dB
 */
export function validateGain(gain: number): boolean {
  return Number.isFinite(gain) && gain >= GAIN_MIN && gain <= GAIN_MAX;
}

/**
 * Validate Q parameter
 * Must be within 0.1 to 24
 */
export function validateQ(q: number): boolean {
  return Number.isFinite(q) && q >= Q_MIN && q <= Q_MAX;
}

/**
 * Validate entire band configuration
 */
export function validateBand(band: EQBand): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!Number.isInteger(band.id) || band.id < 0) {
    errors.push(`Invalid band ID: ${band.id}`);
  }

  if (typeof band.enabled !== 'boolean') {
    errors.push(`Band enabled must be boolean, got: ${typeof band.enabled}`);
  }

  if (!Object.values(FilterType).includes(band.type)) {
    errors.push(`Invalid filter type: ${band.type}`);
  }

  if (!validateFrequency(band.frequency)) {
    errors.push(
      `Frequency out of range: ${band.frequency} (expected ${FREQUENCY_MIN}-${FREQUENCY_MAX} Hz)`
    );
  }

  if (!validateGain(band.gain)) {
    errors.push(
      `Gain out of range: ${band.gain} (expected ${GAIN_MIN} to ${GAIN_MAX} dB)`
    );
  }

  if (!validateQ(band.q)) {
    errors.push(`Q out of range: ${band.q} (expected ${Q_MIN}-${Q_MAX})`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Band Update Operations
// ============================================================================

/**
 * Update band frequency with validation and clamping
 */
export function setBandFrequency(band: EQBand, frequency: number): EQBand {
  const clamped = Math.max(FREQUENCY_MIN, Math.min(FREQUENCY_MAX, frequency));

  if (band.frequency === clamped) {
    return band; // No change, return same reference
  }

  return { ...band, frequency: clamped };
}

/**
 * Update band gain with validation and clamping
 */
export function setBandGain(band: EQBand, gain: number): EQBand {
  const clamped = Math.max(GAIN_MIN, Math.min(GAIN_MAX, gain));

  if (band.gain === clamped) {
    return band;
  }

  return { ...band, gain: clamped };
}

/**
 * Update band Q with validation and clamping
 */
export function setBandQ(band: EQBand, q: number): EQBand {
  const clamped = Math.max(Q_MIN, Math.min(Q_MAX, q));

  if (band.q === clamped) {
    return band;
  }

  return { ...band, q: clamped };
}

/**
 * Update band enabled state
 */
export function setBandEnabled(band: EQBand, enabled: boolean): EQBand {
  if (band.enabled === enabled) {
    return band;
  }

  return { ...band, enabled };
}

/**
 * Reset band to factory defaults for its type
 */
export function resetBand(band: EQBand): EQBand {
  return createDefaultBand(band.id, band.type);
}

/**
 * Update multiple band parameters at once
 */
export function updateBand(band: EQBand, updates: Partial<EQBand>): EQBand {
  let result = band;

  if (updates.frequency !== undefined && updates.frequency !== band.frequency) {
    result = setBandFrequency(result, updates.frequency);
  }

  if (updates.gain !== undefined && updates.gain !== result.gain) {
    result = setBandGain(result, updates.gain);
  }

  if (updates.q !== undefined && updates.q !== result.q) {
    result = setBandQ(result, updates.q);
  }

  if (updates.enabled !== undefined && updates.enabled !== result.enabled) {
    result = setBandEnabled(result, updates.enabled);
  }

  if (updates.type !== undefined && updates.type !== result.type) {
    result = { ...result, type: updates.type };
  }

  if (updates.slope !== undefined && updates.slope !== result.slope) {
    result = { ...result, slope: updates.slope };
  }

  return result;
}

// ============================================================================
// Filter State Management
// ============================================================================

export class BandFilterState {
  private state: BiquadState = { x1: 0, x2: 0, y1: 0, y2: 0 };

  getState(): BiquadState {
    return { ...this.state };
  }

  setState(state: BiquadState): void {
    this.state = { ...state };
  }

  reset(): void {
    resetFilterState(this.state);
  }

  /**
   * Get mutable reference for performance-critical code
   * Should only be used within DSP processing thread
   */
  getMutableState(): BiquadState {
    return this.state;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get suggested frequency range for a band type
 */
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

/**
 * Get human-readable name for band type
 */
export function getFilterTypeName(type: FilterType): string {
  const names: Record<FilterType, string> = {
    [FilterType.HighPass]: 'High Pass',
    [FilterType.LowShelf]: 'Low Shelf',
    [FilterType.Peaking]: 'Peaking',
    [FilterType.HighShelf]: 'High Shelf',
    [FilterType.LowPass]: 'Low Pass',
  };

  return names[type];
}

/**
 * Get suggested Q values based on filter type
 */
export function getSuggestedQRange(type: FilterType): [number, number] {
  switch (type) {
    case FilterType.HighPass:
    case FilterType.LowPass:
      return [0.5, 2];
    case FilterType.LowShelf:
    case FilterType.HighShelf:
      return [0.5, 2];
    case FilterType.Peaking:
      return [0.1, 12];
    default:
      return [0.1, 12];
  }
}
