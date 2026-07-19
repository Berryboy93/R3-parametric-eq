/**
 * BandStrip — horizontal row of 8 compact per-band control cards
 * Smoky metallic aesthetic
 */

import { useRef } from 'react';
import { FilterType } from '../dsp';
import type { EQBand } from '../dsp';

export const BAND_COLORS = [
  '#CF8A3A', // 1 — warm copper
  '#7AAABB', // 2 — steel blue
  '#76A876', // 3 — verdigris
  '#C9A840', // 4 — aged brass
  '#C96A55', // 5 — iron oxide
  '#5B98C8', // 6 — gunmetal blue
  '#9978C8', // 7 — tarnished pewter
  '#B8924A', // 8 — aged bronze
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
  const color = BAND_COLORS[band.id] ?? '#C4862A';
  const hasGain = band.type !== FilterType.HighPass && band.type !== FilterType.LowPass;

  return (
    <div
      onClick={onSelect}
      style={{
        flex: 1, minWidth: 0,
        background: selected
          ? `linear-gradient(180deg,#252018 0%,#1e1c16 100%)`
          : `linear-gradient(180deg,#1c1a16 0%,#161410 100%)`,
        border: `1px solid ${selected ? color + '70' : '#3a3530'}`,
        borderRadius: 6,
        padding: '8px 8px 6px',
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: 5,
        boxShadow: selected
          ? `inset 0 1px 0 rgba(255,235,200,0.06), 0 0 10px ${color}18`
          : 'inset 0 1px 0 rgba(255,235,200,0.04)',
        transition: 'all 150ms',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{
          width: 18, height: 18, borderRadius: '50%',
          background: band.enabled
            ? `radial-gradient(circle at 35% 35%,${color}cc,${color}66)`
            : '#2c2825',
          border: `1px solid ${band.enabled ? color + '80' : '#3a3530'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 800,
          color: band.enabled ? '#0a0908' : '#524c47',
          flexShrink: 0, cursor: 'pointer', transition: 'all 150ms',
          boxShadow: band.enabled ? `0 0 4px ${color}40` : 'none',
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
            <option key={o.value} value={o.value} style={{ background: '#1e1b18', color: '#d8d0c4' }}>
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
        <span style={{ fontSize: 7, color: '#524c47', letterSpacing: '0.08em', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 9, color: '#a09080', fontFamily: 'monospace' }}>
          {display}<span style={{ fontSize: 7, color: '#524c47', marginLeft: 1 }}>{unit}</span>
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
