/**
 * OperationsGrid — 5 EQ technique cards (R3 NATIVE spec §2.3)
 * Numbered green badges · mini curves · descriptions · freq ranges
 */

import { FilterType } from '../dsp';
import type { EQBand } from '../dsp';

type MiniShape = 'hp' | 'lp' | 'peak-cut' | 'peak-boost' | 'shelf-lo' | 'shelf-hi';

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
  num: number;
  name: string;
  desc: string;
  freqRange: string;
  shape: MiniShape;
  color: string;
  bandId: number;
  update: Partial<EQBand>;
}

const OPERATIONS: Operation[] = [
  {
    id: 'hp', num: 1,
    name: 'HIGH PASS',
    desc: 'Remove rumble and unwanted low frequencies.',
    freqRange: '20Hz – 100Hz',
    shape: 'hp',
    color: '#FF3CAC',
    bandId: 0,
    update: { enabled: true, type: FilterType.HighPass, frequency: 80, q: 0.7 },
  },
  {
    id: 'cut-mud', num: 2,
    name: 'CUT MUD',
    desc: 'Remove muddy frequencies for clarity.',
    freqRange: '200Hz – 500Hz',
    shape: 'peak-cut',
    color: '#FF6B35',
    bandId: 2,
    update: { enabled: true, type: FilterType.Peaking, frequency: 300, gain: -5, q: 1.2 },
  },
  {
    id: 'boost-presence', num: 3,
    name: 'BOOST PRESENCE',
    desc: 'Boost presence for clarity and definition.',
    freqRange: '2kHz – 5kHz',
    shape: 'peak-boost',
    color: '#47FFBA',
    bandId: 4,
    update: { enabled: true, type: FilterType.Peaking, frequency: 3000, gain: 3, q: 1.5 },
  },
  {
    id: 'remove-harsh', num: 4,
    name: 'REMOVE HARSH',
    desc: 'Reduce harsh or piercing frequencies.',
    freqRange: '5kHz – 8kHz',
    shape: 'peak-cut',
    color: '#7C4DFF',
    bandId: 5,
    update: { enabled: true, type: FilterType.Peaking, frequency: 5000, gain: -3, q: 2.0 },
  },
  {
    id: 'lp', num: 5,
    name: 'LOW PASS',
    desc: 'Remove unnecessary high frequencies.',
    freqRange: '10kHz – 20kHz',
    shape: 'lp',
    color: '#00D4FF',
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
      gap: 12,
      flexWrap: 'wrap',
    }}>
      {OPERATIONS.map(op => (
        <OperationCard key={op.id} op={op} onApply={() => onApply(op.bandId, op.update)} />
      ))}
    </div>
  );
}

function OperationCard({ op, onApply }: { op: Operation; onApply: () => void }) {
  const col = op.color;

  return (
    <button
      onClick={onApply}
      title={`Apply: ${op.name} — ${op.freqRange}`}
      style={{
        flex: '1 1 140px',
        minWidth: 130,
        maxWidth: 200,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 8,
        padding: '18px 12px 14px',
        paddingTop: 24,
        background: '#0F1219',
        border: '1px solid #242424',
        borderRadius: 8,
        cursor: 'pointer',
        outline: 'none',
        userSelect: 'none',
        textAlign: 'left',
        transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.borderColor = col;
        el.style.boxShadow = `0 4px 16px rgba(0,0,0,0.4), 0 0 12px ${col}33`;
        el.style.transform = 'translateY(-3px)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.borderColor = '#242424';
        el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4)';
        el.style.transform = 'translateY(0)';
      }}
      onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; }}
      onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-3px)'; }}
    >
      {/* Numbered badge */}
      <div style={{
        position: 'absolute',
        top: -10,
        left: -10,
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: col,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 14,
        fontWeight: 800,
        color: '#080808',
        boxShadow: `0 0 12px ${col}80`,
        fontFamily: 'Bebas Neue, Montserrat, sans-serif',
        zIndex: 2,
      }}>{op.num}</div>

      {/* Mini curve */}
      <svg
        width={80} height={28} viewBox="0 0 32 14"
        style={{ flexShrink: 0, overflow: 'visible' }}
      >
        <line x1="0" y1="7" x2="32" y2="7" stroke="#242424" strokeWidth="0.8" />
        {/* Glow layer */}
        <path
          d={MINI_PATHS[op.shape]}
          fill="none"
          stroke={col}
          strokeWidth="4"
          strokeOpacity="0.15"
          strokeLinecap="round"
        />
        {/* Main curve */}
        <path
          d={MINI_PATHS[op.shape]}
          fill="none"
          stroke={col}
          strokeWidth="2"
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 3px ${col}80)` }}
        />
      </svg>

      {/* Title */}
      <span style={{
        fontSize: 12,
        fontWeight: 800,
        color: '#FFFFFF',
        letterSpacing: '0.06em',
        fontFamily: 'Bebas Neue, Montserrat, sans-serif',
        lineHeight: 1.1,
      }}>{op.name}</span>

      {/* Description */}
      <span style={{
        fontSize: 10,
        color: '#B7B7C0',
        lineHeight: 1.45,
        fontFamily: 'Montserrat, sans-serif',
      }}>{op.desc}</span>

      {/* Frequency range */}
      <span style={{
        fontSize: 9,
        fontWeight: 600,
        color: col,
        letterSpacing: '0.04em',
        fontFamily: 'Montserrat, monospace, sans-serif',
        opacity: 0.8,
      }}>{op.freqRange}</span>
    </button>
  );
}
