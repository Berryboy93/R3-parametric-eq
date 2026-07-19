/**
 * FruityEQCanvas — main EQ display styled after Fruity Parametric EQ 2
 * Rainbow-gradient curve, spectrum analyzer backdrop, numbered band nodes.
 * Accepts an optional `liveSpectrum` Float32Array from AnalyserNode for real-time display.
 */

import { useRef, useEffect, useCallback, useMemo } from 'react';
import type { FrequencyResponsePoint, EQBand } from '../dsp';
import { FilterType } from '../dsp';

export const BAND_COLORS = [
  '#9B59B6', // 1 HP     — purple
  '#F39C12', // 2 cut    — amber
  '#2ECC71', // 3 boost  — green
  '#1DBFBF', // 4 harsh  — teal
  '#8B5CF6', // 5 LP     — violet
  '#E74C3C', // 6        — red
  '#3498DB', // 7        — blue
  '#F1C40F', // 8        — yellow
];

const FREQ_TICKS = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
export const DB_TICKS = [18, 12, 6, 0, -6, -12, -18];
export const DB_RANGE = 18;

export function freqToX(f: number, W: number) {
  return (Math.log10(f / 20) / Math.log10(20000 / 20)) * W;
}
export function gainToY(g: number, H: number) {
  return H / 2 - (g / DB_RANGE) * (H / 2) * 0.9;
}

// Static pink-noise-shaped spectrum used when no live audio
function makeStaticSpectrum(bins: number): number[] {
  const s: number[] = [];
  let seed = 42;
  const rng = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };
  for (let i = 0; i < bins; i++) {
    const t    = i / bins;
    const freq = 20 * Math.pow(1000, t);
    const pink = -10 * Math.log10(freq / 20) * 0.5;
    const bump1 = 4 * Math.exp(-Math.pow((t - 0.32) / 0.06, 2));
    const bump2 = 6 * Math.exp(-Math.pow((t - 0.52) / 0.05, 2));
    const noise = (rng() - 0.5) * 10;
    s.push(Math.max(-DB_RANGE - 2, Math.min(DB_RANGE - 2, pink + bump1 + bump2 + noise)));
  }
  return s;
}

interface Props {
  curve: FrequencyResponsePoint[];
  bands: readonly EQBand[];
  selectedBand: number | null;
  onSelectBand: (id: number) => void;
  onBandDrag: (id: number, freq: number, gain: number) => void;
  bypass: boolean;
  /** Live spectrum from AnalyserNode.getFloatFrequencyData() (dB, e.g. -120…0) */
  liveSpectrum?: Float32Array | null;
}

export function FruityEQCanvas({
  curve, bands, selectedBand, onSelectBand, onBandDrag, bypass, liveSpectrum,
}: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const dragging     = useRef<number | null>(null);
  const staticSpec   = useMemo(() => makeStaticSpectrum(200), []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width  = W * devicePixelRatio;
    canvas.height = H * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);

    // ── Background ─────────────────────────────────────────────────────────
    ctx.fillStyle = '#0b0b12';
    ctx.fillRect(0, 0, W, H);

    // ── Grid ───────────────────────────────────────────────────────────────
    ctx.lineWidth = 1;
    for (const f of FREQ_TICKS) {
      ctx.strokeStyle = 'rgba(80,90,130,0.25)';
      ctx.beginPath(); ctx.moveTo(freqToX(f, W), 0); ctx.lineTo(freqToX(f, W), H); ctx.stroke();
    }
    for (const db of DB_TICKS) {
      const y = gainToY(db, H);
      ctx.strokeStyle = db === 0 ? 'rgba(200,210,255,0.25)' : 'rgba(80,90,130,0.18)';
      ctx.lineWidth   = db === 0 ? 1.5 : 1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // ── Spectrum (live or static) ──────────────────────────────────────────
    if (liveSpectrum && liveSpectrum.length > 0) {
      // Map FFT bins (Nyquist → 0 Hz) to canvas x-positions
      // AnalyserNode gives bins from 0 Hz to sampleRate/2
      const nyquist  = 24000; // assume 48 kHz sample rate (worst case 44.1 kHz → OK)
      const binCount = liveSpectrum.length;
      const FLOOR    = -100; // dB floor for display

      for (let i = 1; i < binCount; i++) {
        const f  = (i / binCount) * nyquist;
        if (f < 20 || f > 20000) continue;
        const x1 = freqToX(f, W);
        const x0 = freqToX(((i - 1) / binCount) * nyquist || 20, W);
        const db = Math.max(FLOOR, liveSpectrum[i]);
        const norm = (db - FLOOR) / (-FLOOR); // 0 = silent, 1 = 0 dBFS
        const barH = norm * H;
        const alpha = 0.12 + norm * 0.22;
        ctx.fillStyle = `rgba(160,190,255,${alpha})`;
        ctx.fillRect(x0, H - barH, Math.max(0.5, x1 - x0), barH);
      }
    } else {
      // Static placeholder spectrum
      const barW = W / staticSpec.length;
      for (let i = 0; i < staticSpec.length; i++) {
        const db   = staticSpec[i];
        const barH = Math.max(0, ((db + DB_RANGE) / (DB_RANGE * 2)) * H);
        const alpha = 0.09 + 0.07 * (db + DB_RANGE) / (DB_RANGE * 2);
        ctx.fillStyle = `rgba(160,170,200,${alpha})`;
        ctx.fillRect(i * barW, H - barH, Math.max(0.5, barW - 0.5), barH);
      }
    }

    if (curve.length < 2) return;

    // ── Rainbow gradient ───────────────────────────────────────────────────
    const makeGrad = () => {
      const g = ctx.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0,    '#7C3AED');
      g.addColorStop(0.18, '#F59E0B');
      g.addColorStop(0.45, '#10B981');
      g.addColorStop(0.65, '#06B6D4');
      g.addColorStop(1,    '#7C3AED');
      return g;
    };

    // ── EQ curve path ──────────────────────────────────────────────────────
    const buildPath = () => {
      ctx.beginPath();
      curve.forEach((pt, i) => {
        const x = freqToX(pt.frequency, W);
        const y = bypass ? gainToY(0, H) : gainToY(pt.magnitude, H);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
    };

    // Fill
    ctx.save();
    buildPath();
    const lastX = freqToX(curve[curve.length - 1].frequency, W);
    const zero  = gainToY(0, H);
    ctx.lineTo(lastX, zero);
    ctx.lineTo(freqToX(curve[0].frequency, W), zero);
    ctx.closePath();
    ctx.fillStyle   = makeGrad();
    ctx.globalAlpha = bypass ? 0.05 : 0.2;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    // Stroke
    ctx.save();
    buildPath();
    ctx.strokeStyle = makeGrad();
    ctx.lineWidth   = bypass ? 1.5 : 2.5;
    ctx.globalAlpha = bypass ? 0.35 : 1;
    ctx.shadowColor = '#7C3AED';
    ctx.shadowBlur  = 8;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
    ctx.restore();

    // ── Band nodes ────────────────────────────────────────────────────────
    for (const band of bands) {
      if (!band.enabled) continue;
      const x     = freqToX(band.frequency, W);
      const yGain = bypass ? 0 : band.gain;
      const y     = gainToY(yGain, H);
      const color = BAND_COLORS[band.id] ?? '#fff';
      const sel   = band.id === selectedBand;
      const r     = sel ? 14 : 12;

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth   = sel ? 2.5 : 1.5;
      ctx.globalAlpha = sel ? 1 : 0.85;
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.beginPath();
      ctx.arc(x, y, r - 1.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(10,10,18,${sel ? 0.85 : 0.7})`;
      ctx.fill();

      ctx.fillStyle    = color;
      ctx.font         = `bold ${sel ? 12 : 11}px sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${band.id + 1}`, x, y);
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }, [curve, bands, selectedBand, bypass, liveSpectrum, staticSpec]);

  // Redraw on every prop change (liveSpectrum changes every rAF frame)
  useEffect(() => { draw(); }, [draw]);

  // ── Drag interaction (pointer events — works for mouse, touch & stylus) ──────
  const getPos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const xToFreq = (x: number) => {
    const W = canvasRef.current!.offsetWidth;
    return Math.max(20, Math.min(20000, 20 * Math.pow(1000, x / W)));
  };
  const yToGain = (y: number) => {
    const H = canvasRef.current!.offsetHeight;
    return Math.max(-DB_RANGE, Math.min(DB_RANGE, ((H / 2 - y) / (H / 2 * 0.9)) * DB_RANGE));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = getPos(e);
    const W = canvasRef.current!.offsetWidth;
    const H = canvasRef.current!.offsetHeight;
    let best = { id: -1, d: 22 };
    for (const b of bands) {
      if (!b.enabled) continue;
      const bx = freqToX(b.frequency, W);
      const by = gainToY(bypass ? 0 : b.gain, H);
      const d  = Math.hypot(x - bx, y - by);
      if (d < best.d) best = { id: b.id, d };
    }
    if (best.id >= 0) {
      onSelectBand(best.id);
      dragging.current = best.id;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragging.current === null) return;
    const { x, y } = getPos(e);
    const band = bands.find(b => b.id === dragging.current);
    const freq = xToFreq(x);
    const gain = (band?.type === FilterType.HighPass || band?.type === FilterType.LowPass)
      ? (band?.gain ?? 0)
      : yToGain(y);
    onBandDrag(dragging.current!, freq, gain);
  };
  const handlePointerUp = () => { dragging.current = null; };

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair', touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    />
  );
}
