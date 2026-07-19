/**
 * @r3/dsp/filters/biquad
 * Biquad filter coefficient calculation and sample processing
 * Based on RBJ Audio EQ Cookbook formulations
 */

import {
  BiquadCoefficients,
  BiquadState,
  FilterType,
  ButterworthSlope,
} from '../types/index';

export type { BiquadCoefficients, BiquadState };

const EPSILON = 1e-9;
const TWO_PI = Math.PI * 2;

export function calculateBiquadCoefficients(
  frequency: number,
  sampleRate: number,
  gain: number,
  q: number,
  filterType: FilterType,
  slope?: ButterworthSlope
): BiquadCoefficients {
  const clampedFreq = Math.max(20, Math.min(20000, frequency));
  const clampedQ = Math.max(0.1, Math.min(24, q));
  const clampedGain = Math.max(-24, Math.min(24, gain));

  const w0 = TWO_PI * clampedFreq / sampleRate;
  const cosW0 = Math.cos(w0);
  const sinW0 = Math.sin(w0);

  let alpha: number;
  if (slope !== undefined && (filterType === FilterType.HighPass || filterType === FilterType.LowPass)) {
    const n = slope / 12;
    alpha = sinW0 / (2 * Math.sin(Math.PI / (2 * n)));
  } else {
    alpha = sinW0 / (2 * clampedQ);
  }

  const A = Math.pow(10, clampedGain / 40);

  let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;

  switch (filterType) {
    case FilterType.HighPass: {
      b0 = (1 + cosW0) / 2;
      b1 = -(1 + cosW0);
      b2 = (1 + cosW0) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cosW0;
      a2 = 1 - alpha;
      break;
    }
    case FilterType.LowPass: {
      b0 = (1 - cosW0) / 2;
      b1 = 1 - cosW0;
      b2 = (1 - cosW0) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cosW0;
      a2 = 1 - alpha;
      break;
    }
    case FilterType.Peaking: {
      b0 = 1 + alpha * A;
      b1 = -2 * cosW0;
      b2 = 1 - alpha * A;
      a0 = 1 + alpha / A;
      a1 = -2 * cosW0;
      a2 = 1 - alpha / A;
      break;
    }
    case FilterType.LowShelf: {
      const S = 2 * Math.sqrt(A) * alpha;
      b0 = A * ((A + 1) - (A - 1) * cosW0 + S);
      b1 = 2 * A * ((A - 1) - (A + 1) * cosW0);
      b2 = A * ((A + 1) - (A - 1) * cosW0 - S);
      a0 = (A + 1) + (A - 1) * cosW0 + S;
      a1 = -2 * ((A - 1) + (A + 1) * cosW0);
      a2 = (A + 1) + (A - 1) * cosW0 - S;
      break;
    }
    case FilterType.HighShelf: {
      const S = 2 * Math.sqrt(A) * alpha;
      b0 = A * ((A + 1) + (A - 1) * cosW0 + S);
      b1 = -2 * A * ((A - 1) + (A + 1) * cosW0);
      b2 = A * ((A + 1) + (A - 1) * cosW0 - S);
      a0 = (A + 1) - (A - 1) * cosW0 + S;
      a1 = 2 * ((A - 1) - (A + 1) * cosW0);
      a2 = (A + 1) - (A - 1) * cosW0 - S;
      break;
    }
    default: {
      b0 = 1; b1 = 0; b2 = 0;
      a0 = 1; a1 = 0; a2 = 0;
    }
  }

  const norm = a0 + EPSILON;
  return {
    b0: b0 / norm,
    b1: b1 / norm,
    b2: b2 / norm,
    a0: 1,
    a1: a1 / norm,
    a2: a2 / norm,
  };
}

export function processSampleBiquad(
  input: number,
  coeffs: BiquadCoefficients,
  state: BiquadState
): { output: number; newState: BiquadState } {
  const { b0, b1, b2, a1, a2 } = coeffs;
  const { x1, x2, y1, y2 } = state;
  const output = b0 * input + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
  return { output, newState: { x1: input, x2: x1, y1: output, y2: y1 } };
}

export function processBlockBiquad(
  input: Float32Array,
  coeffs: BiquadCoefficients,
  state: BiquadState
): Float32Array {
  const output = new Float32Array(input.length);
  const { b0, b1, b2, a1, a2 } = coeffs;
  let x1 = state.x1, x2 = state.x2, y1 = state.y1, y2 = state.y2;

  for (let i = 0; i < input.length; i++) {
    const x = input[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    output[i] = y;
    x2 = x1; x1 = x;
    y2 = y1; y1 = y;
  }

  (state as any).x1 = x1; (state as any).x2 = x2;
  (state as any).y1 = y1; (state as any).y2 = y2;
  return output;
}

export function validateCoefficients(coeffs: BiquadCoefficients): boolean {
  return [coeffs.b0, coeffs.b1, coeffs.b2, coeffs.a0, coeffs.a1, coeffs.a2]
    .every(v => Number.isFinite(v) && !Number.isNaN(v));
}

export function resetFilterState(): BiquadState {
  return { x1: 0, x2: 0, y1: 0, y2: 0 };
}

export function getMagnitudeResponse(
  frequency: number,
  sampleRate: number,
  coefficients: BiquadCoefficients
): number {
  const { b0, b1, b2, a1, a2 } = coefficients;
  const w = (TWO_PI * frequency) / sampleRate;
  const cosW = Math.cos(w);
  const cos2W = Math.cos(2 * w);

  const numerator =
    b0 * b0 + b1 * b1 + b2 * b2 +
    2 * b0 * b1 * cosW +
    2 * b0 * b2 * cos2W +
    2 * b1 * b2 * cosW;

  const denominator =
    1 + a1 * a1 + a2 * a2 +
    2 * a1 * (1 + a2) * cosW +
    2 * a2 * cos2W;

  const magnitude = Math.sqrt(Math.max(0, numerator / Math.max(denominator, EPSILON)));
  return 20 * Math.log10(Math.max(magnitude, 1e-6));
}

export function getPhaseResponse(
  frequency: number,
  sampleRate: number,
  coefficients: BiquadCoefficients
): number {
  const { b0, b1, b2, a1, a2 } = coefficients;
  const w = (TWO_PI * frequency) / sampleRate;

  const nr = b0 + b1 * Math.cos(w) + b2 * Math.cos(2 * w);
  const ni = b1 * Math.sin(w) + b2 * Math.sin(2 * w);
  const dr = 1 + a1 * Math.cos(w) + a2 * Math.cos(2 * w);
  const di = a1 * Math.sin(w) + a2 * Math.sin(2 * w);

  const mag_sq = dr * dr + di * di;
  const real = (nr * dr + ni * di) / mag_sq;
  const imag = (ni * dr - nr * di) / mag_sq;
  return Math.atan2(imag, real);
}
