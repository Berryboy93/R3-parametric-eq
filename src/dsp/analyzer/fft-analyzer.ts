/**
 * @r3/dsp/analyzer/fft-analyzer
 * Real-time FFT-based spectrum analyzer
 */

import { AnalyzerData, AnalyzerFFTSize } from '../types/index';

interface Complex { real: number; imag: number; }

export function createBlackmanHarrisWindow(size: number): Float32Array {
  const window = new Float32Array(size);
  const a0 = 0.35875, a1 = 0.48829, a2 = 0.14128, a3 = 0.01168;
  for (let n = 0; n < size; n++) {
    const t = (2 * Math.PI * n) / (size - 1);
    window[n] = a0 - a1 * Math.cos(t) + a2 * Math.cos(2 * t) - a3 * Math.cos(3 * t);
  }
  return window;
}

export function createHannWindow(size: number): Float32Array {
  const window = new Float32Array(size);
  for (let n = 0; n < size; n++) window[n] = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (size - 1)));
  return window;
}

export function createHammingWindow(size: number): Float32Array {
  const window = new Float32Array(size);
  for (let n = 0; n < size; n++) window[n] = 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (size - 1));
  return window;
}

export class FFTAnalyzer {
  private fftSize: AnalyzerFFTSize;
  private window: Float32Array;
  private inputBuffer: Float32Array;
  private writeIndex: number = 0;
  private fftBuffer: Complex[] = [];
  private magnitudeBuffer: Float32Array;
  private phaseBuffer: Float32Array;
  private peakHoldBuffer: Float32Array;
  private peakHoldDecayRate: number = 0.95;
  private sampleRate: number;

  constructor(sampleRate = 44100, fftSize: AnalyzerFFTSize = AnalyzerFFTSize.Size2048) {
    this.sampleRate = sampleRate;
    this.fftSize = fftSize;
    this.inputBuffer = new Float32Array(fftSize);
    this.magnitudeBuffer = new Float32Array(fftSize / 2);
    this.phaseBuffer = new Float32Array(fftSize / 2);
    this.peakHoldBuffer = new Float32Array(fftSize / 2);
    this.window = createBlackmanHarrisWindow(fftSize);
    this.initializeFftBuffer();
  }

  pushSamples(samples: Float32Array): boolean {
    const samplesNeeded = this.fftSize - this.writeIndex;
    const samplesToWrite = Math.min(samples.length, samplesNeeded);
    this.inputBuffer.set(samples.subarray(0, samplesToWrite), this.writeIndex);
    this.writeIndex += samplesToWrite;
    if (this.writeIndex >= this.fftSize) {
      this.performFFT();
      this.writeIndex = 0;
      this.inputBuffer.set(this.inputBuffer.subarray(this.fftSize / 2));
      this.writeIndex = this.fftSize / 2;
      return true;
    }
    return false;
  }

  private performFFT(): void {
    for (let i = 0; i < this.fftSize; i++) {
      this.fftBuffer[i] = { real: this.inputBuffer[i] * this.window[i], imag: 0 };
    }
    this.fft(this.fftBuffer);
    for (let i = 0; i < this.fftSize / 2; i++) {
      const { real, imag } = this.fftBuffer[i];
      const magnitude = Math.sqrt(real * real + imag * imag);
      const magnitude_dB = 20 * Math.log10(Math.max(magnitude, 1e-6));
      this.magnitudeBuffer[i] = magnitude_dB;
      this.phaseBuffer[i] = Math.atan2(imag, real);
      if (magnitude_dB > this.peakHoldBuffer[i]) {
        this.peakHoldBuffer[i] = magnitude_dB;
      } else {
        this.peakHoldBuffer[i] *= this.peakHoldDecayRate;
      }
    }
  }

  private fft(buffer: Complex[]): void {
    const N = buffer.length;
    for (let i = 0; i < N; i++) {
      const j = this.reverseBits(i, Math.log2(N));
      if (i < j) { const temp = buffer[i]; buffer[i] = buffer[j]; buffer[j] = temp; }
    }
    for (let stage = 0; stage < Math.log2(N); stage++) {
      const stageSize = Math.pow(2, stage);
      const groupSize = stageSize * 2;
      for (let group = 0; group < N; group += groupSize) {
        for (let pair = 0; pair < stageSize; pair++) {
          const angle = (-2 * Math.PI * pair) / groupSize;
          const cos = Math.cos(angle), sin = Math.sin(angle);
          const ei = group + pair, oi = group + pair + stageSize;
          const even = buffer[ei], odd = buffer[oi];
          const tr = odd.real * cos - odd.imag * sin;
          const ti = odd.real * sin + odd.imag * cos;
          buffer[ei].real = even.real + tr; buffer[ei].imag = even.imag + ti;
          buffer[oi].real = even.real - tr; buffer[oi].imag = even.imag - ti;
        }
      }
    }
  }

  private reverseBits(value: number, bits: number): number {
    let result = 0;
    for (let i = 0; i < bits; i++) { result = (result << 1) | (value & 1); value >>= 1; }
    return result;
  }

  private initializeFftBuffer(): void {
    this.fftBuffer = new Array(this.fftSize);
    for (let i = 0; i < this.fftSize; i++) this.fftBuffer[i] = { real: 0, imag: 0 };
  }

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

  getMagnitudes(): Float32Array { return this.magnitudeBuffer.slice(); }
  getPeakHold(): Float32Array { return this.peakHoldBuffer.slice(); }
  getFrequencyForBin(bin: number): number { return (bin * this.sampleRate) / this.fftSize; }
  getBinForFrequency(freq: number): number { return Math.round((freq * this.fftSize) / this.sampleRate); }

  reset(): void {
    this.inputBuffer.fill(0); this.magnitudeBuffer.fill(0);
    this.phaseBuffer.fill(0); this.peakHoldBuffer.fill(-Infinity); this.writeIndex = 0;
  }

  getFFTSize(): AnalyzerFFTSize { return this.fftSize; }
  setPeakHoldDecayRate(rate: number): void { this.peakHoldDecayRate = Math.max(0.5, Math.min(0.99, rate)); }
}

export class StereoAnalyzer {
  private leftAnalyzer: FFTAnalyzer;
  private rightAnalyzer: FFTAnalyzer;

  constructor(sampleRate = 44100, fftSize: AnalyzerFFTSize = AnalyzerFFTSize.Size2048) {
    this.leftAnalyzer = new FFTAnalyzer(sampleRate, fftSize);
    this.rightAnalyzer = new FFTAnalyzer(sampleRate, fftSize);
  }

  pushStereoSamples(left: Float32Array, right: Float32Array): boolean {
    return this.leftAnalyzer.pushSamples(left) && this.rightAnalyzer.pushSamples(right);
  }

  getLeftAnalysis(): AnalyzerData { return this.leftAnalyzer.getAnalysisData(); }
  getRightAnalysis(): AnalyzerData { return this.rightAnalyzer.getAnalysisData(); }
  reset(): void { this.leftAnalyzer.reset(); this.rightAnalyzer.reset(); }
}
