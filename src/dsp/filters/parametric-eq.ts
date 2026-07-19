/**
 * @r3/dsp/filters/parametric-eq
 * Main ParametricEQ Engine - 8-band parametric equalizer
 */

import {
  FilterType,
  EQState,
  EQBand,
  FrequencyResponse,
  FrequencyResponsePoint,
} from '../types/index';
import {
  calculateBiquadCoefficients,
  processBlockBiquad,
  getMagnitudeResponse,
  getPhaseResponse,
  validateCoefficients,
  BiquadCoefficients,
  BiquadState,
} from './biquad';
import { createDefaultBand, validateBand, updateBand } from './eq-band';

const BAND_CONFIGURATION: Array<{ type: FilterType; slot: number }> = [
  { type: FilterType.HighPass, slot: 0 },
  { type: FilterType.LowShelf, slot: 1 },
  { type: FilterType.Peaking, slot: 2 },
  { type: FilterType.Peaking, slot: 3 },
  { type: FilterType.Peaking, slot: 4 },
  { type: FilterType.Peaking, slot: 5 },
  { type: FilterType.HighShelf, slot: 6 },
  { type: FilterType.LowPass, slot: 7 },
];

export class ParametricEQEngine {
  private state: EQState;
  private sampleRate: number;
  private blockSize: number;
  private coefficients: BiquadCoefficients[] = [];
  private filterStates: BiquadState[] = [];
  private outputGainLinear: number = 1.0;
  private inputGainLinear: number = 1.0;

  constructor(sampleRate: number = 44100, blockSize: number = 512) {
    this.sampleRate = sampleRate;
    this.blockSize = blockSize;
    this.state = this.createDefaultState();
    this.updateAllCoefficients();
  }

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

  getState(): Readonly<EQState> {
    return this.state;
  }

  setState(updates: Partial<EQState>): void {
    const mutableState = { ...this.state } as any;

    if (updates.inputGain !== undefined) {
      mutableState.inputGain = updates.inputGain;
      this.inputGainLinear = Math.pow(10, updates.inputGain / 20);
    }
    if (updates.outputGain !== undefined) {
      mutableState.outputGain = updates.outputGain;
      this.outputGainLinear = Math.pow(10, updates.outputGain / 20);
    }
    if (updates.bypass !== undefined) mutableState.bypass = updates.bypass;
    if (updates.analyzerEnabled !== undefined) mutableState.analyzerEnabled = updates.analyzerEnabled;
    if (updates.linearPhase !== undefined) mutableState.linearPhase = updates.linearPhase;
    if (updates.oversampling !== undefined) mutableState.oversampling = updates.oversampling;
    if (updates.autoGain !== undefined) mutableState.autoGain = updates.autoGain;

    if (updates.bands !== undefined) {
      const newBands = updates.bands.map((update, idx) => {
        const currentBand = this.state.bands[idx];
        return updateBand(currentBand, update as any);
      });
      mutableState.bands = Object.freeze(newBands) as readonly EQBand[];
    }

    this.state = mutableState as EQState;
    this.updateAllCoefficients();
  }

  updateBand(bandId: number, updates: Partial<EQBand>): void {
    const bands = this.state.bands.map((band) => {
      if (band.id === bandId) return updateBand(band, updates);
      return band;
    });
    this.setState({ bands: bands as any });
  }

  private updateAllCoefficients(): void {
    this.coefficients = [];
    this.filterStates = [];

    for (const band of this.state.bands) {
      if (!band.enabled) {
        this.coefficients.push({ b0: 1, b1: 0, b2: 0, a0: 1, a1: 0, a2: 0 });
        this.filterStates.push({ x1: 0, x2: 0, y1: 0, y2: 0 });
        continue;
      }

      const coeffs = calculateBiquadCoefficients(
        band.frequency, this.sampleRate, band.gain, band.q, band.type, band.slope
      );

      if (!validateCoefficients(coeffs)) {
        this.coefficients.push({ b0: 1, b1: 0, b2: 0, a0: 1, a1: 0, a2: 0 });
      } else {
        this.coefficients.push(coeffs);
      }
      this.filterStates.push({ x1: 0, x2: 0, y1: 0, y2: 0 });
    }
  }

  processBlock(input: Float32Array): Float32Array {
    if (this.state.bypass) return this.applyGains(input);

    let output: Float32Array = new Float32Array(input.length);
    for (let i = 0; i < input.length; i++) output[i] = input[i] * this.inputGainLinear;

    for (let bandIdx = 0; bandIdx < this.coefficients.length; bandIdx++) {
      output = processBlockBiquad(output, this.coefficients[bandIdx], this.filterStates[bandIdx]) as Float32Array;
    }

    for (let i = 0; i < output.length; i++) {
      output[i] = Math.max(-1, Math.min(1, output[i] * this.outputGainLinear));
    }
    return output;
  }

  private applyGains(input: Float32Array): Float32Array {
    const output = new Float32Array(input.length);
    const totalGain = this.inputGainLinear * this.outputGainLinear;
    for (let i = 0; i < input.length; i++) {
      output[i] = Math.max(-1, Math.min(1, input[i] * totalGain));
    }
    return output;
  }

  resetFilters(): void {
    for (const state of this.filterStates) {
      (state as any).x1 = 0; (state as any).x2 = 0;
      (state as any).y1 = 0; (state as any).y2 = 0;
    }
  }

  getFrequencyResponse(frequencies: number[]): FrequencyResponse {
    const points: FrequencyResponsePoint[] = [];
    for (const frequency of frequencies) {
      let magnitude = 0;
      let phase = 0;
      for (const coeffs of this.coefficients) {
        magnitude += getMagnitudeResponse(frequency, this.sampleRate, coeffs);
        phase += getPhaseResponse(frequency, this.sampleRate, coeffs);
      }
      magnitude += this.state.inputGain + this.state.outputGain;
      points.push({ frequency, magnitude, phase });
    }
    return {
      points: Object.freeze(points) as readonly FrequencyResponsePoint[],
      sampleRate: this.sampleRate,
      fftSize: 2048,
    };
  }

  getEQCurve(numPoints: number = 512): FrequencyResponsePoint[] {
    const minFreq = 20, maxFreq = 20000;
    const logMin = Math.log(minFreq), logMax = Math.log(maxFreq);
    const frequencies: number[] = [];
    for (let i = 0; i < numPoints; i++) {
      const t = i / (numPoints - 1);
      frequencies.push(Math.exp(logMin + t * (logMax - logMin)));
    }
    return this.getFrequencyResponse(frequencies).points as FrequencyResponsePoint[];
  }

  getMagnitudeAtFrequency(frequency: number): number {
    let magnitude = 0;
    for (const coeffs of this.coefficients) {
      magnitude += getMagnitudeResponse(frequency, this.sampleRate, coeffs);
    }
    return magnitude + this.state.inputGain + this.state.outputGain;
  }

  setSampleRate(sampleRate: number): void {
    if (sampleRate === this.sampleRate) return;
    this.sampleRate = sampleRate;
    this.resetFilters();
    this.updateAllCoefficients();
  }

  getSampleRate(): number { return this.sampleRate; }

  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    for (const band of this.state.bands) {
      const result = validateBand(band);
      if (!result.valid) errors.push(...result.errors);
    }
    return { valid: errors.length === 0, errors };
  }
}

export function createParametricEQ(sampleRate = 44100, blockSize = 512): ParametricEQEngine {
  return new ParametricEQEngine(sampleRate, blockSize);
}
