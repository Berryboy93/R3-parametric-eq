/**
 * MiniCurve — small canvas preview of a filter shape inside a band card
 */

import { useRef, useEffect } from 'react';

type Shape = 'hp' | 'lp' | 'peak-cut' | 'peak-boost' | 'shelf-lo' | 'shelf-hi';

interface Props {
  shape: Shape;
  color: string;   // main line colour
  color2?: string; // gradient end colour (optional)
}

function buildCurve(shape: Shape, W: number, H: number): [number, number][] {
  const pts: [number, number][] = [];
  const MID = H * 0.55; // centre line (0 dB)
  const AMP = H * 0.32; // max deflection

  for (let i = 0; i <= 120; i++) {
    const t = i / 120;
    let y: number;
    switch (shape) {
      case 'hp': {
        // Rolls off from left → passes right
        const c = 0.22; // cutoff position
        const slope = Math.max(0, Math.min(1, (t - c + 0.12) / 0.14));
        y = MID - AMP * (slope - 0.3) * 0.9;
        break;
      }
      case 'lp': {
        const c = 0.78;
        const slope = Math.max(0, Math.min(1, (c - t + 0.12) / 0.14));
        y = MID - AMP * (slope - 0.3) * 0.9;
        break;
      }
      case 'peak-cut': {
        const peak = 0.5;
        const bell = Math.exp(-Math.pow((t - peak) / 0.12, 2));
        y = MID + AMP * 0.75 * bell;
        break;
      }
      case 'peak-boost': {
        const peak = 0.5;
        const bell = Math.exp(-Math.pow((t - peak) / 0.12, 2));
        y = MID - AMP * 0.85 * bell;
        break;
      }
      case 'shelf-lo':
        y = MID - AMP * 0.5 * (1 - Math.exp(-t / 0.12));
        break;
      case 'shelf-hi':
        y = MID - AMP * 0.5 * (1 - Math.exp(-(1 - t) / 0.12));
        break;
      default:
        y = MID;
    }
    pts.push([t * W, y]);
  }
  return pts;
}

export function MiniCurve({ shape, color, color2 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.offsetWidth || 160;
    const H = canvas.offsetHeight || 64;
    canvas.width  = W * devicePixelRatio;
    canvas.height = H * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);

    // Background
    ctx.fillStyle = '#0d0d18';
    ctx.fillRect(0, 0, W, H);

    // Subtle grid
    ctx.strokeStyle = 'rgba(80,90,140,0.2)';
    ctx.lineWidth = 0.5;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(W * i / 4, 0); ctx.lineTo(W * i / 4, H); ctx.stroke();
    }
    const mid = H * 0.55;
    ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(W, mid); ctx.stroke();

    const pts = buildCurve(shape, W, H);

    // Gradient
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, color);
    grad.addColorStop(1, color2 ?? color);

    // Fill below/above curve
    ctx.beginPath();
    pts.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
    ctx.lineTo(W, mid);
    ctx.lineTo(0, mid);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.18;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Stroke
    ctx.beginPath();
    pts.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
    ctx.strokeStyle = grad;
    ctx.lineWidth   = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur  = 5;
    ctx.stroke();
    ctx.shadowBlur  = 0;

    // Node dot for peaks
    if (shape === 'peak-cut' || shape === 'peak-boost') {
      const mx = W / 2;
      const my = pts[60][1];
      ctx.beginPath();
      ctx.arc(mx, my, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }, [shape, color, color2]);

  return <canvas ref={ref} style={{ width: '100%', height: 64, display: 'block', borderRadius: 4 }} />;
}
