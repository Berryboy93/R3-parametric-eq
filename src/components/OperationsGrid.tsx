/**
 * OperationsGrid — 5 metallic quick-apply EQ buttons
 */

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
    color: '#9978C8',  // pewter violet
    bandId: 0,
    update: { enabled: true, type: FilterType.HighPass, frequency: 80, q: 0.7 },
  },
  {
    id: 'cut-mud',
    name: 'Cut Mud',
    desc: 'Eliminate boxiness and low-mid buildup',
    detail: '300 Hz · −5 dB',
    shape: 'peak-cut',
    color: '#C96A55',  // iron oxide
    bandId: 2,
    update: { enabled: true, type: FilterType.Peaking, frequency: 300, gain: -5, q: 1.2 },
  },
  {
    id: 'boost-presence',
    name: 'Boost Presence',
    desc: 'Add cut-through clarity and vocal intelligibility',
    detail: '3 kHz · +3 dB',
    shape: 'peak-boost',
    color: '#76A876',  // verdigris
    bandId: 4,
    update: { enabled: true, type: FilterType.Peaking, frequency: 3000, gain: 3, q: 1.5 },
  },
  {
    id: 'remove-harsh',
    name: 'Remove Harsh',
    desc: 'Tame aggressive high-mid bite and sibilance',
    detail: '4 kHz · −3 dB',
    shape: 'peak-cut',
    color: '#7AAABB',  // steel blue
    bandId: 5,
    update: { enabled: true, type: FilterType.Peaking, frequency: 4000, gain: -3, q: 2.0 },
  },
  {
    id: 'lp',
    name: 'Low Pass',
    desc: 'Smooth out harsh high-frequency noise and hiss',
    detail: '16 kHz · 12 dB/oct',
    shape: 'lp',
    color: '#B8924A',  // aged bronze
    bandId: 7,
    update: { enabled: true, type: FilterType.LowPass, frequency: 16000, q: 0.7 },
  },
];

interface Props {
  onApply: (bandId: number, update: Partial<EQBand>) => void;
}

export function OperationsGrid({ onApply }: Props) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
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
        padding: '6px 14px',
        background: 'linear-gradient(180deg,#3a3530 0%,#252220 55%,#2e2825 100%)',
        border: `1px solid #4a4440`,
        borderTop: `1px solid #5a5450`,
        borderBottom: `1px solid #1a1612`,
        borderRadius: 5,
        cursor: 'pointer',
        outline: 'none',
        userSelect: 'none',
        boxShadow: 'inset 0 1px 0 rgba(255,235,200,0.07), inset 0 -1px 0 rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.55)',
        transition: 'box-shadow 80ms, filter 80ms',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.filter = 'brightness(1.15)';
        el.style.borderColor = `${op.color}60`;
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.filter = '';
        el.style.borderColor = '#4a4440';
        el.style.transform = 'scale(1)';
      }}
      onMouseDown={e => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.transform = 'scale(0.97)';
        el.style.boxShadow = 'inset 0 2px 5px rgba(0,0,0,0.7), 0 0 6px rgba(196,134,42,0.15)';
      }}
      onMouseUp={e => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.transform = 'scale(1)';
        el.style.boxShadow = 'inset 0 1px 0 rgba(255,235,200,0.07), inset 0 -1px 0 rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.55)';
      }}
    >
      {/* Rivet indicator dot */}
      <span style={{
        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
        background: `radial-gradient(circle at 35% 35%, ${op.color}dd, ${op.color}88)`,
        boxShadow: `0 0 5px ${op.color}60, inset 0 1px 0 rgba(255,255,255,0.2)`,
      }} />
      {/* Label */}
      <span style={{
        fontSize: 11, fontWeight: 700, color: '#c8c0b4',
        letterSpacing: '0.05em', whiteSpace: 'nowrap',
        fontFamily: 'Montserrat, sans-serif',
        textShadow: '0 1px 1px rgba(0,0,0,0.6)',
      }}>
        {op.name}
      </span>
      {/* Detail */}
      <span style={{
        fontSize: 9, fontFamily: 'monospace',
        color: op.color, opacity: 0.75, letterSpacing: '0.03em',
      }}>
        {op.detail}
      </span>
    </button>
  );
}
