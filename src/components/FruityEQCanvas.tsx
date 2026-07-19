/**
 * FruityEQCanvas — Main EQ display styled after Fruity Parametric EQ 2
 * Rainbow-gradient curve, spectrum analyzer backdrop, numbered band nodes
 */

import { useRef, useEffect, useCallback, useMemo } from 'react';
import type { FrequencyResponsePoint, EQBand } from '../dsp';
import { FilterType } from '../dsp';

// ── Band colours (matches the 5-band educational colour palette) ─────────────
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
const DB_TICKS   = [18, 12, 6, 0, -6, -12, -18];
const DB_RANGE   = 18; // ± this many dB shown

function freqToX(f: number, W: number) {
  return (Math.log10(f / 20) / Math.log10(20000 / 20)) * W;
}
function gainToY(g: number, H: number) {
  return H / 2 - (g / DB_RANGE) * (H / 2) * 0.9;
}
function fmtFreq(f: number) { return f >= 1000 ? `${f / 1000}k` : `${f}`; }

// Generate a static, realistic-looking pink-noise spectrum
function makeSpectrum(bins: number): number[] {
  const s: number[] = [];
  let seed = 42;
  const rng = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };
  for (let i = 0; i < bins; i++) {
    const t = i / bins;
    const freq = 20 * Math.pow(1000, t);
    const pink = -10 * Math.log10(freq / 20) * 0.5;          // -3 dB/oct slope
    const bump1 = 4 * Math.exp(-Math.pow((t - 0.32) / 0.06, 2)); // peak ~200Hz
    const bump2 = 6 * Math.exp(-Math.pow((t - 0.52) / 0.05, 2)); // peak ~1kHz
    const noise = (rng() - 0.5) * 10;
    s.push(Math.max(-DB_RANGE - 2, Math.min(DB_RANGE - 2, pink + bump1 + bump2 + noise)));
  }
  return s;
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  curve: FrequencyResponsePoint[];
  bands: readonly EQBand[];
  selectedBand: number | null;
  onSelectBand: (id: number) => void;
  onBandDrag: (id: number, freq: number, gain: number) => void;
  bypass: boolean;
}

export function FruityEQCanvas({ curve, bands, selectedBand, onSelectBand, onBandDrag, bypass }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const dragging   = useRef<number | null>(null);
  const spectrum   = useMemo(() => makeSpectrum(200), []);

  // ── Draw ──────────────────────────────────────────────────────────────────
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

    // Background
    ctx.fillStyle = '#0b0b12';
    ctx.fillRect(0, 0, W, H);

    // Grid — vertical (frequency)
    ctx.strokeStyle = 'rgba(80,90,130,0.25)';
    ctx.lineWidth = 1;
    for (const f of FREQ_TICKS) {
      const x = freqToX(f, W);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }

    // Grid — horizontal (dB)
    for (const db of DB_TICKS) {
      const y = gainToY(db, H);
      ctx.strokeStyle = db === 0 ? 'rgba(200,210,255,0.25)' : 'rgba(80,90,130,0.2)';
      ctx.lineWidth   = db === 0 ? 1.5 : 1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Spectrum analyzer bars (gray)
    const barW = W / spectrum.length;
    for (let i = 0; i < spectrum.length; i++) {
      const x  = i * barW;
      const barH = Math.max(0, ((spectrum[i] + DB_RANGE) / (DB_RANGE * 2)) * H);
      const y  = H - barH;
      ctx.fillStyle = `rgba(160,170,200,${0.10 + 0.08 * (spectrum[i] + DB_RANGE) / (DB_RANGE * 2)})`;
      ctx.fillRect(x, y, Math.max(1, barW - 0.5), barH);
    }

    if (curve.length < 2) return;

    // ── Rainbow gradient (reused for fill + stroke) ─────────────────────────
    const makeGrad = () => {
      const g = ctx.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0,    '#7C3AED'); // purple
      g.addColorStop(0.18, '#F59E0B'); // amber
      g.addColorStop(0.45, '#10B981'); // green
      g.addColorStop(0.65, '#06B6D4'); // cyan
      g.addColorStop(1,    '#7C3AED'); // back to purple
      return g;
    };

    // ── EQ curve path ───────────────────────────────────────────────────────
    const buildPath = () => {
      ctx.beginPath();
      curve.forEach((pt, i) => {
        const x = freqToX(pt.frequency, W);
        const y = bypass ? gainToY(0, H) : gainToY(pt.magnitude, H);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
    };

    // Filled area
    ctx.save();
    buildPath();
    const lastX = freqToX(curve[curve.length - 1].frequency, W);
    const zero  = gainToY(0, H);
    ctx.lineTo(lastX, zero);
    ctx.lineTo(freqToX(curve[0].frequency, W), zero);
    ctx.closePath();
    const fillGrad = makeGrad();
    ctx.fillStyle = fillGrad;
    ctx.globalAlpha = bypass ? 0.06 : 0.22;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    // Stroked curve
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

    // ── Band nodes ───────────────────────────────────────────────────────────
    for (const band of bands) {
      const x     = freqToX(band.frequency, W);
      const yGain = bypass ? 0 : band.gain;
      const y     = gainToY(yGain, H);
      const color = BAND_COLORS[band.id] ?? '#fff';
      const sel   = band.id === selectedBand;
      const r     = sel ? 14 : 12;

      if (!band.enabled) continue;

      // Outer ring
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth   = sel ? 2.5 : 1.5;
      ctx.globalAlpha = sel ? 1 : 0.85;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Fill (dark translucent)
      ctx.beginPath();
      ctx.arc(x, y, r - 1.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(10,10,18,${sel ? 0.85 : 0.7})`;
      ctx.fill();

      // Number label
      ctx.fillStyle   = color;
      ctx.font        = `bold ${sel ? 12 : 11}px sans-serif`;
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${band.id + 1}`, x, y);
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }, [curve, bands, selectedBand, bypass, spectrum]);

  useEffect(() => { draw(); }, [draw]);

  // Mouse helpers
  const pos = (e: React.MouseEvent) => {
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

  const handleMouseDown = (e: React.MouseEvent) => {
    const { x, y } = pos(e);
    const W = canvasRef.current!.offsetWidth;
    const H = canvasRef.current!.offsetHeight;
    let best = { id: -1, d: 18 };
    for (const b of bands) {
      if (!b.enabled) continue;
      const bx = freqToX(b.frequency, W);
      const by = gainToY(bypass ? 0 : b.gain, H);
      const d  = Math.hypot(x - bx, y - by);
      if (d < best.d) best = { id: b.id, d };
    }
    if (best.id >= 0) { onSelectBand(best.id); dragging.current = best.id; }
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging.current === null) return;
    const { x, y } = pos(e);
    const id   = dragging.current;
    const band = bands.find(b => b.id === id);
    const freq = xToFreq(x);
    const gain = (band?.type === FilterType.HighPass || band?.type === FilterType.LowPass)
      ? band.gain
      : yToGain(y);
    onBandDrag(id, freq, gain);
  };
  const handleMouseUp = () => { dragging.current = null; };

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    />
  );
}
