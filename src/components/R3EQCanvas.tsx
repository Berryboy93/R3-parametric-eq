/**
 * R3EQCanvas — R3 NATIVE branded EQ canvas
 * Midnight Black background · Neon Green curve with glow · Green spectrum
 * All band nodes rendered in #B7FF00 per brand spec (FR-UI-013, FR-UI-012)
 */

import { useRef, useEffect, useCallback, useMemo } from 'react';
import type { FrequencyResponsePoint, EQBand } from '../dsp';
import { FilterType } from '../dsp';

export const NEON_GREEN = '#B7FF00';
export const DB_TICKS   = [24, 12, 6, 0, -6, -12, -24];
export const DB_RANGE   = 24;

export function freqToX(f: number, W: number): number {
  return (Math.log10(f / 20) / Math.log10(20000 / 20)) * W;
}
export function gainToY(g: number, H: number): number {
  return H / 2 - (g / DB_RANGE) * (H / 2) * 0.88;
}

function makeStaticSpectrum(bins: number): number[] {
  let seed = 7;
  const rng = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };
  return Array.from({ length: bins }, (_, i) => {
    const t    = i / bins;
    const freq = 20 * Math.pow(1000, t);
    const pink = -12 * Math.log10(freq / 20) * 0.4;
    return Math.max(-DB_RANGE - 4, Math.min(DB_RANGE - 4, pink + (rng() - 0.5) * 14 + 4 * Math.exp(-Math.pow((t - 0.35) / 0.07, 2))));
  });
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

export function R3EQCanvas({ curve, bands, selectedBand, onSelectBand, onBandDrag, bypass, liveSpectrum }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragging  = useRef<number | null>(null);
  const staticSpec = useMemo(() => makeStaticSpectrum(220), []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    if (!W || !H) return;
    canvas.width  = W * devicePixelRatio;
    canvas.height = H * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);

    // ── Background ────────────────────────────────────────────────────────────
    ctx.fillStyle = '#080808';
    ctx.fillRect(0, 0, W, H);

    // ── Grid ──────────────────────────────────────────────────────────────────
    const FREQ_TICKS = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
    ctx.lineWidth = 1;
    for (const f of FREQ_TICKS) {
      ctx.strokeStyle = 'rgba(36,36,36,0.9)';
      ctx.beginPath(); ctx.moveTo(freqToX(f, W), 0); ctx.lineTo(freqToX(f, W), H); ctx.stroke();
    }
    for (const db of DB_TICKS) {
      const y = gainToY(db, H);
      ctx.strokeStyle = db === 0 ? 'rgba(80,80,80,0.6)' : 'rgba(36,36,36,0.7)';
      ctx.lineWidth   = db === 0 ? 1.5 : 1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // ── Spectrum ──────────────────────────────────────────────────────────────
    if (liveSpectrum && liveSpectrum.length > 0) {
      const nyq = 24000;
      const bins = liveSpectrum.length;
      for (let i = 1; i < bins; i++) {
        const f = (i / bins) * nyq;
        if (f < 20 || f > 20000) continue;
        const x0 = freqToX(((i - 1) / bins) * nyq || 20, W);
        const x1 = freqToX(f, W);
        const db  = Math.max(-100, liveSpectrum[i]);
        const n   = (db + 100) / 100;
        const barH = n * H;
        ctx.fillStyle = `rgba(183,255,0,${0.06 + n * 0.18})`;
        ctx.fillRect(x0, H - barH, Math.max(0.5, x1 - x0), barH);
      }
    } else {
      const bW = W / staticSpec.length;
      for (let i = 0; i < staticSpec.length; i++) {
        const n = (staticSpec[i] + DB_RANGE) / (DB_RANGE * 2);
        const barH = Math.max(0, n * H);
        ctx.fillStyle = `rgba(183,255,0,${0.04 + n * 0.10})`;
        ctx.fillRect(i * bW, H - barH, Math.max(0.5, bW - 0.5), barH);
      }
    }

    if (curve.length < 2) return;

    // ── EQ curve fill (FR-UI-012: green gradient) ─────────────────────────────
    ctx.save();
    ctx.beginPath();
    curve.forEach((pt, i) => {
      const x = freqToX(pt.frequency, W);
      const y = bypass ? gainToY(0, H) : gainToY(pt.magnitude, H);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    const lastPt = curve[curve.length - 1];
    ctx.lineTo(freqToX(lastPt.frequency, W), gainToY(0, H));
    ctx.lineTo(freqToX(curve[0].frequency, W), gainToY(0, H));
    ctx.closePath();
    const fillGrad = ctx.createLinearGradient(0, 0, 0, H);
    fillGrad.addColorStop(0,   `rgba(183,255,0,${bypass ? 0.04 : 0.18})`);
    fillGrad.addColorStop(0.5, `rgba(183,255,0,${bypass ? 0.02 : 0.08})`);
    fillGrad.addColorStop(1,   'rgba(183,255,0,0)');
    ctx.fillStyle = fillGrad;
    ctx.fill();
    ctx.restore();

    // ── EQ curve stroke (FR-UI-013: neon glow) ───────────────────────────────
    ctx.save();
    ctx.beginPath();
    curve.forEach((pt, i) => {
      const x = freqToX(pt.frequency, W);
      const y = bypass ? gainToY(0, H) : gainToY(pt.magnitude, H);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle   = NEON_GREEN;
    ctx.lineWidth     = bypass ? 1.5 : 2.2;
    ctx.globalAlpha   = bypass ? 0.3 : 1;
    ctx.shadowColor   = NEON_GREEN;
    ctx.shadowBlur    = bypass ? 0 : 14;
    ctx.stroke();
    ctx.globalAlpha   = 1;
    ctx.shadowBlur    = 0;
    ctx.restore();

    // ── Band nodes (all Neon Green per brand spec) ────────────────────────────
    for (const band of bands) {
      if (!band.enabled) continue;
      const x   = freqToX(band.frequency, W);
      const y   = gainToY(bypass ? 0 : band.gain, H);
      const sel = band.id === selectedBand;
      const r   = sel ? 13 : 11;

      // Outer glow ring (selected only)
      if (sel) {
        ctx.beginPath();
        ctx.arc(x, y, r + 3, 0, Math.PI * 2);
        ctx.strokeStyle = `${NEON_GREEN}40`;
        ctx.lineWidth   = 3;
        ctx.stroke();
      }

      // Ring
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.strokeStyle   = NEON_GREEN;
      ctx.lineWidth     = sel ? 2 : 1.5;
      ctx.shadowColor   = NEON_GREEN;
      ctx.shadowBlur    = sel ? 10 : 4;
      ctx.stroke();
      ctx.shadowBlur    = 0;

      // Fill
      ctx.beginPath();
      ctx.arc(x, y, r - 1.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(8,8,8,${sel ? 0.9 : 0.75})`;
      ctx.fill();

      // Number
      ctx.fillStyle    = NEON_GREEN;
      ctx.font         = `${sel ? 700 : 600} ${sel ? 12 : 11}px 'Montserrat', sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${band.id + 1}`, x, y + 0.5);
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }, [curve, bands, selectedBand, bypass, liveSpectrum, staticSpec]);

  useEffect(() => { draw(); }, [draw]);

  const getPos = (e: React.MouseEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const xToFreq = (x: number) => {
    const W = canvasRef.current!.offsetWidth;
    return Math.max(20, Math.min(20000, 20 * Math.pow(1000, x / W)));
  };
  const yToGain = (y: number) => {
    const H = canvasRef.current!.offsetHeight;
    return Math.max(-DB_RANGE, Math.min(DB_RANGE, ((H / 2 - y) / (H / 2 * 0.88)) * DB_RANGE));
  };

  const onMouseDown = (e: React.MouseEvent) => {
    const { x, y } = getPos(e);
    const W = canvasRef.current!.offsetWidth;
    const H = canvasRef.current!.offsetHeight;
    let best = { id: -1, d: 22 };
    for (const b of bands) {
      if (!b.enabled) continue;
      const d = Math.hypot(x - freqToX(b.frequency, W), y - gainToY(bypass ? 0 : b.gain, H));
      if (d < best.d) best = { id: b.id, d };
    }
    if (best.id >= 0) { onSelectBand(best.id); dragging.current = best.id; }
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (dragging.current === null) return;
    const { x, y } = getPos(e);
    const band = bands.find(b => b.id === dragging.current);
    const freq = xToFreq(x);
    const gain = (band?.type === FilterType.HighPass || band?.type === FilterType.LowPass)
      ? (band?.gain ?? 0) : yToGain(y);
    onBandDrag(dragging.current!, freq, gain);
  };
  const onMouseUp = () => { dragging.current = null; };

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      aria-label="Parametric EQ frequency response canvas — drag numbered nodes to adjust bands"
      role="img"
    />
  );
}
