/**
 * @r3/dsp/analyzer/fft-analyzer
 * Real-time FFT-based spectrum analyzer
 * Supports windowing, peak-hold, and stereo/mid-side modes
 */

import { AnalyzerData, AnalyzerFFTSize } from '../types/index.js';

// ============================================================================
// Window Functions
// ============================================================================

/**
 * Blackman-Harris window (high dynamic range, low spectral leakage)
 * Suitable for precise frequency analysis
 */
export function createBlackmanHarrisWindow(size: number): Float32Array {
  const window = new Float32Array(size);
  const a0 = 0.35875;
  const a1 = 0.48829;
  const a2 = 0.14128;
  const a3 = 0.01168;

  for (let n = 0; n < size; n++) {
    const t = (2 * Math.PI * n) / (size - 1);
    window[n] = a0 - a1 * Math.cos(t) + a2 * Math.cos(2 * t) - a3 * Math.cos(3 * t);
  }

  return window;
}

/**
 * Hann window (smooth transition, moderate spectral leakage)
 */
export function createHannWindow(size: number): Float32Array {
  const window = new Float32Array(size);
  for (let n = 0; n < size; n++) {
    window[n] = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (size - 1)));
  }
  return window;
}

/**
 * Hamming window (fixed sidelobe level)
 */
export function createHammingWindow(size: number): Float32Array {
  const window = new Float32Array(size);
  for (let n = 0; n < size; n++) {
    window[n] = 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (size - 1));
  }
  return window;
}

// ============================================================================
// FFT Analyzer Class
// ============================================================================

export class FFTAnalyzer {
  private fftSize: AnalyzerFFTSize;
  private window: Float32Array;
  private inputBuffer: Float32Array;
  private writeIndex: number = 0;
  private fftBuffer: Complex[] = [];
  private magnitudeBuffer: Float32Array;
  private phaseBuffer: Float32Array;
  private peakHoldBuffer: Float32Array;
  private peakHoldDecayRate: number = 0.95; // Per frame
  private sampleRate: number;

  constructor(
    sampleRate: number = 44100,
    fftSize: AnalyzerFFTSize = AnalyzerFFTSize.Size2048
  ) {
    this.sampleRate = sampleRate;
    this.fftSize = fftSize;

    // Initialize buffers
    this.inputBuffer = new Float32Array(fftSize);
    this.magnitudeBuffer = new Float32Array(fftSize / 2);
    this.phaseBuffer = new Float32Array(fftSize / 2);
    this.peakHoldBuffer = new Float32Array(fftSize / 2);

    // Initialize window function (Blackman-Harris for low spectral leakage)
    this.window = createBlackmanHarrisWindow(fftSize);

    // Initialize FFT buffer
    this.initializeBitReversalTable();
  }

  /**
   * Push audio samples into the analyzer
   * Returns true when a complete frame is ready for analysis
   */
  pushSamples(samples: Float32Array): boolean {
    const samplesNeeded = this.fftSize - this.writeIndex;
    const samplesToWrite = Math.min(samples.length, samplesNeeded);

    this.inputBuffer.set(samples.subarray(0, samplesToWrite), this.writeIndex);
    this.writeIndex += samplesToWrite;

    if (this.writeIndex >= this.fftSize) {
      this.performFFT();
      this.writeIndex = 0;

      // 50% overlap
      this.inputBuffer.set(this.inputBuffer.subarray(this.fftSize / 2));
      this.writeIndex = this.fftSize / 2;

      return true;
    }

    return false;
  }

  /**
   * Perform FFT on windowed input buffer
   */
  private performFFT(): void {
    // Apply window function
    for (let i = 0; i < this.fftSize; i++) {
      this.fftBuffer[i] = {
        real: this.inputBuffer[i] * this.window[i],
        imag: 0,
      };
    }

    // Perform Cooley-Tukey FFT
    this.fft(this.fftBuffer);

    // Calculate magnitude and phase
    for (let i = 0; i < this.fftSize / 2; i++) {
      const real = this.fftBuffer[i].real;
      const imag = this.fftBuffer[i].imag;

      // Magnitude in dB
      const magnitude = Math.sqrt(real * real + imag * imag);
      const magnitude_dB = 20 * Math.log10(Math.max(magnitude, 1e-6));

      this.magnitudeBuffer[i] = magnitude_dB;
      this.phaseBuffer[i] = Math.atan2(imag, real);

      // Update peak hold
      if (magnitude_dB > this.peakHoldBuffer[i]) {
        this.peakHoldBuffer[i] = magnitude_dB;
      } else {
        this.peakHoldBuffer[i] *= this.peakHoldDecayRate;
      }
    }
  }

  /**
   * Cooley-Tukey FFT algorithm
   * Requires fftSize to be power of 2
   */
  private fft(buffer: Complex[]): void {
    const N = buffer.length;

    // Bit reversal
    for (let i = 0; i < N; i++) {
      const j = this.reverseBits(i, Math.log2(N));
      if (i < j) {
        const temp = buffer[i];
        buffer[i] = buffer[j];
        buffer[j] = temp;
      }
    }

    // Butterfly operations
    for (let stage = 0; stage < Math.log2(N); stage++) {
      const stageSize = Math.pow(2, stage);
      const groupSize = stageSize * 2;

      for (let group = 0; group < N; group += groupSize) {
        for (let pair = 0; pair < stageSize; pair++) {
          const angle = (-2 * Math.PI * pair) / groupSize;
          const cosTwiddle = Math.cos(angle);
          const sinTwiddle = Math.sin(angle);

          const evenIdx = group + pair;
          const oddIdx = group + pair + stageSize;

          const even = buffer[evenIdx];
          const odd = buffer[oddIdx];

          // Twiddle factor multiplication
          const twiddledReal = odd.real * cosTwiddle - odd.imag * sinTwiddle;
          const twiddledImag = odd.real * sinTwiddle + odd.imag * cosTwiddle;

          // Butterfly
          buffer[evenIdx].real = even.real + twiddledReal;
          buffer[evenIdx].imag = even.imag + twiddledImag;
          buffer[oddIdx].real = even.real - twiddledReal;
          buffer[oddIdx].imag = even.imag - twiddledImag;
        }
      }
    }
  }

  /**
   * Reverse bits for FFT bit-reversal stage
   */
  private reverseBits(value: number, bits: number): number {
    let result = 0;
    for (let i = 0; i < bits; i++) {
      result = (result << 1) | (value & 1);
      value >>= 1;
    }
    return result;
  }

  /**
   * Bit reversal table initialization (not currently used but useful for optimization)
   */
  private initializeBitReversalTable(): void {
    const N = this.fftSize;
    this.fftBuffer = new Array(N);
    for (let i = 0; i < N; i++) {
      this.fftBuffer[i] = { real: 0, imag: 0 };
    }
  }

  /**
   * Get current analysis results
   */
  getAnalysisData(): AnalyzerData {
    return {
      frequencies: this.magnitudeBuffer.slice(),
      magnitudes: this.magnitudeBuffer.slice(),
      phases: this.phaseBuffer.slice(),
      timestamp: Date.now(),
      fftSize: this.fftSize,
      sampleRate: this.sampleRate,
    };
  }

  /**
   * Get magnitude spectrum
   */
  getMagnitudes(): Float32Array {
    return this.magnitudeBuffer.slice();
  }

  /**
   * Get peak-hold spectrum
   */
  getPeakHold(): Float32Array {
    return this.peakHoldBuffer.slice();
  }

  /**
   * Get frequency at bin index
   */
  getFrequencyForBin(binIndex: number): number {
    return (binIndex * this.sampleRate) / this.fftSize;
  }

  /**
   * Get bin index for frequency
   */
  getBinForFrequency(frequency: number): number {
    return Math.round((frequency * this.fftSize) / this.sampleRate);
  }

  /**
   * Reset all buffers
   */
  reset(): void {
    this.inputBuffer.fill(0);
    this.magnitudeBuffer.fill(0);
    this.phaseBuffer.fill(0);
    this.peakHoldBuffer.fill(-Infinity);
    this.writeIndex = 0;
  }

  /**
   * Set FFT size (reinitializes buffers)
   */
  setFFTSize(fftSize: AnalyzerFFTSize): void {
    if (fftSize === this.fftSize) {
      return;
    }

    this.fftSize = fftSize;
    this.inputBuffer = new Float32Array(fftSize);
    this.magnitudeBuffer = new Float32Array(fftSize / 2);
    this.phaseBuffer = new Float32Array(fftSize / 2);
    this.peakHoldBuffer = new Float32Array(fftSize / 2);
    this.window = createBlackmanHarrisWindow(fftSize);
    this.initializeBitReversalTable();
    this.reset();
  }

  /**
   * Get FFT size
   */
  getFFTSize(): AnalyzerFFTSize {
    return this.fftSize;
  }

  /**
   * Set peak hold decay rate (0-1, lower = faster decay)
   */
  setPeakHoldDecayRate(rate: number): void {
    this.peakHoldDecayRate = Math.max(0.5, Math.min(0.99, rate));
  }
}

// ============================================================================
// Complex Number Support
// ============================================================================

interface Complex {
  real: number;
  imag: number;
}

/**
 * Stereo Analyzer - Analyzes left and right channels separately
 */
export class StereoAnalyzer {
  private leftAnalyzer: FFTAnalyzer;
  private rightAnalyzer: FFTAnalyzer;

  constructor(sampleRate: number = 44100, fftSize: AnalyzerFFTSize = AnalyzerFFTSize.Size2048) {
    this.leftAnalyzer = new FFTAnalyzer(sampleRate, fftSize);
    this.rightAnalyzer = new FFTAnalyzer(sampleRate, fftSize);
  }

  pushStereoSamples(left: Float32Array, right: Float32Array): boolean {
    const leftReady = this.leftAnalyzer.pushSamples(left);
    const rightReady = this.rightAnalyzer.pushSamples(right);
    return leftReady && rightReady;
  }

  getLeftAnalysis(): AnalyzerData {
    return this.leftAnalyzer.getAnalysisData();
  }

  getRightAnalysis(): AnalyzerData {
    return this.rightAnalyzer.getAnalysisData();
  }

  /**
   * Get mid/side analysis
   * Mid = (L + R) / 2
   * Side = (L - R) / 2
   */
  getMidSideAnalysis(): { mid: AnalyzerData; side: AnalyzerData } {
    const left = this.leftAnalyzer.getMagnitudes();
    const right = this.rightAnalyzer.getMagnitudes();

    const mid = new Float32Array(left.length);
    const side = new Float32Array(left.length);

    for (let i = 0; i < left.length; i++) {
      const l = left[i];
      const r = right[i];
      mid[i] = (l + r) / 2;
      side[i] = (l - r) / 2;
    }

    return {
      mid: { ...this.leftAnalyzer.getAnalysisData(), magnitudes: mid },
      side: { ...this.rightAnalyzer.getAnalysisData(), magnitudes: side },
    };
  }

  reset(): void {
    this.leftAnalyzer.reset();
    this.rightAnalyzer.reset();
  }
}
