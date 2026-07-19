/**
 * R3 NATIVE Parametric EQ — Demo App
 */

import { useState, useEffect, useMemo } from 'react';
import { EQDisplay } from './components/EQDisplay';
import { BandControl } from './components/BandControl';
import { useEQState } from './hooks/useEQState';
import { createParametricEQ, createFactoryPresets } from './dsp';
import type { FrequencyResponsePoint, EQBand } from './dsp';
import './styles/theme.css';

const PRESETS = createFactoryPresets();
const PRESET_LIST = Array.from(PRESETS.values());

export function App() {
  const { state, setState, updateBand, toggleBypass, reset, undo, redo, canUndo, canRedo, engine } = useEQState();
  const [selectedBand, setSelectedBand] = useState<number | null>(0);
  const [activePreset, setActivePreset] = useState<string>('flat');

  // Keep engine in sync with state
  useEffect(() => {
    engine.setState(state);
  }, [state, engine]);

  // Compute EQ curve
  const curve = useMemo<FrequencyResponsePoint[]>(() => {
    engine.setState(state);
    return engine.getEQCurve(512);
  }, [state, engine]);

  const handlePresetChange = (presetId: string) => {
    const preset = PRESETS.get(presetId);
    if (preset) {
      setState(preset.state as any);
      setActivePreset(presetId);
      setSelectedBand(null);
    }
  };

  const handleBandUpdate = (bandId: number, updates: Partial<EQBand>) => {
    updateBand(bandId, updates);
  };

  const handleBandDrag = (bandId: number, freq: number, gain: number) => {
    const band = state.bands.find(b => b.id === bandId);
    if (!band) return;
    const showGain = band.type !== 'highpass' && band.type !== 'lowpass';
    updateBand(bandId, showGain ? { frequency: freq, gain } : { frequency: freq });
  };

  const handleReset = () => {
    reset();
    setActivePreset('');
    setSelectedBand(null);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--r3-color-background)',
      color: 'var(--r3-color-text)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--r3-font-family)',
    }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '10px 20px',
        borderBottom: '1px solid var(--r3-color-border)',
        background: 'var(--r3-color-panel)',
        flexWrap: 'wrap',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 8 }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="6" fill="#B7FF00"/>
            <rect x="5" y="13" width="3" height="9" rx="1.5" fill="#080808"/>
            <rect x="10" y="8" width="3" height="14" rx="1.5" fill="#080808"/>
            <rect x="15" y="5" width="3" height="17" rx="1.5" fill="#080808"/>
            <rect x="20" y="10" width="3" height="12" rx="1.5" fill="#080808"/>
          </svg>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#B7FF00', letterSpacing: '0.05em' }}>R3 NATIVE</div>
            <div style={{ fontSize: 10, color: 'var(--r3-color-text-secondary)', letterSpacing: '0.08em' }}>PARAMETRIC EQ</div>
          </div>
        </div>

        {/* Preset selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--r3-color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Preset</span>
          <select
            value={activePreset}
            onChange={e => handlePresetChange(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid var(--r3-color-border)',
              borderRadius: 6, color: 'var(--r3-color-text)', fontSize: 13, padding: '5px 10px',
              cursor: 'pointer', minWidth: 140,
            }}
          >
            <option value="">— Custom —</option>
            {PRESET_LIST.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1 }} />

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={undo}
            disabled={!canUndo}
            title="Undo"
            style={btnStyle(!canUndo)}
          >↩ Undo</button>
          <button
            onClick={redo}
            disabled={!canRedo}
            title="Redo"
            style={btnStyle(!canRedo)}
          >↪ Redo</button>
          <button
            onClick={handleReset}
            title="Reset all bands"
            style={btnStyle(false)}
          >Reset</button>
          <button
            onClick={toggleBypass}
            title="Bypass EQ"
            style={{
              ...btnStyle(false),
              background: state.bypass ? 'rgba(255, 100, 100, 0.2)' : 'rgba(183, 255, 0, 0.12)',
              borderColor: state.bypass ? 'rgba(255,100,100,0.5)' : 'rgba(183,255,0,0.4)',
              color: state.bypass ? '#ff6464' : '#B7FF00',
              fontWeight: 600,
            }}
          >
            {state.bypass ? '⊘ Bypassed' : '⊙ Active'}
          </button>
        </div>
      </header>

      {/* Main area */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 20px', gap: 16, minHeight: 0 }}>

        {/* EQ Display */}
        <div style={{
          flex: '1 1 300px',
          background: '#0d0d0d',
          borderRadius: 10,
          border: '1px solid var(--r3-color-border)',
          overflow: 'hidden',
          position: 'relative',
          minHeight: 280,
        }}>
          <EQDisplay
            curve={curve}
            bands={state.bands}
            selectedBand={selectedBand}
            onSelectBand={setSelectedBand}
            onBandDrag={handleBandDrag}
            bypass={state.bypass}
          />

          {/* Bypass overlay */}
          {state.bypass && (
            <div style={{
              position: 'absolute', top: 10, right: 14,
              fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
              color: '#ff6464', textTransform: 'uppercase',
            }}>BYPASS</div>
          )}

          {/* dB scale labels */}
          <div style={{
            position: 'absolute', top: 0, right: 4, bottom: 20, display: 'flex',
            flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none',
          }}>
            {['+24', '+12', '0', '−12', '−24'].map(l => (
              <span key={l} style={{ fontSize: 9, color: 'rgba(153,153,153,0.5)', lineHeight: 1 }}>{l}</span>
            ))}
          </div>
        </div>

        {/* Band controls strip */}
        <div style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          paddingBottom: 4,
        }}>
          {state.bands.map(band => (
            <BandControl
              key={band.id}
              band={band}
              isSelected={selectedBand === band.id}
              onSelect={() => setSelectedBand(band.id)}
              onUpdate={updates => handleBandUpdate(band.id, updates)}
            />
          ))}
        </div>
      </main>

      {/* Status bar */}
      <footer style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '6px 20px',
        borderTop: '1px solid var(--r3-color-border)',
        background: 'var(--r3-color-panel)',
        fontSize: 11,
        color: 'var(--r3-color-text-secondary)',
      }}>
        {selectedBand !== null && (() => {
          const b = state.bands.find(b => b.id === selectedBand);
          if (!b) return null;
          return (
            <span>
              Band {b.id + 1} — {b.type.toUpperCase()} · {formatFreqFull(b.frequency)} · {b.gain > 0 ? '+' : ''}{b.gain.toFixed(1)} dB · Q {b.q.toFixed(2)}
            </span>
          );
        })()}
        <div style={{ flex: 1 }} />
        <span style={{ color: '#B7FF00', fontWeight: 600 }}>R3 NATIVE EQ v1.0</span>
      </footer>
    </div>
  );
}

function formatFreqFull(f: number): string {
  if (f >= 1000) return `${(f / 1000).toFixed(2).replace(/\.?0+$/, '')} kHz`;
  return `${Math.round(f)} Hz`;
}

function btnStyle(disabled: boolean): React.CSSProperties {
  return {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 6,
    color: disabled ? 'rgba(255,255,255,0.25)' : 'var(--r3-color-text)',
    fontSize: 12,
    padding: '5px 12px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 150ms',
  };
}
