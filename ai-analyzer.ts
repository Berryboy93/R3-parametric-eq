/**
 * @r3/dsp/ai/ai-analyzer
 * AI-powered frequency analysis and EQ recommendations
 */

import { AIRecommendation, AIAnalysisResult, FrequencyIssue } from '../types/index.js';

// ============================================================================
// Frequency Issue Patterns
// ============================================================================

interface IssuePattern {
  issue: FrequencyIssue;
  frequencyRange: [number, number];
  thresholdDb: number;
  description: string;
  suggestedAction: (magnitude: number) => { gain: number; q: number };
}

const ISSUE_PATTERNS: IssuePattern[] = [
  {
    issue: FrequencyIssue.Mud,
    frequencyRange: [200, 500],
    thresholdDb: 5,
    description: 'Excess energy in mud frequency range',
    suggestedAction: (mag) => ({
      gain: Math.max(-4, -1.5 * Math.abs(mag) / 10),
      q: 1.0,
    }),
  },
  {
    issue: FrequencyIssue.Masking,
    frequencyRange: [500, 2000],
    thresholdDb: 8,
    description: 'Masking in critical midrange frequencies',
    suggestedAction: (mag) => ({
      gain: Math.max(-3, -0.8 * mag / 10),
      q: 1.5,
    }),
  },
  {
    issue: FrequencyIssue.Harshness,
    frequencyRange: [5000, 8000],
    thresholdDb: 6,
    description: 'Harsh or piercing high-mid frequencies',
    suggestedAction: (mag) => ({
      gain: Math.max(-3, -1.2 * Math.abs(mag) / 10),
      q: 2.0,
    }),
  },
  {
    issue: FrequencyIssue.Boominess,
    frequencyRange: [50, 150],
    thresholdDb: 7,
    description: 'Boomy low-end resonances',
    suggestedAction: (mag) => ({
      gain: Math.max(-5, -2 * Math.abs(mag) / 10),
      q: 0.8,
    }),
  },
  {
    issue: FrequencyIssue.Sibilance,
    frequencyRange: [5000, 12000],
    thresholdDb: 5,
    description: 'Excessive sibilance or "S" sounds',
    suggestedAction: (mag) => ({
      gain: Math.max(-2.5, -0.9 * mag / 10),
      q: 1.5,
    }),
  },
  {
    issue: FrequencyIssue.LackOfPresence,
    frequencyRange: [2000, 5000],
    thresholdDb: -6,
    description: 'Lacking presence or clarity',
    suggestedAction: (mag) => ({
      gain: Math.min(4, 1.5 * Math.abs(mag) / 10),
      q: 1.2,
    }),
  },
];

// ============================================================================
// AI Analyzer Class
// ============================================================================

export class AIEQAnalyzer {
  private readonly smoothingWindow = 3; // Bins to consider for smoothing
  private readonly minConfidence = 0.5; // Minimum confidence threshold

  /**
   * Analyze spectrum and generate recommendations
   *
   * @param magnitudes - Frequency magnitude spectrum (dB)
   * @param sampleRate - Sample rate in Hz
   * @param fftSize - FFT size used for spectrum
   * @returns Analysis results with recommendations
   */
  analyzeSpectrum(
    magnitudes: Float32Array,
    sampleRate: number,
    fftSize: number
  ): AIAnalysisResult {
    const recommendations: AIRecommendation[] = [];

    // Smooth the spectrum for better analysis
    const smoothedMagnitudes = this.smoothSpectrum(magnitudes);

    // Analyze each issue pattern
    for (const pattern of ISSUE_PATTERNS) {
      const [minFreq, maxFreq] = pattern.frequencyRange;
      const minBin = this.frequencyToBin(minFreq, sampleRate, fftSize);
      const maxBin = this.frequencyToBin(maxFreq, sampleRate, fftSize);

      // Find peak in frequency range
      let peakMagnitude = -Infinity;
      let peakBin = minBin;

      for (let i = minBin; i <= maxBin && i < smoothedMagnitudes.length; i++) {
        if (smoothedMagnitudes[i] > peakMagnitude) {
          peakMagnitude = smoothedMagnitudes[i];
          peakBin = i;
        }
      }

      // Check if peak exceeds threshold
      if (peakMagnitude > pattern.thresholdDb) {
        const peakFrequency = this.binToFrequency(peakBin, sampleRate, fftSize);
        const excess = peakMagnitude - pattern.thresholdDb;
        const confidence = Math.min(1.0, excess / 10); // Normalize confidence

        if (confidence >= this.minConfidence) {
          const action = pattern.suggestedAction(peakMagnitude);

          recommendations.push({
            issue: pattern.issue,
            detectedFrequency: peakFrequency,
            confidence,
            suggestedGain: action.gain,
            suggestedQ: action.q,
            description: pattern.description,
          });
        }
      }
    }

    // Sort recommendations by confidence
    recommendations.sort((a, b) => b.confidence - a.confidence);

    return {
      recommendations: Object.freeze(recommendations) as readonly AIRecommendation[],
      timestamp: Date.now(),
      sampleRate,
    };
  }

  /**
   * Smooth spectrum using moving average
   */
  private smoothSpectrum(magnitudes: Float32Array): Float32Array {
    const smoothed = new Float32Array(magnitudes.length);
    const window = this.smoothingWindow;

    for (let i = 0; i < magnitudes.length; i++) {
      let sum = 0;
      let count = 0;

      for (let j = -window; j <= window; j++) {
        const idx = i + j;
        if (idx >= 0 && idx < magnitudes.length) {
          sum += magnitudes[idx];
          count++;
        }
      }

      smoothed[i] = sum / count;
    }

    return smoothed;
  }

  /**
   * Convert frequency to FFT bin
   */
  private frequencyToBin(frequency: number, sampleRate: number, fftSize: number): number {
    return Math.round((frequency * fftSize) / sampleRate);
  }

  /**
   * Convert FFT bin to frequency
   */
  private binToFrequency(bin: number, sampleRate: number, fftSize: number): number {
    return (bin * sampleRate) / fftSize;
  }

  /**
   * Get human-readable description of recommendation
   */
  getRecommendationDescription(rec: AIRecommendation): string {
    const gainSign = rec.suggestedGain >= 0 ? '+' : '';
    return `${rec.description} at ${rec.detectedFrequency.toFixed(0)}Hz (${gainSign}${rec.suggestedGain.toFixed(1)}dB, Q=${rec.suggestedQ.toFixed(1)})`;
  }

  /**
   * Analyze for clipping
   */
  analyzeClipping(magnitudes: Float32Array): { clipping: boolean; severity: number } {
    const maxMagnitude = Math.max(...magnitudes);
    const clipping = maxMagnitude > 0; // Above 0dB indicates clipping
    const severity = Math.max(0, maxMagnitude / 10); // Normalized severity 0-1

    return { clipping, severity: Math.min(1, severity) };
  }

  /**
   * Estimate loudness (simplified LUFS approximation)
   */
  estimateLoudness(magnitudes: Float32Array): number {
    // Simplified: average magnitude
    const sum = magnitudes.reduce((a, b) => a + b, 0);
    const average = sum / magnitudes.length;

    // Convert to dBFS
    return average;
  }

  /**
   * Detect resonances (peaks above local average)
   */
  detectResonances(
    magnitudes: Float32Array,
    sampleRate: number,
    fftSize: number,
    threshold: number = 3
  ): Array<{ frequency: number; magnitude: number; q: number }> {
    const resonances: Array<{ frequency: number; magnitude: number; q: number }> = [];
    const windowSize = 20;

    for (let i = windowSize; i < magnitudes.length - windowSize; i++) {
      let sum = 0;
      for (let j = -windowSize; j <= windowSize; j++) {
        sum += magnitudes[i + j];
      }
      const average = sum / (2 * windowSize + 1);

      if (magnitudes[i] - average > threshold) {
        const frequency = this.binToFrequency(i, sampleRate, fftSize);

        // Estimate Q from peak width
        let leftWidth = 0;
        let rightWidth = 0;

        const peakDb = magnitudes[i];
        const thresholdDb = peakDb - 3; // 3dB points

        for (let j = i - 1; j > 0 && magnitudes[j] > thresholdDb; j--) {
          leftWidth++;
        }

        for (let j = i + 1; j < magnitudes.length && magnitudes[j] > thresholdDb; j++) {
          rightWidth++;
        }

        const bw = leftWidth + rightWidth;
        const q = frequency / this.binToFrequency(bw, sampleRate, fftSize);

        resonances.push({
          frequency,
          magnitude: magnitudes[i],
          q: Math.max(0.5, Math.min(12, q)),
        });
      }
    }

    return resonances;
  }
}

/**
 * Factory function
 */
export function createAIAnalyzer(): AIEQAnalyzer {
  return new AIEQAnalyzer();
}
