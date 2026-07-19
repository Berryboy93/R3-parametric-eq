/**
 * BandCard — educational filter-type card (matches Fruity EQ 2 lower section)
 */

import { MiniCurve } from './MiniCurve';

type Shape = 'hp' | 'lp' | 'peak-cut' | 'peak-boost';

interface BandCardData {
  num: number;
  label: string;
  color: string;
  color2?: string;
  shape: Shape;
  desc: string;
  range: string;
  borderColor: string;
}

export const BAND_CARDS: BandCardData[] = [
  {
    num: 1, label: 'HIGH PASS', color: '#9B59B6', color2: '#c084fc',
    shape: 'hp', borderColor: '#9B59B6',
    desc: 'Remove unnecessary low frequencies to clean up your mix and make room for the bass.',
    range: 'Try 20Hz – 200Hz',
  },
  {
    num: 2, label: 'CUT MUD', color: '#F39C12', color2: '#fbbf24',
    shape: 'peak-cut', borderColor: '#F39C12',
    desc: 'Reduce muddy frequencies that make your mix sound cloudy or unfocused.',
    range: 'Try 200Hz – 500Hz',
  },
  {
    num: 3, label: 'BOOST PRESENCE', color: '#2ECC71', color2: '#4ade80',
    shape: 'peak-boost', borderColor: '#2ECC71',
    desc: 'Add presence and clarity to help your instrument stand out in the mix.',
    range: 'Try 2kHz – 5kHz',
  },
  {
    num: 4, label: 'REMOVE HARSH FREQUENCIES', color: '#1DBFBF', color2: '#22d3ee',
    shape: 'peak-cut', borderColor: '#1DBFBF',
    desc: 'Tame harsh or piercing frequencies that can cause ear fatigue.',
    range: 'Try 5kHz – 8kHz',
  },
  {
    num: 5, label: 'LOW PASS', color: '#8B5CF6', color2: '#a78bfa',
    shape: 'lp', borderColor: '#8B5CF6',
    desc: 'Remove unnecessary high frequencies to create space for other instruments.',
    range: 'Try 10kHz – 20kHz',
  },
];

export function BandCard({ data }: { data: BandCardData }) {
  const { num, label, color, color2, shape, desc, range, borderColor } = data;
  return (
    <div style={{
      flex: '1 1 0', minWidth: 0,
      background: '#111118',
      border: `1px solid ${borderColor}55`,
      borderRadius: 10,
      padding: '14px 14px 12px',
      display: 'flex', flexDirection: 'column', gap: 10,
      boxShadow: `0 0 16px ${borderColor}18`,
    }}>
      {/* Header: number badge + label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          border: `2px solid ${color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, color,
          flexShrink: 0,
          background: `${color}18`,
        }}>{num}</div>
        <span style={{
          fontSize: 12, fontWeight: 800, color,
          letterSpacing: '0.08em', lineHeight: 1.2,
          textTransform: 'uppercase',
        }}>{label}</span>
      </div>

      {/* Mini curve */}
      <MiniCurve shape={shape} color={color} color2={color2} />

      {/* Description */}
      <p style={{ margin: 0, fontSize: 12, color: '#b0b3c8', lineHeight: 1.55 }}>
        {desc}
      </p>

      {/* Frequency hint */}
      <p style={{
        margin: 0, fontSize: 12, color: '#9B59B6',
        fontStyle: 'italic', letterSpacing: '0.02em',
      }}>{range}</p>
    </div>
  );
}
