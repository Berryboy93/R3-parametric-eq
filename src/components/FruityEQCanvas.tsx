/**
 * FruityEQCanvas — EQ display with smoky metallic aesthetic
 * Amber/copper gradient curve, warm-tinted spectrum, industrial band nodes.
 */

import { useRef, useEffect, useCallback, useMemo } from 'react';
import type { FrequencyResponsePoint, EQBand } from '../dsp';
import { FilterType } from '../dsp';

// Metallic band colours — copper, steel, verdigris, brass, iron-red, gunmetal, pewter, bronze
export const BAND_COLORS = [
  '#CF8A3A', // 1 HP  — warm copper
  '#7AAABB', // 2 LS  — steel blue
  '#76A876', // 3 PK  — verdigris
  '#C9A840', // 4 PK  — aged brass
  '#C96A55', // 5 PK  — iron oxide
  '#5B98C8', // 6 PK  — gunmetal blue
  '#9978C8', // 7 HS  — tarnished pewter
  '#B8924A', // 8 LP  — aged bronze
];

const FREQ_TICKS = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
export const DB_TICKS = [24, 12, 6, 0, -6, -12, -24];
export const DB_RANGE = 24;

export function freqToX(f: number, W: number) {
  return (Math.log10(f / 20) / Math.log10(20000 / 20)) * W;
}
export function gainToY(g: number, H: number) {
  return H / 2 - (g / DB_RANGE) * (H / 2) * 0.9;
}

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
  liveSpectrum?: Float32Array | null;
}

export function FruityEQCanvas({
  curve, bands, selectedBand, onSelectBand, onBandDrag, bypass, liveSpectrum,
}: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const dragging   = useRef<number | null>(null);
  const staticSpec = useMemo(() => makeStaticSpectrum(200), []);

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

    // ── Background — smoked glass ──────────────────────────────────────────
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0,   '#111008');
    bgGrad.addColorStop(0.5, '#0f0d0b');
    bgGrad.addColorStop(1,   '#0a0908');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Subtle vignette
    const vignette = ctx.createRadialGradient(W/2, H/2, H*0.2, W/2, H/2, H*0.9);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);

    // ── Grid — warm-tinted ─────────────────────────────────────────────────
    ctx.lineWidth = 1;
    for (const f of FREQ_TICKS) {
      const x = freqToX(f, W);
      ctx.strokeStyle = 'rgba(100,85,60,0.22)';
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (const db of DB_TICKS) {
      const y = gainToY(db, H);
      ctx.strokeStyle = db === 0 ? 'rgba(180,140,80,0.30)' : 'rgba(90,78,55,0.18)';
      ctx.lineWidth   = db === 0 ? 1.5 : 1;
      ctx.setLineDash(db === 0 ? [] : [4, 4]);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.setLineDash([]);

    // ── Spectrum — amber-tinted ────────────────────────────────────────────
    if (liveSpectrum && liveSpectrum.length > 0) {
      const nyquist  = 24000;
      const binCount = liveSpectrum.length;
      const FLOOR    = -100;
      for (let i = 1; i < binCount; i++) {
        const f  = (i / binCount) * nyquist;
        if (f < 20 || f > 20000) continue;
        const x1 = freqToX(f, W);
        const x0 = freqToX(((i - 1) / binCount) * nyquist || 20, W);
        const db   = Math.max(FLOOR, liveSpectrum[i]);
        const norm = (db - FLOOR) / (-FLOOR);
        const alpha = 0.10 + norm * 0.25;
        ctx.fillStyle = `rgba(196,134,42,${alpha})`;
        ctx.fillRect(x0, H - norm * H, Math.max(0.5, x1 - x0), norm * H);
      }
    } else {
      const barW = W / staticSpec.length;
      for (let i = 0; i < staticSpec.length; i++) {
        const db   = staticSpec[i];
        const barH = Math.max(0, ((db + DB_RANGE) / (DB_RANGE * 2)) * H);
        const alpha = 0.07 + 0.08 * (db + DB_RANGE) / (DB_RANGE * 2);
        ctx.fillStyle = `rgba(160,120,60,${alpha})`;
        ctx.fillRect(i * barW, H - barH, Math.max(0.5, barW - 0.5), barH);
      }
    }

    if (curve.length < 2) return;

    // ── Amber/copper gradient for EQ curve ─────────────────────────────────
    const makeGrad = () => {
      const g = ctx.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0,    '#C4862A');
      g.addColorStop(0.35, '#D4A040');
      g.addColorStop(0.65, '#D4723A');
      g.addColorStop(1,    '#C4862A');
      return g;
    };

    const buildPath = () => {
      ctx.beginPath();
      curve.forEach((pt, i) => {
        const x = freqToX(pt.frequency, W);
        const y = bypass ? gainToY(0, H) : gainToY(pt.magnitude, H);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
    };

    // Curve fill
    ctx.save();
    buildPath();
    const lastX = freqToX(curve[curve.length - 1].frequency, W);
    const zero  = gainToY(0, H);
    ctx.lineTo(lastX, zero);
    ctx.lineTo(freqToX(curve[0].frequency, W), zero);
    ctx.closePath();
    const fillGrad = ctx.createLinearGradient(0, 0, 0, H);
    fillGrad.addColorStop(0, 'rgba(196,134,42,0.28)');
    fillGrad.addColorStop(1, 'rgba(196,134,42,0.03)');
    ctx.fillStyle   = bypass ? 'rgba(100,80,40,0.05)' : fillGrad;
    ctx.globalAlpha = bypass ? 0.5 : 1;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    // Curve stroke — spec §2.2: 3px + double-glow (outer soft + inner bright)
    // Pass 1: wide outer glow
    ctx.save();
    buildPath();
    ctx.strokeStyle = '#C4862A';
    ctx.lineWidth   = bypass ? 2 : 6;
    ctx.globalAlpha = bypass ? 0.08 : 0.22;
    ctx.shadowColor = '#C4862A';
    ctx.shadowBlur  = bypass ? 6 : 18;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
    ctx.restore();
    // Pass 2: crisp inner stroke
    ctx.save();
    buildPath();
    ctx.strokeStyle = makeGrad();
    ctx.lineWidth   = bypass ? 1.5 : 3;
    ctx.globalAlpha = bypass ? 0.3 : 1;
    ctx.shadowColor = '#D4A040';
    ctx.shadowBlur  = bypass ? 3 : 8;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
    ctx.restore();

    // ── Band nodes — riveted metal look ────────────────────────────────────
    for (const band of bands) {
      if (!band.enabled) continue;
      const x     = freqToX(band.frequency, W);
      const yGain = bypass ? 0 : band.gain;
      const y     = gainToY(yGain, H);
      const color = BAND_COLORS[band.id] ?? '#C4862A';
      const sel   = band.id === selectedBand;
      const r     = sel ? 14 : 12;

      // Outer ring glow
      if (sel) {
        ctx.beginPath();
        ctx.arc(x, y, r + 4, 0, Math.PI * 2);
        ctx.fillStyle = `${color}20`;
        ctx.fill();
      }

      // Metal body — radial gradient for 3D rivet look
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      const nodeGrad = ctx.createRadialGradient(x - r*0.25, y - r*0.25, 0, x, y, r);
      nodeGrad.addColorStop(0, `${color}55`);
      nodeGrad.addColorStop(1, 'rgba(10,8,6,0.92)');
      ctx.fillStyle = nodeGrad;
      ctx.fill();

      // Ring
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth   = sel ? 2.5 : 1.5;
      ctx.globalAlpha = sel ? 1 : 0.75;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Number label
      ctx.fillStyle    = sel ? color : `${color}cc`;
      ctx.font         = `bold ${sel ? 11 : 10}px sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${band.id + 1}`, x, y);
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }, [curve, bands, selectedBand, bypass, liveSpectrum, staticSpec]);

  useEffect(() => { draw(); }, [draw]);

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
