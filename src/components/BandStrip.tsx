/**
 * BandStrip — horizontal row of 8 compact per-band control cards
 * R3 NATIVE RFQ-official color system
 */

import { useRef } from 'react';
import { FilterType } from '../dsp';
import type { EQBand } from '../dsp';

// All bands use Neon Green per R3 NATIVE brand spec (RFQ v1.0)
// Frequency-spectrum color scale: warm (low) → cool (high)
export const BAND_COLORS = [
  '#FF3B30', // 1 HP  — Red        (~80 Hz, sub bass)
  '#FF8C1A', // 2 LS  — Orange     (~100 Hz, bass)
  '#FFD633', // 3 PK  — Yellow     (~300 Hz, low mid)
  '#B7FF00', // 4 PK  — Neon Green (~1 kHz, mid) [brand]
  '#00FF90', // 5 PK  — Mint       (~3 kHz, upper mid)
  '#00C8FF', // 6 PK  — Cyan       (~6 kHz, presence)
  '#A14BFF', // 7 HS  — Violet     (~10 kHz, air)
  '#FF4DFF', // 8 LP  — Magenta    (~18 kHz, high)
];

const TYPE_LABELS: Record<FilterType, string> = {
  [FilterType.HighPass]:  'HP',
  [FilterType.LowShelf]:  'LS',
  [FilterType.Peaking]:   'PK',
  [FilterType.HighShelf]: 'HS',
  [FilterType.LowPass]:   'LP',
};
const TYPE_OPTIONS = [
  { value: FilterType.HighPass,  label: 'High Pass'  },
  { value: FilterType.LowShelf,  label: 'Low Shelf'  },
  { value: FilterType.Peaking,   label: 'Peaking'    },
  { value: FilterType.HighShelf, label: 'High Shelf' },
  { value: FilterType.LowPass,   label: 'Low Pass'   },
];

function fmtFreq(f: number) {
  return f >= 1000 ? `${(f / 1000).toFixed(f >= 10000 ? 0 : 1)}k` : `${Math.round(f)}`;
}
function fmtGain(g: number) { return `${g >= 0 ? '+' : ''}${g.toFixed(1)}`; }
function fmtQ(q: number)    { return q.toFixed(2); }

interface BandCardProps {
  band: EQBand;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (u: Partial<EQBand>) => void;
}

export function BandStrip({ bands, selectedBand, onSelectBand, onUpdate }: {
  bands: readonly EQBand[];
  selectedBand: number;
  onSelectBand: (id: number) => void;
  onUpdate: (id: number, u: Partial<EQBand>) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 6, padding: '10px 16px 12px' }}>
      {bands.map(b => (
        <BandCard
          key={b.id}
          band={b}
          selected={b.id === selectedBand}
          onSelect={() => onSelectBand(b.id)}
          onUpdate={u => onUpdate(b.id, u)}
        />
      ))}
    </div>
  );
}

function BandCard({ band, selected, onSelect, onUpdate }: BandCardProps) {
  const color = BAND_COLORS[band.id] ?? '#B7FF00';
  const hasGain = band.type !== FilterType.HighPass && band.type !== FilterType.LowPass;

  return (
    <div
      onClick={onSelect}
      style={{
        flex: 1, minWidth: 0,
        background: selected
          ? `${color}0d`   /* 5% tint of the band's own color */
          : `#141414`,
        border: `1px solid ${selected ? color + '80' : '#242424'}`,
        borderTop: `1px solid ${selected ? color + '55' : '#2e2e2e'}`,
        borderRadius: 6,
        padding: '8px 8px 6px',
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: 5,
        boxShadow: selected
          ? `inset 0 1px 0 ${color}14, 0 0 12px ${color}12`
          : 'none',
        transition: 'all 150ms',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{
          width: 18, height: 18, borderRadius: '50%',
          background: band.enabled
            ? `radial-gradient(circle at 35% 35%,${color}cc,${color}66)`
            : '#242424',
          border: `1px solid ${band.enabled ? color + '80' : '#2a2a2a'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 800,
          color: band.enabled ? '#080808' : '#484848',
          flexShrink: 0, cursor: 'pointer', transition: 'all 150ms',
          boxShadow: band.enabled ? `0 0 6px ${color}40` : 'none',
        }}
          onClick={e => { e.stopPropagation(); onUpdate({ enabled: !band.enabled }); }}
          title={band.enabled ? 'Click to disable' : 'Click to enable'}
        >{band.id + 1}</span>

        <select
          value={band.type}
          onChange={e => { e.stopPropagation(); onUpdate({ type: Number(e.target.value) as unknown as FilterType }); }}
          onClick={e => e.stopPropagation()}
          style={{
            flex: 1, background: 'transparent', border: 'none',
            color: color, fontSize: 9, fontWeight: 700, cursor: 'pointer',
            letterSpacing: '0.06em',
          }}
        >
          {TYPE_OPTIONS.map(o => (
            <option key={o.value} value={o.value} style={{ background: '#141414', color: '#E6E6E6' }}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <SliderRow
        label="FREQ"
        value={band.frequency}
        display={fmtFreq(band.frequency)}
        unit={band.frequency >= 1000 ? 'kHz' : 'Hz'}
        min={20} max={20000} step={1}
        color={color}
        logScale
        onChange={v => onUpdate({ frequency: v })}
        onClick={e => e.stopPropagation()}
      />

      {hasGain && (
        <SliderRow
          label="GAIN"
          value={band.gain}
          display={fmtGain(band.gain)}
          unit="dB"
          min={-24} max={24} step={0.1}
          color={color}
          onChange={v => onUpdate({ gain: v })}
          onClick={e => e.stopPropagation()}
        />
      )}

      <SliderRow
        label="Q"
        value={band.q}
        display={fmtQ(band.q)}
        unit=""
        min={0.1} max={24} step={0.01}
        color={color}
        logScale
        onChange={v => onUpdate({ q: v })}
        onClick={e => e.stopPropagation()}
      />
    </div>
  );
}

function SliderRow({ label, value, display, unit, min, max, step, color, logScale, onChange, onClick }: {
  label: string; value: number; display: string; unit: string;
  min: number; max: number; step: number; color: string;
  logScale?: boolean;
  onChange: (v: number) => void;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const toSlider   = (v: number) => logScale
    ? Math.round((Math.log(v / min) / Math.log(max / min)) * 1000)
    : Math.round(((v - min) / (max - min)) * 1000);
  const fromSlider = (s: number) => logScale
    ? min * Math.pow(max / min, s / 1000)
    : min + (s / 1000) * (max - min);

  return (
    <div onClick={onClick} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 7, color: '#484848', letterSpacing: '0.08em', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 9, color: '#909090', fontFamily: 'monospace' }}>
          {display}<span style={{ fontSize: 7, color: '#484848', marginLeft: 1 }}>{unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={0} max={1000} step={1}
        value={toSlider(value)}
        onChange={e => onChange(fromSlider(Number(e.target.value)))}
        style={{ width: '100%', accentColor: color, height: 2, cursor: 'ew-resize' }}
      />
    </div>
  );
}
