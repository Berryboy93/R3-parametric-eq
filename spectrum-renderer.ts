/**
 * @r3/ui/canvas/spectrum-renderer
 * High-performance spectrum visualization with Canvas 2D
 */

import type { AnalyzerData, FrequencyResponsePoint } from '@r3/dsp';

// ============================================================================
// Constants
// ============================================================================

const COLORS = {
  background: '#080808',
  gridLight: 'rgba(255, 255, 255, 0.06)',
  gridMid: 'rgba(255, 255, 255, 0.1)',
  spectrumGradient: ['#0066ff', '#00ff00', '#ffff00', '#ff6600', '#ff0000'],
  eqCurve: '#B7FF00',
  eqCurveGlow: 'rgba(183, 255, 0, 0.4)',
  text: '#E6E6E6',
  textMuted: '#999999',
};

const FREQUENCIES_LOG = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];

// ============================================================================
// Spectrum Renderer
// ============================================================================

export class SpectrumRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private minFreq = 20;
  private maxFreq = 20000;
  private minDb = -60;
  private maxDb = 12;
  private pixelRatio = window.devicePixelRatio || 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }
    this.ctx = ctx;
    this.width = canvas.width / this.pixelRatio;
    this.height = canvas.height / this.pixelRatio;

    // High-DPI setup
    canvas.width = this.width * this.pixelRatio;
    canvas.height = this.height * this.pixelRatio;
    this.ctx.scale(this.pixelRatio, this.pixelRatio);
  }

  /**
   * Render complete spectrum visualization
   */
  render(
    analyzerData: AnalyzerData,
    eqCurve: FrequencyResponsePoint[],
    peakHoldData?: Float32Array
  ): void {
    this.clear();
    this.drawGrid();
    this.drawSpectrum(analyzerData);
    if (peakHoldData) {
      this.drawPeakHold(peakHoldData, analyzerData);
    }
    this.drawEQCurve(eqCurve);
    this.drawLabels();
  }

  /**
   * Clear canvas
   */
  private clear(): void {
    this.ctx.fillStyle = COLORS.background;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  /**
   * Draw frequency and gain grid
   */
  private drawGrid(): void {
    const padding = { left: 40, right: 20, top: 20, bottom: 40 };
    const graphWidth = this.width - padding.left - padding.right;
    const graphHeight = this.height - padding.top - padding.bottom;
    const graphX = padding.left;
    const graphY = padding.top;

    // Vertical lines (frequency)
    this.ctx.strokeStyle = COLORS.gridLight;
    this.ctx.lineWidth = 1;

    for (const freq of FREQUENCIES_LOG) {
      const x = graphX + this.freqToPixels(freq, graphWidth);
      this.ctx.beginPath();
      this.ctx.moveTo(x, graphY);
      this.ctx.lineTo(x, graphY + graphHeight);
      this.ctx.stroke();
    }

    // Horizontal lines (gain)
    for (let db = -60; db <= 12; db += 6) {
      const y = graphY + this.dbToPixels(db, graphHeight);
      this.ctx.strokeStyle = db === 0 ? COLORS.gridMid : COLORS.gridLight;
      this.ctx.lineWidth = db === 0 ? 1.5 : 1;
      this.ctx.beginPath();
      this.ctx.moveTo(graphX, y);
      this.ctx.lineTo(graphX + graphWidth, y);
      this.ctx.stroke();
    }

    // Border
    this.ctx.strokeStyle = COLORS.gridMid;
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(graphX, graphY, graphWidth, graphHeight);
  }

  /**
   * Draw spectrum magnitude
   */
  private drawSpectrum(analyzerData: AnalyzerData): void {
    const padding = { left: 40, right: 20, top: 20, bottom: 40 };
    const graphWidth = this.width - padding.left - padding.right;
    const graphHeight = this.height - padding.top - padding.bottom;
    const graphX = padding.left;
    const graphY = padding.top;

    const magnitudes = analyzerData.magnitudes;
    const freqStep = analyzerData.sampleRate / analyzerData.fftSize;

    // Create gradient
    const gradient = this.ctx.createLinearGradient(0, graphY, 0, graphY + graphHeight);
    const colorStops = COLORS.spectrumGradient;
    for (let i = 0; i < colorStops.length; i++) {
      gradient.addColorStop(i / (colorStops.length - 1), colorStops[i]);
    }

    this.ctx.fillStyle = gradient;
    this.ctx.globalAlpha = 0.6;

    // Draw spectrum polygon
    this.ctx.beginPath();
    this.ctx.moveTo(graphX, graphY + graphHeight);

    for (let bin = 0; bin < magnitudes.length; bin++) {
      const freq = bin * freqStep;
      if (freq > this.maxFreq) break;

      const magnitude = magnitudes[bin];
      const x = graphX + this.freqToPixels(freq, graphWidth);
      const y = graphY + this.dbToPixels(magnitude, graphHeight);

      this.ctx.lineTo(x, y);
    }

    this.ctx.lineTo(graphX + graphWidth, graphY + graphHeight);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.globalAlpha = 1.0;
  }

  /**
   * Draw peak hold
   */
  private drawPeakHold(peakHold: Float32Array, analyzerData: AnalyzerData): void {
    const padding = { left: 40, right: 20, top: 20, bottom: 40 };
    const graphWidth = this.width - padding.left - padding.right;
    const graphHeight = this.height - padding.top - padding.bottom;
    const graphX = padding.left;
    const graphY = padding.top;

    const freqStep = analyzerData.sampleRate / analyzerData.fftSize;

    this.ctx.strokeStyle = COLORS.eqCurveGlow;
    this.ctx.lineWidth = 1.5;
    this.ctx.globalAlpha = 0.5;

    this.ctx.beginPath();
    for (let bin = 0; bin < peakHold.length; bin++) {
      const freq = bin * freqStep;
      if (freq > this.maxFreq) break;

      const magnitude = peakHold[bin];
      const x = graphX + this.freqToPixels(freq, graphWidth);
      const y = graphY + this.dbToPixels(magnitude, graphHeight);

      if (bin === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }

    this.ctx.stroke();
    this.ctx.globalAlpha = 1.0;
  }

  /**
   * Draw EQ curve overlay
   */
  private drawEQCurve(eqCurve: FrequencyResponsePoint[]): void {
    const padding = { left: 40, right: 20, top: 20, bottom: 40 };
    const graphWidth = this.width - padding.left - padding.right;
    const graphHeight = this.height - padding.top - padding.bottom;
    const graphX = padding.left;
    const graphY = padding.top;

    // Draw glow effect
    this.ctx.shadowColor = COLORS.eqCurveGlow;
    this.ctx.shadowBlur = 8;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;

    this.ctx.strokeStyle = COLORS.eqCurve;
    this.ctx.lineWidth = 2;

    this.ctx.beginPath();
    for (let i = 0; i < eqCurve.length; i++) {
      const point = eqCurve[i];
      const x = graphX + this.freqToPixels(point.frequency, graphWidth);
      const y = graphY + this.dbToPixels(point.magnitude, graphHeight);

      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }

    this.ctx.stroke();

    // Clear shadow
    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;
  }

  /**
   * Draw axis labels
   */
  private drawLabels(): void {
    const padding = { left: 40, right: 20, top: 20, bottom: 40 };
    const graphWidth = this.width - padding.left - padding.right;
    const graphHeight = this.height - padding.top - padding.bottom;
    const graphX = padding.left;
    const graphY = padding.top;

    this.ctx.fillStyle = COLORS.textMuted;
    this.ctx.font = '12px monospace';
    this.ctx.textAlign = 'center';

    // Frequency labels
    for (const freq of FREQUENCIES_LOG) {
      const x = graphX + this.freqToPixels(freq, graphWidth);
      const label = freq >= 1000 ? `${freq / 1000}k` : `${freq}`;
      this.ctx.fillText(label, x, this.height - 8);
    }

    // Gain labels
    this.ctx.textAlign = 'right';
    for (let db = -60; db <= 12; db += 12) {
      const y = graphY + this.dbToPixels(db, graphHeight);
      const label = `${db > 0 ? '+' : ''}${db}dB`;
      this.ctx.fillText(label, padding.left - 8, y + 4);
    }

    // Axis titles
    this.ctx.fillStyle = COLORS.text;
    this.ctx.font = '14px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Frequency (Hz)', this.width / 2, this.height - 2);
  }

  /**
   * Convert frequency to pixel position (logarithmic)
   */
  private freqToPixels(freq: number, graphWidth: number): number {
    const logMin = Math.log(this.minFreq);
    const logMax = Math.log(this.maxFreq);
    const logFreq = Math.log(Math.max(this.minFreq, Math.min(this.maxFreq, freq)));

    return ((logFreq - logMin) / (logMax - logMin)) * graphWidth;
  }

  /**
   * Convert dB to pixel position (linear)
   */
  private dbToPixels(db: number, graphHeight: number): number {
    const clamped = Math.max(this.minDb, Math.min(this.maxDb, db));
    return ((this.maxDb - clamped) / (this.maxDb - this.minDb)) * graphHeight;
  }

  /**
   * Resize canvas
   */
  resize(width: number, height: number): void {
    this.canvas.width = width * this.pixelRatio;
    this.canvas.height = height * this.pixelRatio;
    this.ctx.scale(this.pixelRatio, this.pixelRatio);
    this.width = width;
    this.height = height;
  }

  /**
   * Set dB range
   */
  setDbRange(minDb: number, maxDb: number): void {
    this.minDb = minDb;
    this.maxDb = maxDb;
  }

  /**
   * Set frequency range
   */
  setFrequencyRange(minFreq: number, maxFreq: number): void {
    this.minFreq = Math.max(20, minFreq);
    this.maxFreq = Math.min(20000, maxFreq);
  }
}
