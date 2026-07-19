/**
 * @r3/dsp/filters/biquad
 * Biquad filter coefficient calculation and sample processing
 * Based on RBJ Audio EQ Cookbook formulations
 * Reference: https://www.w3.org/TR/webaudio/#biquadfilter-algorithms
 */

import {
  BiquadCoefficients,
  BiquadState,
  FilterType,
  ButterworthSlope,
} from '../types/index.js';

// ============================================================================
// Constants
// ============================================================================

const EPSILON = 1e-9; // Prevent division by zero
const TWO_PI = Math.PI * 2;

// ============================================================================
// Coefficient Calculation
// ============================================================================

/**
 * Calculate biquad coefficients using RBJ Audio EQ Cookbook formulas
 * Maintains numerical stability for all supported frequency ranges
 *
 * @param frequency - Filter frequency in Hz (20-20000)
 * @param sampleRate - Sample rate in Hz (44100-192000)
 * @param gain - Gain in dB (-24 to +24, unused for highpass/lowpass)
 * @param q - Q factor (0.1 to 24)
 * @param filterType - The type of filter to calculate
 * @returns Normalized biquad coefficients {b0, b1, b2, a0, a1, a2}
 */
export function calculateBiquadCoefficients(
  frequency: number,
  sampleRate: number,
  gain: number,
  q: number,
  filterType: FilterType,
  slope?: ButterworthSlope
): BiquadCoefficients {
  // Clamp inputs to valid ranges
  const clampedFreq = Math.max(20, Math.min(20000, frequency));
  const clampedQ = Math.max(0.1, Math.min(24, q));
  const clampedGain = Math.max(-24, Math.min(24, gain));

  // Normalize frequency
  const w0 = TWO_PI * clampedFreq / sampleRate;
  const cosW0 = Math.cos(w0);
  const sinW0 = Math.sin(w0);

  // Calculate alpha based on Q or slope
  let alpha: number;
  if (slope !== undefined && (filterType === FilterType.HighPass || filterType === FilterType.LowPass)) {
    // Butterworth slope: convert to Q equivalent
    // For nth-order filter: Q = sin(w0) / (2 * sin(π / (2n)))
    const n = slope / 12; // Number of poles
    alpha = sinW0 / (2 * Math.sin(Math.PI / (2 * n)));
  } else {
    // Standard Q-based alpha
    alpha = sinW0 / (2 * clampedQ);
  }

  // Calculate A (used for peaking, shelf filters)
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
      const S = 2 * Math.sqrt(A) * alpha; // Shelf slope
      const sqrtA = Math.sqrt(A);
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

    default:
      throw new Error(`Unknown filter type: ${filterType}`);
  }

  // Normalize by a0
  const a0Safe = Math.abs(a0) > EPSILON ? a0 : EPSILON;
  return {
    b0: b0 / a0Safe,
    b1: b1 / a0Safe,
    b2: b2 / a0Safe,
    a0: 1, // Normalized
    a1: a1 / a0Safe,
    a2: a2 / a0Safe,
  };
}

// ============================================================================
// Sample Processing
// ============================================================================

/**
 * Process a single sample through a biquad filter
 * Direct Form II transposed (numerically stable)
 *
 * y[n] = b0*x[n] + state.y1
 * state.y1 = b1*x[n] - a1*y[n] + state.y2
 * state.y2 = b2*x[n] - a2*y[n]
 *
 * @param sample - Input sample value
 * @param coefficients - Biquad coefficients
 * @param state - Filter state (maintains history)
 * @returns Filtered sample value
 */
export function processSampleBiquad(
  sample: number,
  coefficients: BiquadCoefficients,
  state: BiquadState
): number {
  const { b0, b1, b2, a1, a2 } = coefficients;
  const { y1, y2 } = state;

  // Direct Form II Transposed
  const output = b0 * sample + y1;

  // Update state (mutates state object)
  // This is intentional - state must be mutable for performance
  (state as any).y1 = b1 * sample - a1 * output + y2;
  (state as any).y2 = b2 * sample - a2 * output;

  return output;
}

/**
 * Process a block of samples (vectorized for performance)
 *
 * @param samples - Input sample array
 * @param coefficients - Biquad coefficients
 * @param state - Filter state
 * @returns Output samples
 */
export function processBlockBiquad(
  samples: Float32Array,
  coefficients: BiquadCoefficients,
  state: BiquadState
): Float32Array {
  const output = new Float32Array(samples.length);

  for (let i = 0; i < samples.length; i++) {
    output[i] = processSampleBiquad(samples[i], coefficients, state);
  }

  return output;
}

/**
 * Validate that coefficients are numerically stable
 * Checks for NaN, Infinity, and extreme values
 *
 * @param coeffs - Coefficients to validate
 * @returns true if coefficients are safe to use
 */
export function validateCoefficients(coeffs: BiquadCoefficients): boolean {
  const values = [coeffs.b0, coeffs.b1, coeffs.b2, coeffs.a1, coeffs.a2];

  for (const val of values) {
    if (!isFinite(val)) {
      return false;
    }
    if (Math.abs(val) > 1e6) {
      return false;
    }
  }

  return true;
}

/**
 * Reset filter state to zero
 *
 * @param state - State object to reset
 */
export function resetFilterState(state: BiquadState): void {
  (state as any).x1 = 0;
  (state as any).x2 = 0;
  (state as any).y1 = 0;
  (state as any).y2 = 0;
}

// ============================================================================
// Frequency Response Calculation
// ============================================================================

/**
 * Calculate magnitude response at a specific frequency
 *
 * H(ω) = sqrt((b0² + b1² + b2² + 2*b0*b1*cos(ω) + 2*b0*b2*cos(2ω) + 2*b1*b2*cos(ω)) /
 *            (1 + a1² + a2² + 2*a1*cos(ω) + 2*a1*a2*cos(ω) + 2*a2*cos(2ω)))
 *
 * @param frequency - Frequency in Hz
 * @param sampleRate - Sample rate in Hz
 * @param coefficients - Biquad coefficients
 * @returns Magnitude in dB
 */
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
    b0 * b0 +
    b1 * b1 +
    b2 * b2 +
    2 * b0 * b1 * cosW +
    2 * b0 * b2 * cos2W +
    2 * b1 * b2 * cosW;

  const denominator =
    1 +
    a1 * a1 +
    a2 * a2 +
    2 * a1 * (1 + a2) * cosW +
    2 * a2 * cos2W;

  const magnitude = Math.sqrt(numerator / denominator);

  // Convert to dB (20 * log10)
  return 20 * Math.log10(Math.max(magnitude, 1e-6));
}

/**
 * Calculate phase response at a specific frequency
 *
 * @param frequency - Frequency in Hz
 * @param sampleRate - Sample rate in Hz
 * @param coefficients - Biquad coefficients
 * @returns Phase in radians (-π to π)
 */
export function getPhaseResponse(
  frequency: number,
  sampleRate: number,
  coefficients: BiquadCoefficients
): number {
  const { b0, b1, b2, a1, a2 } = coefficients;

  const w = (TWO_PI * frequency) / sampleRate;

  const numerator_real = b0 + b1 * Math.cos(w) + b2 * Math.cos(2 * w);
  const numerator_imag = b1 * Math.sin(w) + b2 * Math.sin(2 * w);

  const denominator_real = 1 + a1 * Math.cos(w) + a2 * Math.cos(2 * w);
  const denominator_imag = a1 * Math.sin(w) + a2 * Math.sin(2 * w);

  // Complex division: (a + bi) / (c + di)
  const mag_sq = denominator_real * denominator_real + denominator_imag * denominator_imag;
  const real =
    (numerator_real * denominator_real + numerator_imag * denominator_imag) / mag_sq;
  const imag =
    (numerator_imag * denominator_real - numerator_real * denominator_imag) / mag_sq;

  return Math.atan2(imag, real);
}
