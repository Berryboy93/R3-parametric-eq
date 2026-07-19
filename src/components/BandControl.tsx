/**
 * BandControl — Controls for a single EQ band
 */

import type { EQBand } from '../dsp';
import { FilterType, getFilterTypeName, getFilterTypeFullName } from '../dsp';
import { BAND_COLORS } from './EQDisplay';

const FILTER_TYPES = [
  FilterType.HighPass,
  FilterType.LowShelf,
  FilterType.Peaking,
  FilterType.HighShelf,
  FilterType.LowPass,
];

interface BandControlProps {
  band: EQBand;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<EQBand>) => void;
}

function formatFreq(f: number): string {
  if (f >= 1000) return `${(f / 1000).toFixed(f >= 10000 ? 0 : 1)}k`;
  return `${Math.round(f)}`;
}

export function BandControl({ band, isSelected, onSelect, onUpdate }: BandControlProps) {
  const color = BAND_COLORS[band.id] || '#B7FF00';
  const showGain = band.type !== FilterType.HighPass && band.type !== FilterType.LowPass;

  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: '10px 8px',
        background: isSelected ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${isSelected ? color : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 8,
        cursor: 'pointer',
        minWidth: 80,
        flex: '1 1 0',
        boxSizing: 'border-box',
        transition: 'all 150ms ease',
        userSelect: 'none',
      }}
    >
      {/* Band indicator + enable toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'space-between' }}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%',
          background: band.enabled ? color : 'rgba(255,255,255,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700, color: '#000', flexShrink: 0,
          transition: 'background 150ms',
        }}>
          {band.id + 1}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onUpdate({ enabled: !band.enabled }); }}
          title={band.enabled ? 'Disable band' : 'Enable band'}
          style={{
            width: 28, height: 16, borderRadius: 8, border: 'none', cursor: 'pointer',
            background: band.enabled ? color : 'rgba(255,255,255,0.15)',
            position: 'relative', transition: 'background 150ms',
          }}
        >
          <span style={{
            position: 'absolute', width: 12, height: 12, borderRadius: '50%',
            background: '#fff', top: 2,
            left: band.enabled ? 14 : 2,
            transition: 'left 150ms',
          }} />
        </button>
      </div>

      {/* Filter type selector */}
      <select
        value={band.type}
        onClick={e => e.stopPropagation()}
        onChange={e => { onUpdate({ type: e.target.value as FilterType }); }}
        title="Filter type"
        style={{
          background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 4, color: '#e6e6e6', fontSize: 10, padding: '2px 4px',
          width: '100%', cursor: 'pointer',
        }}
      >
        {FILTER_TYPES.map(t => (
          <option key={t} value={t}>{getFilterTypeFullName(t)}</option>
        ))}
      </select>

      {/* Frequency */}
      <div style={{ width: '100%' }}>
        <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#999', marginBottom: 2 }}>
          <span>FREQ</span>
          <span style={{ color: '#e6e6e6' }}>{formatFreq(band.frequency)}Hz</span>
        </label>
        <input
          type="range"
          min={20} max={20000} step={1}
          value={band.frequency}
          onClick={e => e.stopPropagation()}
          onChange={e => onUpdate({ frequency: Number(e.target.value) })}
          style={{ width: '100%', accentColor: color }}
          title={`${Math.round(band.frequency)} Hz`}
        />
      </div>

      {/* Gain — hidden for HP/LP */}
      {showGain && (
        <div style={{ width: '100%' }}>
          <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#999', marginBottom: 2 }}>
            <span>GAIN</span>
            <span style={{ color: band.gain > 0 ? '#B7FF00' : band.gain < 0 ? '#F06292' : '#e6e6e6' }}>
              {band.gain > 0 ? '+' : ''}{band.gain.toFixed(1)}dB
            </span>
          </label>
          <input
            type="range"
            min={-24} max={24} step={0.1}
            value={band.gain}
            onClick={e => e.stopPropagation()}
            onChange={e => onUpdate({ gain: Number(e.target.value) })}
            style={{ width: '100%', accentColor: color }}
            title={`${band.gain > 0 ? '+' : ''}${band.gain.toFixed(1)} dB`}
          />
        </div>
      )}

      {/* Q */}
      {band.type === FilterType.Peaking && (
        <div style={{ width: '100%' }}>
          <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#999', marginBottom: 2 }}>
            <span>Q</span>
            <span style={{ color: '#e6e6e6' }}>{band.q.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min={0.1} max={12} step={0.05}
            value={band.q}
            onClick={e => e.stopPropagation()}
            onChange={e => onUpdate({ q: Number(e.target.value) })}
            style={{ width: '100%', accentColor: color }}
            title={`Q = ${band.q.toFixed(2)}`}
          />
        </div>
      )}
    </div>
  );
}
