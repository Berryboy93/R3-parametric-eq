/**
 * OperationsGrid — 5 quick-apply EQ operation cards
 * PRD §9.3: High Pass · Cut Mud · Boost Presence · Remove Harsh · Low Pass
 */

import { MiniCurve } from './MiniCurve';
import { FilterType } from '../dsp';
import type { EQBand } from '../dsp';

type MiniShape = 'hp' | 'lp' | 'peak-cut' | 'peak-boost' | 'shelf-lo' | 'shelf-hi';

interface Operation {
  id: string;
  name: string;
  desc: string;
  detail: string;
  shape: MiniShape;
  color: string;
  bandId: number;
  update: Partial<EQBand>;
}

const OPERATIONS: Operation[] = [
  {
    id: 'hp',
    name: 'High Pass',
    desc: 'Remove low-end rumble & noise below the mix',
    detail: '80 Hz · 12 dB/oct',
    shape: 'hp',
    color: '#c084fc',
    bandId: 0,
    update: { enabled: true, type: FilterType.HighPass, frequency: 80, q: 0.7 },
  },
  {
    id: 'cut-mud',
    name: 'Cut Mud',
    desc: 'Eliminate boxiness and low-mid buildup',
    detail: '300 Hz · −5 dB',
    shape: 'peak-cut',
    color: '#fb923c',
    bandId: 2,
    update: { enabled: true, type: FilterType.Peaking, frequency: 300, gain: -5, q: 1.2 },
  },
  {
    id: 'boost-presence',
    name: 'Boost Presence',
    desc: 'Add cut-through clarity and vocal intelligibility',
    detail: '3 kHz · +3 dB',
    shape: 'peak-boost',
    color: '#4ade80',
    bandId: 4,
    update: { enabled: true, type: FilterType.Peaking, frequency: 3000, gain: 3, q: 1.5 },
  },
  {
    id: 'remove-harsh',
    name: 'Remove Harsh',
    desc: 'Tame aggressive high-mid bite and sibilance',
    detail: '4 kHz · −3 dB',
    shape: 'peak-cut',
    color: '#22d3ee',
    bandId: 5,
    update: { enabled: true, type: FilterType.Peaking, frequency: 4000, gain: -3, q: 2.0 },
  },
  {
    id: 'lp',
    name: 'Low Pass',
    desc: 'Smooth out harsh high-frequency noise and hiss',
    detail: '16 kHz · 12 dB/oct',
    shape: 'lp',
    color: '#a78bfa',
    bandId: 7,
    update: { enabled: true, type: FilterType.LowPass, frequency: 16000, q: 0.7 },
  },
];

interface Props {
  onApply: (bandId: number, update: Partial<EQBand>) => void;
}

export function OperationsGrid({ onApply }: Props) {
  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8,
    }}>
      {OPERATIONS.map(op => (
        <OperationButton key={op.id} op={op} onApply={() => onApply(op.bandId, op.update)} />
      ))}
    </div>
  );
}

function OperationButton({ op, onApply }: { op: Operation; onApply: () => void }) {
  return (
    <button
      onClick={onApply}
      title={`${op.desc} — ${op.detail}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: '#0a0a14',
        border: `1px solid ${op.color}30`,
        borderRadius: 6,
        padding: '6px 14px',
        cursor: 'pointer',
        outline: 'none',
        transition: 'background 80ms, border-color 80ms, transform 80ms',
        userSelect: 'none',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.background = '#0d0d1c';
        el.style.borderColor = `${op.color}70`;
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.background = '#0a0a14';
        el.style.borderColor = `${op.color}30`;
        el.style.transform = 'scale(1)';
      }}
      onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.96)'; }}
      onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
    >
      {/* Color dot */}
      <span style={{
        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
        background: op.color,
        boxShadow: `0 0 6px ${op.color}80`,
      }} />
      {/* Label */}
      <span style={{
        fontSize: 11, fontWeight: 700, color: '#c0c0d8',
        letterSpacing: '0.04em', whiteSpace: 'nowrap',
        fontFamily: 'Montserrat, sans-serif',
      }}>
        {op.name}
      </span>
      {/* Detail */}
      <span style={{
        fontSize: 9, fontFamily: 'monospace',
        color: op.color, opacity: 0.7, letterSpacing: '0.03em',
      }}>
        {op.detail}
      </span>
    </button>
  );
}
