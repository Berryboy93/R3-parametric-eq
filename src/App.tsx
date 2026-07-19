/**
 * R3 NATIVE Parametric EQ — main app shell
 * Clean professional layout: header · EQ canvas · band strip · status bar
 */

import { useState, useEffect, useMemo } from 'react';
import { FruityEQCanvas } from './components/FruityEQCanvas';
import { BandStrip, BAND_COLORS } from './components/BandStrip';
import { useEQState } from './hooks/useEQState';
import { useAudioEngine } from './hooks/useAudioEngine';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { createFactoryPresets, FilterType } from './dsp';
import type { FrequencyResponsePoint, EQBand } from './dsp';
import './styles/theme.css';

const PRESETS     = createFactoryPresets();
const PRESET_LIST = Array.from(PRESETS.values());

const DB_LABELS = [18, 12, 6, 0, -6, -12, -18];
const FREQ_TICKS = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];

function fmtFreq(f: number) { return f >= 1000 ? `${f / 1000}k` : `${f}`; }

const TYPE_NAMES: Partial<Record<FilterType, string>> = {
  [FilterType.HighPass]:  'HIGH PASS',
  [FilterType.LowShelf]:  'LOW SHELF',
  [FilterType.Peaking]:   'PEAKING',
  [FilterType.HighShelf]: 'HIGH SHELF',
  [FilterType.LowPass]:   'LOW PASS',
};

// ── App ───────────────────────────────────────────────────────────────────────
export function App() {
  const { state, setState, updateBand, toggleBypass, reset, undo, redo, canUndo, canRedo, engine } =
    useEQState();

  const [selectedBand, setSelectedBand] = useState(0);
  const [activePreset, setActivePreset] = useState('flat');
  const [showHelp, setShowHelp]         = useState(false);

  useEffect(() => { engine.setState(state); }, [state, engine]);

  const curve = useMemo<FrequencyResponsePoint[]>(() => {
    engine.setState(state);
    return engine.getEQCurve(512);
  }, [state, engine]);

  const { isPlaying, play, stop, spectrumData } = useAudioEngine(state.bands, state.bypass);

  useKeyboardShortcuts({
    bands: state.bands, selectedBand, setSelectedBand,
    updateBand, toggleBypass, undo, redo, setShowHelp,
  });

  const handlePreset = (id: string) => {
    const p = PRESETS.get(id);
    if (p) { setState(p.state as any); setActivePreset(id); }
  };

  const handleDrag = (id: number, freq: number, gain: number) => {
    const b = state.bands.find(b => b.id === id);
    if (!b) return;
    const hasGain = b.type !== FilterType.HighPass && b.type !== FilterType.LowPass;
    updateBand(id, hasGain ? { frequency: freq, gain } : { frequency: freq });
  };

  const selBand = state.bands.find(b => b.id === selectedBand);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#09090f', overflow: 'hidden' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header style={{
        height: 46, flexShrink: 0,
        background: '#0d0d18',
        borderBottom: '1px solid #1a1a2a',
        display: 'flex', alignItems: 'center',
        padding: '0 16px', gap: 12,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginRight: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 900, color: '#B7FF00', letterSpacing: '0.12em' }}>R3</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#606070', letterSpacing: '0.18em' }}>NATIVE</span>
          <span style={{ fontSize: 10, color: '#303040', letterSpacing: '0.12em', marginLeft: 6 }}>PARAMETRIC EQ</span>
        </div>

        <div style={{ width: 1, height: 20, background: '#1e1e2e' }} />

        {/* Preset selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: '#484860', letterSpacing: '0.08em' }}>PRESET</span>
          <select
            value={activePreset}
            onChange={e => handlePreset(e.target.value)}
            style={{
              background: '#13131e', border: '1px solid #252535', borderRadius: 4,
              color: '#a0a0c0', fontSize: 11, padding: '3px 8px', cursor: 'pointer',
            }}
          >
            {PRESET_LIST.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div style={{ flex: 1 }} />

        {/* Transport controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Play / Stop */}
          <button
            onClick={isPlaying ? stop : play}
            title={isPlaying ? 'Stop pink noise' : 'Play pink noise through EQ'}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 14px', borderRadius: 5, cursor: 'pointer',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
              border: `1px solid ${isPlaying ? '#ef444488' : '#B7FF0088'}`,
              background: isPlaying ? 'rgba(239,68,68,0.12)' : 'rgba(183,255,0,0.1)',
              color: isPlaying ? '#ef4444' : '#B7FF00',
              transition: 'all 150ms',
            }}
          >
            <span style={{ fontSize: 8 }}>{isPlaying ? '■' : '▶'}</span>
            {isPlaying ? 'STOP' : 'PLAY'}
          </button>

          <div style={{ width: 1, height: 18, background: '#1e1e2e' }} />

          {/* Bypass */}
          <button
            onClick={toggleBypass}
            title="Toggle bypass (B)"
            style={{
              padding: '5px 12px', borderRadius: 5, cursor: 'pointer',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
              border: `1px solid ${state.bypass ? '#ef444466' : '#33334a'}`,
              background: state.bypass ? 'rgba(239,68,68,0.1)' : 'transparent',
              color: state.bypass ? '#ef4444' : '#484860',
              transition: 'all 150ms',
            }}
          >
            {state.bypass ? 'BYPASSED' : 'BYPASS'}
          </button>

          <div style={{ width: 1, height: 18, background: '#1e1e2e' }} />

          {/* Undo / Redo / Reset */}
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { icon: '↩', label: 'Undo (Ctrl+Z)', act: undo,  dis: !canUndo },
              { icon: '↪', label: 'Redo (Ctrl+Y)', act: redo,  dis: !canRedo },
              { icon: '⟳', label: 'Reset',         act: reset, dis: false    },
            ].map(b => (
              <button key={b.icon} onClick={b.act} disabled={b.dis} title={b.label} style={{
                width: 28, height: 28, borderRadius: 4, cursor: b.dis ? 'not-allowed' : 'pointer',
                background: '#111120', border: '1px solid #1e1e2e',
                color: b.dis ? '#282838' : '#606080', fontSize: 13,
              }}>{b.icon}</button>
            ))}
          </div>

          <div style={{ width: 1, height: 18, background: '#1e1e2e' }} />

          <button onClick={() => setShowHelp(v => !v)} title="Keyboard shortcuts (?)" style={{
            width: 28, height: 28, borderRadius: 4, cursor: 'pointer',
            background: '#111120', border: '1px solid #1e1e2e', color: '#606080', fontSize: 13,
          }}>?</button>
        </div>
      </header>

      {/* ── EQ display ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '10px 16px 0' }}>

        {/* Frequency axis labels */}
        <div style={{ position: 'relative', height: 18, marginLeft: 36 }}>
          {FREQ_TICKS.map(f => {
            const pct = (Math.log10(f / 20) / Math.log10(20000 / 20)) * 100;
            return (
              <span key={f} style={{
                position: 'absolute', left: `${pct}%`,
                fontSize: 9, color: '#404055',
                transform: 'translateX(-50%)',
                letterSpacing: '0.04em',
              }}>{fmtFreq(f)}</span>
            );
          })}
        </div>

        {/* dB rail + canvas */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 0 }}>
          {/* dB labels */}
          <div style={{
            width: 36, flexShrink: 0,
            display: 'flex', flexDirection: 'column', justifyContent: 'space-around',
            paddingBottom: 2,
          }}>
            {DB_LABELS.map(db => (
              <span key={db} style={{
                fontSize: 9, color: db === 0 ? '#606070' : '#383848',
                textAlign: 'right', paddingRight: 6,
                fontFamily: 'monospace',
              }}>
                {db > 0 ? `+${db}` : db}
              </span>
            ))}
          </div>

          {/* Canvas */}
          <div style={{
            flex: 1, minWidth: 0,
            border: '1px solid #1a1a2a',
            borderRadius: 6,
            overflow: 'hidden',
            background: '#0b0b12',
          }}>
            <FruityEQCanvas
              curve={curve}
              bands={state.bands}
              selectedBand={selectedBand}
              onSelectBand={setSelectedBand}
              onBandDrag={handleDrag}
              bypass={state.bypass}
              liveSpectrum={spectrumData}
            />
          </div>
        </div>
      </div>

      {/* ── Band strip ─────────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0 }}>
        <BandStrip
          bands={state.bands}
          selectedBand={selectedBand}
          onSelectBand={setSelectedBand}
          onUpdate={(id, u) => updateBand(id, u)}
        />
      </div>

      {/* ── Status bar ─────────────────────────────────────────────────────── */}
      <div style={{
        height: 26, flexShrink: 0,
        background: '#0d0d18', borderTop: '1px solid #1a1a2a',
        display: 'flex', alignItems: 'center',
        padding: '0 16px', gap: 16,
      }}>
        {/* Selected band info */}
        {selBand && (
          <>
            <span style={{
              width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
              background: BAND_COLORS[selBand.id],
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 8, fontWeight: 800, color: '#000',
            }}>{selBand.id + 1}</span>
            <span style={{ fontSize: 10, color: '#606070', letterSpacing: '0.06em' }}>
              {TYPE_NAMES[selBand.type]}
            </span>
            <Dot />
            <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#8080a0' }}>
              {selBand.frequency >= 1000
                ? `${(selBand.frequency / 1000).toFixed(2)} kHz`
                : `${Math.round(selBand.frequency)} Hz`}
            </span>
            {selBand.type !== FilterType.HighPass && selBand.type !== FilterType.LowPass && (
              <>
                <Dot />
                <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#8080a0' }}>
                  {selBand.gain >= 0 ? '+' : ''}{selBand.gain.toFixed(1)} dB
                </span>
              </>
            )}
            <Dot />
            <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#8080a0' }}>
              Q {selBand.q.toFixed(2)}
            </span>
            <Dot />
            <span style={{ fontSize: 10, color: selBand.enabled ? '#4ade8066' : '#ef444466' }}>
              {selBand.enabled ? 'ON' : 'OFF'}
            </span>
          </>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 9, color: '#303040', letterSpacing: '0.06em' }}>
          TAB · ARROWS · B · E · ?
        </span>
      </div>

      {/* ── Shortcut help overlay ───────────────────────────────────────────── */}
      {showHelp && <ShortcutOverlay onClose={() => setShowHelp(false)} />}
    </div>
  );
}

function Dot() {
  return <span style={{ color: '#2a2a3a', fontSize: 10 }}>·</span>;
}

// ── Shortcut help ─────────────────────────────────────────────────────────────
function ShortcutOverlay({ onClose }: { onClose: () => void }) {
  const rows: [string, string][] = [
    ['Tab / Shift+Tab',      'Cycle through bands'],
    ['← / →',               'Nudge frequency ×1.05'],
    ['Shift+← / →',         'Nudge frequency ×1.3'],
    ['↑ / ↓',               'Nudge gain ±0.5 dB'],
    ['Shift+↑ / ↓',         'Nudge gain ±3 dB'],
    ['E',                    'Toggle band on / off'],
    ['B',                    'Toggle bypass'],
    ['Ctrl+Z',               'Undo'],
    ['Ctrl+Y / Ctrl+Shift+Z','Redo'],
    ['?',                    'Toggle this panel'],
  ];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0f0f1c', border: '1px solid #252538',
          borderRadius: 10, padding: '22px 26px', minWidth: 380,
          boxShadow: '0 12px 60px rgba(0,0,0,0.7)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#606080', letterSpacing: '0.14em' }}>KEYBOARD SHORTCUTS</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#404050', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {rows.map(([k, d]) => (
              <tr key={k} style={{ borderBottom: '1px solid #13131e' }}>
                <td style={{ padding: '6px 14px 6px 0', whiteSpace: 'nowrap' }}>
                  <kbd style={{
                    background: '#13131e', border: '1px solid #252535',
                    borderRadius: 4, padding: '2px 8px',
                    fontSize: 10, color: '#8080a0', fontFamily: 'monospace',
                  }}>{k}</kbd>
                </td>
                <td style={{ fontSize: 11, color: '#606070', padding: '6px 0' }}>{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ margin: '14px 0 0', fontSize: 10, color: '#303040', textAlign: 'center' }}>
          click outside or press <kbd style={{ background: '#13131e', border: '1px solid #252535', borderRadius: 3, padding: '1px 6px', fontSize: 9, color: '#606070' }}>?</kbd> to close
        </p>
      </div>
    </div>
  );
}
