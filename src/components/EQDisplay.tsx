/**
 * EQDisplay — Canvas-based frequency response curve
 * Logarithmic frequency axis (20Hz–20kHz), ±24dB gain axis
 */

import { useRef, useEffect, useCallback } from 'react';
import type { FrequencyResponsePoint, EQBand } from '../dsp';

const BAND_COLORS = [
  '#B7FF00', '#A8E600', '#C4FF1A', '#B0FF00',
  '#D4FF33', '#99CC00', '#CCFF00', '#7FFF00',
];

const FREQ_LABELS = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
const GAIN_LINES = [-24, -18, -12, -6, 0, 6, 12, 18, 24];

function freqToX(freq: number, width: number): number {
  return (Math.log10(freq / 20) / Math.log10(20000 / 20)) * width;
}

function gainToY(gain: number, height: number): number {
  return height / 2 - (gain / 24) * (height / 2) * 0.9;
}

function formatFreq(f: number): string {
  return f >= 1000 ? `${f / 1000}k` : `${f}`;
}

interface EQDisplayProps {
  curve: FrequencyResponsePoint[];
  bands: readonly EQBand[];
  selectedBand: number | null;
  onSelectBand: (id: number) => void;
  onBandDrag?: (bandId: number, freq: number, gain: number) => void;
  bypass: boolean;
}

export function EQDisplay({ curve, bands, selectedBand, onSelectBand, onBandDrag, bypass }: EQDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draggingRef = useRef<{ bandId: number } | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, W, H);

    // Gain grid lines
    for (const gain of GAIN_LINES) {
      const y = gainToY(gain, H);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.strokeStyle = gain === 0 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)';
      ctx.lineWidth = gain === 0 ? 1.5 : 1;
      ctx.stroke();
      if (gain !== 0 && gain !== -24 && gain !== 24) {
        ctx.fillStyle = 'rgba(153,153,153,0.6)';
        ctx.font = '10px monospace';
        ctx.fillText(`${gain > 0 ? '+' : ''}${gain}`, 4, y - 3);
      }
    }

    // Frequency grid lines
    for (const freq of FREQ_LABELS) {
      const x = freqToX(freq, W);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = 'rgba(153,153,153,0.6)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(formatFreq(freq), x, H - 4);
    }
    ctx.textAlign = 'left';

    // EQ Curve
    if (curve.length > 0 && !bypass) {
      // Filled area under curve
      ctx.beginPath();
      ctx.moveTo(freqToX(curve[0].frequency, W), gainToY(0, H));
      for (const pt of curve) {
        ctx.lineTo(freqToX(pt.frequency, W), gainToY(pt.magnitude, H));
      }
      ctx.lineTo(freqToX(curve[curve.length - 1].frequency, W), gainToY(0, H));
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, 'rgba(183,255,0,0.18)');
      grad.addColorStop(0.5, 'rgba(183,255,0,0.06)');
      grad.addColorStop(1, 'rgba(183,255,0,0)');
      ctx.fillStyle = grad;
      ctx.fill();

      // Curve stroke
      ctx.beginPath();
      for (let i = 0; i < curve.length; i++) {
        const x = freqToX(curve[i].frequency, W);
        const y = gainToY(curve[i].magnitude, H);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = bypass ? 'rgba(183,255,0,0.3)' : '#B7FF00';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#B7FF00';
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (bypass) {
      // Flat line when bypassed
      const y = gainToY(0, H);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.strokeStyle = 'rgba(183,255,0,0.3)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Band nodes
    for (const band of bands) {
      if (!band.enabled) continue;
      const x = freqToX(band.frequency, W);
      const y = gainToY(band.gain, H);
      const color = BAND_COLORS[band.id] || '#B7FF00';
      const isSelected = band.id === selectedBand;

      // Node circle
      ctx.beginPath();
      ctx.arc(x, y, isSelected ? 9 : 7, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? color : `${color}cc`;
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#fff' : color;
      ctx.lineWidth = isSelected ? 2 : 1.5;
      ctx.stroke();

      // Band label
      ctx.fillStyle = '#000';
      ctx.font = `bold 9px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`${band.id + 1}`, x, y + 3.5);
    }
    ctx.textAlign = 'left';
  }, [curve, bands, selectedBand, bypass]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Handle resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      draw();
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [draw]);

  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.offsetWidth / rect.width;
    const scaleY = canvas.offsetHeight / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const xToFreq = (x: number): number => {
    const canvas = canvasRef.current!;
    const W = canvas.offsetWidth;
    return 20 * Math.pow(20000 / 20, x / W);
  };

  const yToGain = (y: number): number => {
    const canvas = canvasRef.current!;
    const H = canvas.offsetHeight;
    return ((H / 2 - y) / (H / 2 * 0.9)) * 24;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasPos(e);
    const W = canvasRef.current!.offsetWidth;
    const H = canvasRef.current!.offsetHeight;

    // Find closest band node
    let closestId = -1, closestDist = 20;
    for (const band of bands) {
      if (!band.enabled) continue;
      const bx = freqToX(band.frequency, W);
      const by = gainToY(band.gain, H);
      const dist = Math.sqrt((x - bx) ** 2 + (y - by) ** 2);
      if (dist < closestDist) { closestDist = dist; closestId = band.id; }
    }

    if (closestId >= 0) {
      onSelectBand(closestId);
      draggingRef.current = { bandId: closestId };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current || !onBandDrag) return;
    const { x, y } = getCanvasPos(e);
    const freq = Math.max(20, Math.min(20000, xToFreq(x)));
    const gain = Math.max(-24, Math.min(24, yToGain(y)));
    onBandDrag(draggingRef.current.bandId, freq, gain);
  };

  const handleMouseUp = () => { draggingRef.current = null; };

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', cursor: 'crosshair', display: 'block' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    />
  );
}

export { BAND_COLORS };
