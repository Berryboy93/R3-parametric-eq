/**
 * OperationsGrid — 5 quick-apply EQ buttons
 * R3 NATIVE RFQ-official color system
 */

import { FilterType } from '../dsp';
import type { EQBand } from '../dsp';

type MiniShape = 'hp' | 'lp' | 'peak-cut' | 'peak-boost' | 'shelf-lo' | 'shelf-hi';

// Spec §2.3 — mini curve paths (32×14 viewBox, midline at y=7)
const MINI_PATHS: Record<MiniShape, string> = {
  'hp':         'M0,13 C6,13 10,1 15,1 L32,1',
  'lp':         'M0,1 L17,1 C22,1 26,13 32,13',
  'peak-cut':   'M0,7 L9,7 C12,7 13,12 16,12 C19,12 20,7 23,7 L32,7',
  'peak-boost': 'M0,7 L9,7 C12,7 13,2 16,2 C19,2 20,7 23,7 L32,7',
  'shelf-lo':   'M0,3 C5,3 8,10 13,10 L32,10',
  'shelf-hi':   'M0,10 L19,10 C24,10 27,3 32,3',
};

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
    color: '#B7FF00',
    bandId: 0,
    update: { enabled: true, type: FilterType.HighPass, frequency: 80, q: 0.7 },
  },
  {
    id: 'cut-mud',
    name: 'Cut Mud',
    desc: 'Eliminate boxiness and low-mid buildup',
    detail: '300 Hz · −5 dB',
    shape: 'peak-cut',
    color: '#B7FF00',
    bandId: 2,
    update: { enabled: true, type: FilterType.Peaking, frequency: 300, gain: -5, q: 1.2 },
  },
  {
    id: 'boost-presence',
    name: 'Boost Presence',
    desc: 'Add cut-through clarity and vocal intelligibility',
    detail: '3 kHz · +3 dB',
    shape: 'peak-boost',
    color: '#B7FF00',
    bandId: 4,
    update: { enabled: true, type: FilterType.Peaking, frequency: 3000, gain: 3, q: 1.5 },
  },
  {
    id: 'remove-harsh',
    name: 'Remove Harsh',
    desc: 'Tame aggressive high-mid bite and sibilance',
    detail: '4 kHz · −3 dB',
    shape: 'peak-cut',
    color: '#B7FF00',
    bandId: 5,
    update: { enabled: true, type: FilterType.Peaking, frequency: 4000, gain: -3, q: 2.0 },
  },
  {
    id: 'lp',
    name: 'Low Pass',
    desc: 'Smooth out harsh high-frequency noise and hiss',
    detail: '16 kHz · 12 dB/oct',
    shape: 'lp',
    color: '#B7FF00',
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
        background: '#1a1a1a',
        border: `1px solid #2e2e2e`,
        borderTop: `1px solid #3a3a3a`,
        borderBottom: `1px solid #111111`,
        borderRadius: 5,
        cursor: 'pointer',
        outline: 'none',
        userSelect: 'none',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.6)',
        transition: 'box-shadow 80ms, filter 80ms, border-color 80ms',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.filter = 'brightness(1.2)';
        el.style.borderColor = 'rgba(183,255,0,0.50)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.filter = '';
        el.style.borderColor = '#2e2e2e';
        el.style.transform = 'scale(1)';
      }}
      onMouseDown={e => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.transform = 'scale(0.97)';
        el.style.boxShadow = 'inset 0 2px 5px rgba(0,0,0,0.7), 0 0 6px rgba(183,255,0,0.12)';
      }}
      onMouseUp={e => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.transform = 'scale(1)';
        el.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.6)';
      }}
    >
      {/* Neon indicator dot */}
      <span style={{
        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
        background: `radial-gradient(circle at 35% 35%, #d4ff40, #B7FF00)`,
        boxShadow: `0 0 6px rgba(183,255,0,0.60)`,
      }} />
      {/* Label */}
      <span style={{
        fontSize: 11, fontWeight: 700, color: '#E6E6E6',
        letterSpacing: '0.05em', whiteSpace: 'nowrap',
        fontFamily: 'Montserrat, sans-serif',
      }}>
        {op.name}
      </span>
      {/* Detail */}
      <span style={{
        fontSize: 9, fontFamily: 'monospace',
        color: '#B7FF00', opacity: 0.65, letterSpacing: '0.03em',
      }}>
        {op.detail}
      </span>
    </button>
  );
}
