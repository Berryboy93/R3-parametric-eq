/**
 * @r3/dsp/filters/parametric-eq
 * Main ParametricEQ Engine - 8-band parametric equalizer
 * Processes audio through Web Audio API or offline processing
 */

import {
  FilterType,
  EQState,
  EQBand,
  ButterworthSlope,
  ProcessingOptions,
  FrequencyResponse,
  FrequencyResponsePoint,
} from '../types/index.js';
import {
  calculateBiquadCoefficients,
  processBlockBiquad,
  getMagnitudeResponse,
  getPhaseResponse,
  validateCoefficients,
  BiquadCoefficients,
  BiquadState,
} from './biquad.js';
import { createDefaultBand, validateBand, updateBand } from './eq-band.js';

// ============================================================================
// EQ Engine Configuration
// ============================================================================

const BAND_CONFIGURATION: Array<{ type: FilterType; slot: number }> = [
  { type: FilterType.HighPass, slot: 0 }, // 20-200 Hz - removes rumble
  { type: FilterType.LowShelf, slot: 1 }, // 20-250 Hz - bass shaping
  { type: FilterType.Peaking, slot: 2 }, // 200-500 Hz - mud reduction
  { type: FilterType.Peaking, slot: 3 }, // 500Hz-2kHz - mid control
  { type: FilterType.Peaking, slot: 4 }, // 2-5kHz - presence
  { type: FilterType.Peaking, slot: 5 }, // 5-8kHz - harshness
  { type: FilterType.HighShelf, slot: 6 }, // 8-20kHz - air/shimmer
  { type: FilterType.LowPass, slot: 7 }, // 10-20kHz - hiss removal
];

// ============================================================================
// ParametricEQ Engine Class
// ============================================================================

export class ParametricEQEngine {
  private state: EQState;
  private sampleRate: number;
  private blockSize: number;
  private coefficients: BiquadCoefficients[] = [];
  private filterStates: BiquadState[] = [];
  private outputGainLinear: number = 1.0;
  private inputGainLinear: number = 1.0;
  private readonly maxCoefficientsCache = 100;
  private coefficientsCache = new Map<string, BiquadCoefficients>();

  constructor(sampleRate: number = 44100, blockSize: number = 512) {
    this.sampleRate = sampleRate;
    this.blockSize = blockSize;

    // Initialize default 8-band configuration
    this.state = this.createDefaultState();

    // Initialize filter coefficients and states
    this.updateAllCoefficients();
  }

  /**
   * Create default state with 8 bands
   */
  private createDefaultState(): EQState {
    const bands = BAND_CONFIGURATION.map((config) =>
      createDefaultBand(config.slot, config.type)
    );

    return {
      inputGain: 0,
      outputGain: 0,
      bypass: false,
      analyzerEnabled: true,
      linearPhase: false,
      oversampling: false,
      autoGain: false,
      bands: Object.freeze(bands) as readonly EQBand[],
    };
  }

  /**
   * Get current engine state (immutable)
   */
  getState(): Readonly<EQState> {
    return this.state;
  }

  /**
   * Update engine state
   * Triggers coefficient recalculation if needed
   */
  setState(updates: Partial<EQState>): void {
    let changed = false;

    // Update primitive fields
    if (updates.inputGain !== undefined && updates.inputGain !== this.state.inputGain) {
      (this.state as any).inputGain = updates.inputGain;
      this.inputGainLinear = Math.pow(10, updates.inputGain / 20);
      changed = true;
    }

    if (updates.outputGain !== undefined && updates.outputGain !== this.state.outputGain) {
      (this.state as any).outputGain = updates.outputGain;
      this.outputGainLinear = Math.pow(10, updates.outputGain / 20);
      changed = true;
    }

    if (updates.bypass !== undefined && updates.bypass !== this.state.bypass) {
      (this.state as any).bypass = updates.bypass;
      changed = true;
    }

    if (updates.analyzerEnabled !== undefined && updates.analyzerEnabled !== this.state.analyzerEnabled) {
      (this.state as any).analyzerEnabled = updates.analyzerEnabled;
    }

    if (updates.linearPhase !== undefined && updates.linearPhase !== this.state.linearPhase) {
      (this.state as any).linearPhase = updates.linearPhase;
    }

    if (updates.oversampling !== undefined && updates.oversampling !== this.state.oversampling) {
      (this.state as any).oversampling = updates.oversampling;
    }

    if (updates.autoGain !== undefined && updates.autoGain !== this.state.autoGain) {
      (this.state as any).autoGain = updates.autoGain;
    }

    // Update bands if provided
    if (updates.bands !== undefined) {
      const newBands = updates.bands.map((update, idx) => {
        const currentBand = this.state.bands[idx];
        return updateBand(currentBand, update as any);
      });

      (this.state as any).bands = Object.freeze(newBands) as readonly EQBand[];
      this.updateAllCoefficients();
      changed = true;
    }

    if (changed) {
      this.clearCoefficientsCache();
    }
  }

  /**
   * Update single band
   */
  updateBand(bandId: number, updates: Partial<EQBand>): void {
    const bands = this.state.bands.map((band) => {
      if (band.id === bandId) {
        return updateBand(band, updates);
      }
      return band;
    });

    this.setState({ bands: bands as any });
  }

  /**
   * Recalculate all filter coefficients based on current state
   */
  private updateAllCoefficients(): void {
    this.coefficients = [];
    this.filterStates = [];

    for (const band of this.state.bands) {
      if (!band.enabled) {
        // Bypass disabled bands
        this.coefficients.push({
          b0: 1,
          b1: 0,
          b2: 0,
          a0: 1,
          a1: 0,
          a2: 0,
        });
        this.filterStates.push({ x1: 0, x2: 0, y1: 0, y2: 0 });
        continue;
      }

      const coeffs = calculateBiquadCoefficients(
        band.frequency,
        this.sampleRate,
        band.gain,
        band.q,
        band.type,
        band.slope
      );

      if (!validateCoefficients(coeffs)) {
        console.error(`Invalid coefficients calculated for band ${band.id}:`, coeffs);
        // Fall back to bypass
        this.coefficients.push({
          b0: 1,
          b1: 0,
          b2: 0,
          a0: 1,
          a1: 0,
          a2: 0,
        });
      } else {
        this.coefficients.push(coeffs);
      }

      this.filterStates.push({ x1: 0, x2: 0, y1: 0, y2: 0 });
    }
  }

  /**
   * Process audio block (primary processing method)
   * Operates on Float32Array for performance
   *
   * @param input - Input audio samples
   * @returns Processed output samples
   */
  processBlock(input: Float32Array): Float32Array {
    if (this.state.bypass) {
      // Apply only gain
      return this.applyGains(input);
    }

    let output = new Float32Array(input.length);

    // Apply input gain
    for (let i = 0; i < input.length; i++) {
      output[i] = input[i] * this.inputGainLinear;
    }

    // Apply each filter band in series
    for (let bandIdx = 0; bandIdx < this.coefficients.length; bandIdx++) {
      const coeffs = this.coefficients[bandIdx];
      const state = this.filterStates[bandIdx];

      output = processBlockBiquad(output, coeffs, state);
    }

    // Apply output gain and limiting
    for (let i = 0; i < output.length; i++) {
      output[i] = Math.max(-1, Math.min(1, output[i] * this.outputGainLinear));
    }

    return output;
  }

  /**
   * Process multi-channel audio
   *
   * @param inputs - Array of channel data
   * @returns Processed channel data
   */
  processChannels(inputs: Float32Array[]): Float32Array[] {
    return inputs.map((channel) => this.processBlock(channel));
  }

  /**
   * Apply gains without filtering
   */
  private applyGains(input: Float32Array): Float32Array {
    const output = new Float32Array(input.length);
    const totalGain = this.inputGainLinear * this.outputGainLinear;

    for (let i = 0; i < input.length; i++) {
      output[i] = Math.max(-1, Math.min(1, input[i] * totalGain));
    }

    return output;
  }

  /**
   * Reset all filter states (clearing history)
   */
  resetFilters(): void {
    for (const state of this.filterStates) {
      (state as any).x1 = 0;
      (state as any).x2 = 0;
      (state as any).y1 = 0;
      (state as any).y2 = 0;
    }
  }

  /**
   * Get frequency response curve (computed or cached)
   *
   * @param frequencies - Array of frequencies to analyze
   * @returns Frequency response data
   */
  getFrequencyResponse(frequencies: number[]): FrequencyResponse {
    const points: FrequencyResponsePoint[] = [];

    for (const frequency of frequencies) {
      let magnitude = 0; // dB
      let phase = 0; // radians

      // Accumulate response from all bands
      for (const coeffs of this.coefficients) {
        magnitude += getMagnitudeResponse(frequency, this.sampleRate, coeffs);
        phase += getPhaseResponse(frequency, this.sampleRate, coeffs);
      }

      // Add gain
      magnitude += this.state.inputGain + this.state.outputGain;

      points.push({ frequency, magnitude, phase });
    }

    return {
      points: Object.freeze(points) as readonly FrequencyResponsePoint[],
      sampleRate: this.sampleRate,
      fftSize: 2048,
    };
  }

  /**
   * Get combined EQ curve for UI rendering
   */
  getEQCurve(numPoints: number = 512): FrequencyResponsePoint[] {
    // Logarithmic frequency spacing
    const minFreq = 20;
    const maxFreq = 20000;
    const logMin = Math.log(minFreq);
    const logMax = Math.log(maxFreq);

    const frequencies: number[] = [];
    for (let i = 0; i < numPoints; i++) {
      const t = i / (numPoints - 1);
      frequencies.push(Math.exp(logMin + t * (logMax - logMin)));
    }

    return this.getFrequencyResponse(frequencies).points as FrequencyResponsePoint[];
  }

  /**
   * Get magnitude response at a single frequency (cached)
   */
  getMagnitudeAtFrequency(frequency: number): number {
    const cacheKey = `${frequency}`;

    if (this.coefficientsCache.has(cacheKey)) {
      return getMagnitudeResponse(
        frequency,
        this.sampleRate,
        this.coefficientsCache.get(cacheKey)!
      );
    }

    let magnitude = 0;
    for (const coeffs of this.coefficients) {
      magnitude += getMagnitudeResponse(frequency, this.sampleRate, coeffs);
    }

    magnitude += this.state.inputGain + this.state.outputGain;
    return magnitude;
  }

  /**
   * Set sample rate (recalculates coefficients)
   */
  setSampleRate(sampleRate: number): void {
    if (sampleRate === this.sampleRate) {
      return;
    }

    this.sampleRate = sampleRate;
    this.resetFilters();
    this.updateAllCoefficients();
    this.clearCoefficientsCache();
  }

  /**
   * Get current sample rate
   */
  getSampleRate(): number {
    return this.sampleRate;
  }

  /**
   * Clear coefficient cache
   */
  private clearCoefficientsCache(): void {
    this.coefficientsCache.clear();
  }

  /**
   * Get processing latency in samples
   * Biquad filters have minimal latency
   */
  getLatency(): number {
    return 0; // Direct Form II has no group delay
  }

  /**
   * Validate entire engine configuration
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const band of this.state.bands) {
      const result = validateBand(band);
      if (!result.valid) {
        errors.push(...result.errors);
      }
    }

    if (!Number.isFinite(this.state.inputGain) || Math.abs(this.state.inputGain) > 96) {
      errors.push(`Invalid input gain: ${this.state.inputGain}`);
    }

    if (!Number.isFinite(this.state.outputGain) || Math.abs(this.state.outputGain) > 96) {
      errors.push(`Invalid output gain: ${this.state.outputGain}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Factory function to create a new ParametricEQ engine
 */
export function createParametricEQ(
  sampleRate: number = 44100,
  blockSize: number = 512
): ParametricEQEngine {
  return new ParametricEQEngine(sampleRate, blockSize);
}
