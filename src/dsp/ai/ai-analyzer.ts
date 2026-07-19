/**
 * @r3/dsp/ai/ai-analyzer
 * AI-powered frequency analysis and EQ recommendations
 */

import { AIRecommendation, AIAnalysisResult, FrequencyIssue } from '../types/index';

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
    suggestedAction: (mag) => ({ gain: Math.max(-4, -1.5 * Math.abs(mag) / 10), q: 1.0 }),
  },
  {
    issue: FrequencyIssue.Harshness,
    frequencyRange: [5000, 8000],
    thresholdDb: 6,
    description: 'Harsh or piercing high-mid frequencies',
    suggestedAction: (mag) => ({ gain: Math.max(-3, -1.2 * Math.abs(mag) / 10), q: 2.0 }),
  },
  {
    issue: FrequencyIssue.Boominess,
    frequencyRange: [50, 150],
    thresholdDb: 7,
    description: 'Boomy low-end resonances',
    suggestedAction: (mag) => ({ gain: Math.max(-5, -2 * Math.abs(mag) / 10), q: 0.8 }),
  },
  {
    issue: FrequencyIssue.Sibilance,
    frequencyRange: [5000, 12000],
    thresholdDb: 5,
    description: 'Excessive sibilance or "S" sounds',
    suggestedAction: (mag) => ({ gain: Math.max(-2.5, -0.9 * mag / 10), q: 1.5 }),
  },
];

export class AIEQAnalyzer {
  private readonly smoothingWindow = 3;
  private readonly minConfidence = 0.5;

  analyzeSpectrum(magnitudes: Float32Array, sampleRate: number, fftSize: number): AIAnalysisResult {
    const recommendations: AIRecommendation[] = [];
    const smoothed = this.smoothSpectrum(magnitudes);

    for (const pattern of ISSUE_PATTERNS) {
      const [minFreq, maxFreq] = pattern.frequencyRange;
      const minBin = this.frequencyToBin(minFreq, sampleRate, fftSize);
      const maxBin = this.frequencyToBin(maxFreq, sampleRate, fftSize);

      let peakMagnitude = -Infinity, peakBin = minBin;
      for (let i = minBin; i <= maxBin && i < smoothed.length; i++) {
        if (smoothed[i] > peakMagnitude) { peakMagnitude = smoothed[i]; peakBin = i; }
      }

      if (peakMagnitude > pattern.thresholdDb) {
        const peakFrequency = this.binToFrequency(peakBin, sampleRate, fftSize);
        const confidence = Math.min(1.0, (peakMagnitude - pattern.thresholdDb) / 10);
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

    recommendations.sort((a, b) => b.confidence - a.confidence);
    return { recommendations: Object.freeze(recommendations) as readonly AIRecommendation[], timestamp: Date.now(), sampleRate };
  }

  private smoothSpectrum(magnitudes: Float32Array): Float32Array {
    const smoothed = new Float32Array(magnitudes.length);
    const w = this.smoothingWindow;
    for (let i = 0; i < magnitudes.length; i++) {
      let sum = 0, count = 0;
      for (let j = -w; j <= w; j++) {
        const idx = i + j;
        if (idx >= 0 && idx < magnitudes.length) { sum += magnitudes[idx]; count++; }
      }
      smoothed[i] = sum / count;
    }
    return smoothed;
  }

  private frequencyToBin(freq: number, sampleRate: number, fftSize: number): number {
    return Math.round((freq * fftSize) / sampleRate);
  }

  private binToFrequency(bin: number, sampleRate: number, fftSize: number): number {
    return (bin * sampleRate) / fftSize;
  }

  getRecommendationDescription(rec: AIRecommendation): string {
    const sign = rec.suggestedGain >= 0 ? '+' : '';
    return `${rec.description} at ${rec.detectedFrequency.toFixed(0)}Hz (${sign}${rec.suggestedGain.toFixed(1)}dB)`;
  }
}

export function createAIAnalyzer(): AIEQAnalyzer { return new AIEQAnalyzer(); }
