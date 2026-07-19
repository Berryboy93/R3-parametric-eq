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
    color: '#FF3B30', // band 0 — red
    bandId: 0,
    update: { enabled: true, type: FilterType.HighPass, frequency: 80, q: 0.7 },
  },
  {
    id: 'cut-mud',
    name: 'Cut Mud',
    desc: 'Eliminate boxiness and low-mid buildup',
    detail: '300 Hz · −5 dB',
    shape: 'peak-cut',
    color: '#FFD633', // band 2 — yellow
    bandId: 2,
    update: { enabled: true, type: FilterType.Peaking, frequency: 300, gain: -5, q: 1.2 },
  },
  {
    id: 'boost-presence',
    name: 'Boost Presence',
    desc: 'Add cut-through clarity and vocal intelligibility',
    detail: '3 kHz · +3 dB',
    shape: 'peak-boost',
    color: '#00FF90', // band 4 — mint
    bandId: 4,
    update: { enabled: true, type: FilterType.Peaking, frequency: 3000, gain: 3, q: 1.5 },
  },
  {
    id: 'remove-harsh',
    name: 'Remove Harsh',
    desc: 'Tame aggressive high-mid bite and sibilance',
    detail: '4 kHz · −3 dB',
    shape: 'peak-cut',
    color: '#00C8FF', // band 5 — cyan
    bandId: 5,
    update: { enabled: true, type: FilterType.Peaking, frequency: 4000, gain: -3, q: 2.0 },
  },
  {
    id: 'lp',
    name: 'Low Pass',
    desc: 'Smooth out harsh high-frequency noise and hiss',
    detail: '16 kHz · 12 dB/oct',
    shape: 'lp',
    color: '#FF4DFF', // band 7 — magenta
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
  const col = op.color;
  return (
    <button
      onClick={onApply}
      title={`${op.desc} — ${op.detail}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '7px 14px 7px 10px',
        background: '#161616',
        border: `1px solid #2a2a2a`,
        borderTop: `1px solid #333333`,
        borderBottom: `1px solid #0e0e0e`,
        borderRadius: 6,
        cursor: 'pointer',
        outline: 'none',
        userSelect: 'none',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03), inset 0 -1px 0 rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.5)',
        transition: 'all 120ms',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.background = '#1e1e1e';
        el.style.borderColor = `${col}55`;
        el.style.borderTopColor = `${col}40`;
        el.style.boxShadow = `inset 0 1px 0 rgba(255,255,255,0.04), 0 0 12px ${col}18`;
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.background = '#161616';
        el.style.borderColor = '#2a2a2a';
        el.style.borderTopColor = '#333333';
        el.style.transform = '';
        el.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.03), inset 0 -1px 0 rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.5)';
      }}
      onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
      onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = ''; }}
    >
      {/* Mini EQ curve SVG */}
      <svg
        width={36} height={18} viewBox="0 0 32 14"
        style={{ flexShrink: 0, overflow: 'visible' }}
      >
        {/* Midline */}
        <line x1="0" y1="7" x2="32" y2="7" stroke="#2a2a2a" strokeWidth="0.8" />
        {/* Curve — glow + stroke */}
        <path d={MINI_PATHS[op.shape]} fill="none" stroke={col} strokeWidth="3.5" strokeOpacity="0.12" strokeLinecap="round" />
        <path d={MINI_PATHS[op.shape]} fill="none" stroke={col} strokeWidth="1.5" strokeLinecap="round" />
      </svg>

      {/* Text block */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{
          fontSize: 11, fontWeight: 700, color: '#D8D8D8',
          letterSpacing: '0.04em', whiteSpace: 'nowrap',
          lineHeight: 1,
        }}>{op.name}</span>
        <span style={{
          fontSize: 9, color: col, opacity: 0.7,
          letterSpacing: '0.03em', fontFamily: 'monospace',
          lineHeight: 1,
        }}>{op.detail}</span>
      </div>
    </button>
  );
}
