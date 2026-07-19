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
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
      gap: 10,
    }}>
      {OPERATIONS.map(op => (
        <OperationCard key={op.id} op={op} onApply={() => onApply(op.bandId, op.update)} />
      ))}
    </div>
  );
}

function OperationCard({ op, onApply }: { op: Operation; onApply: () => void }) {
  return (
    <div
      onClick={onApply}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onApply()}
      style={{
        background: '#0a0a14',
        border: '1px solid #1a1a2a',
        borderTop: `2px solid ${op.color}50`,
        borderRadius: '0 0 8px 8px',
        overflow: 'hidden',
        cursor: 'pointer',
        outline: 'none',
        transition: 'transform 100ms',
        userSelect: 'none',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = `${op.color}55`;
        el.style.background = '#0d0d1a';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = '#1a1a2a';
        el.style.background = '#0a0a14';
      }}
      onMouseDown={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(0.98)'; }}
      onMouseUp={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'; }}
    >
      {/* Mini EQ curve preview */}
      <MiniCurve shape={op.shape} color={op.color} />

      {/* Card body */}
      <div style={{ padding: '10px 12px 14px' }}>
        <div style={{
          fontSize: 12, fontWeight: 800, color: '#d0d0e8',
          marginBottom: 4, letterSpacing: '0.03em',
        }}>
          {op.name}
        </div>
        <div style={{
          fontSize: 10, color: '#484860', lineHeight: 1.55,
          marginBottom: 10,
        }}>
          {op.desc}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{
            fontSize: 9, fontFamily: 'monospace',
            color: op.color, letterSpacing: '0.04em',
          }}>
            {op.detail}
          </span>
          <span style={{
            fontSize: 9, fontWeight: 800, color: op.color,
            letterSpacing: '0.08em', opacity: 0.65,
          }}>
            APPLY →
          </span>
        </div>
      </div>
    </div>
  );
}
