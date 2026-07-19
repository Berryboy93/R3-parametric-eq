/**
 * EQPluginPanel — the interactive EQ plugin with toolbar, canvas, vertical faders, AI
 * PRD §9.3: Plugin UI — dark panel · spectrum display · 8 band nodes · 8 vertical faders
 */

import { useRef } from 'react';
import { FruityEQCanvas } from './FruityEQCanvas';
import { AIPanel } from './AIPanel';
import { BAND_COLORS } from './BandStrip';
import { FilterType } from '../dsp';
import type { EQBand, FrequencyResponsePoint, EQState } from '../dsp';
import type { AudioSourceMode } from '../hooks/useAudioEngine';

const DB_LABELS  = [18, 12, 6, 0, -6, -12, -18];
const FREQ_TICKS = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];

const TYPE_SHORT: Partial<Record<FilterType, string>> = {
  [FilterType.HighPass]:  'HP',
  [FilterType.LowShelf]:  'LS',
  [FilterType.Peaking]:   'PK',
  [FilterType.HighShelf]: 'HS',
  [FilterType.LowPass]:   'LP',
};

function fmtFreq(f: number) {
  return f >= 1000 ? `${(f / 1000).toFixed(f >= 10000 ? 0 : 1)}k` : `${Math.round(f)}`;
}

export interface EQPluginPanelProps {
  state: EQState;
  curve: FrequencyResponsePoint[];
  selectedBand: number;
  onSelectBand: (id: number) => void;
  onBandDrag: (id: number, freq: number, gain: number) => void;
  onBandUpdate: (id: number, u: Partial<EQBand>) => void;
  spectrumData: Float32Array | null;
  // Audio transport
  isPlaying: boolean;
  onPlay: () => Promise<void>;
  onStop: () => void;
  sourceMode: AudioSourceMode;
  onSourceMode: (m: AudioSourceMode) => void;
  sourceError: string | null;
  onClearError: () => void;
  loadFile: (f: File) => Promise<void>;
  fileReady: boolean;
  fileName: string | null;
  // EQ controls
  bypass: boolean;
  onToggleBypass: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onOpenPresets: () => void;
  onShowHelp: () => void;
  // A/B comparison
  activeSlot: 'A' | 'B';
  onCaptureSlot: (slot: 'A' | 'B') => void;
  onToggleAB: () => void;
  // AI
  onAIApply: (bandId: number, freq: number, gain: number, q: number) => void;
}

export function EQPluginPanel(props: EQPluginPanelProps) {
  const {
    state, curve, selectedBand, onSelectBand, onBandDrag, onBandUpdate, spectrumData,
    isPlaying, onPlay, onStop, sourceMode, onSourceMode, sourceError, onClearError, loadFile, fileReady, fileName,
    bypass, onToggleBypass, canUndo, canRedo, onUndo, onRedo, onReset, onOpenPresets, onShowHelp,
    activeSlot, onCaptureSlot, onToggleAB, onAIApply,
  } = props;

  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div style={{
      background: '#0d0d18',
      border: '1px solid #1a1a2e',
      borderTop: '2px solid rgba(183,255,0,0.3)',
      borderRadius: '0 0 12px 12px',
      boxShadow: '0 0 0 1px rgba(183,255,0,0.03), 0 32px 80px rgba(0,0,0,0.7)',
      overflow: 'hidden',
    }}>

      {/* ── Hidden file input ──────────────────────────────────────────── */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) loadFile(file);
          e.target.value = '';
        }}
      />

      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        padding: '8px 14px', background: '#0b0b15',
        borderBottom: '1px solid #151525',
      }}>

        {/* Source selector */}
        <div style={{ display: 'flex', gap: 2 }}>
          {([
            { mode: 'pink-noise' as AudioSourceMode, icon: '🎵', label: 'PINK' },
            { mode: 'microphone' as AudioSourceMode, icon: '🎤', label: 'MIC'  },
            { mode: 'file'       as AudioSourceMode, icon: '📁', label: 'FILE' },
          ]).map(({ mode, icon, label }) => (
            <button
              key={mode}
              onClick={() => {
                if (isPlaying) onStop();
                onSourceMode(mode);
                onClearError();
                if (mode === 'file') fileInputRef.current?.click();
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 3,
                padding: '4px 8px', borderRadius: 4, cursor: 'pointer',
                fontSize: 9, fontWeight: 700, letterSpacing: '0.07em',
                border: `1px solid ${sourceMode === mode ? '#B7FF0055' : '#1e1e2e'}`,
                background: sourceMode === mode ? 'rgba(183,255,0,0.09)' : 'transparent',
                color: sourceMode === mode ? '#B7FF00' : '#404055',
                transition: 'all 120ms',
              }}
            >
              <span style={{ fontSize: 10 }}>{icon}</span>
              {label}
            </button>
          ))}
          {sourceMode === 'file' && fileReady && fileName && (
            <button
              onClick={() => fileInputRef.current?.click()}
              title={`Loaded: ${fileName} — click to change`}
              style={{
                padding: '4px 8px', borderRadius: 4, cursor: 'pointer',
                fontSize: 9, fontWeight: 600, letterSpacing: '0.04em',
                border: '1px solid #252535', background: '#13131e', color: '#606080',
                maxWidth: 96, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {fileName.length > 13 ? `${fileName.slice(0, 11)}…` : fileName}
            </button>
          )}
        </div>

        <div style={{ width: 1, height: 16, background: '#1e1e2e' }} />

        {/* Play / Stop */}
        <button
          onClick={isPlaying ? onStop : onPlay}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
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

        <div style={{ width: 1, height: 16, background: '#1e1e2e' }} />

        {/* A/B comparison */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ fontSize: 9, color: '#404055', letterSpacing: '0.07em' }}>A/B</span>
          {(['A', 'B'] as const).map(slot => (
            <button
              key={slot}
              onClick={() => slot === activeSlot ? onCaptureSlot(slot) : onToggleAB()}
              title={slot === activeSlot ? `Capture to slot ${slot}` : `Switch to slot ${slot}`}
              style={{
                width: 26, height: 24, borderRadius: 3, cursor: 'pointer',
                fontSize: 10, fontWeight: 800,
                border: `1px solid ${slot === activeSlot ? '#B7FF0070' : '#252535'}`,
                background: slot === activeSlot ? 'rgba(183,255,0,0.12)' : '#0f0f18',
                color: slot === activeSlot ? '#B7FF00' : '#404055',
                transition: 'all 150ms',
              }}
            >{slot}</button>
          ))}
          <button
            onClick={onToggleAB}
            title="Swap A ↔ B"
            style={{
              width: 26, height: 24, borderRadius: 3, cursor: 'pointer', fontSize: 12,
              border: '1px solid #252535', background: 'transparent', color: '#505065',
            }}
          >⇄</button>
        </div>

        <div style={{ width: 1, height: 16, background: '#1e1e2e' }} />

        {/* Bypass */}
        <button
          onClick={onToggleBypass}
          style={{
            padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
            fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
            border: `1px solid ${bypass ? '#ef444466' : '#33334a'}`,
            background: bypass ? 'rgba(239,68,68,0.1)' : 'transparent',
            color: bypass ? '#ef4444' : '#484860',
            transition: 'all 150ms',
          }}
        >{bypass ? 'BYPASSED' : 'BYPASS'}</button>

        <div style={{ flex: 1 }} />

        {/* Undo / Redo / Reset */}
        <div style={{ display: 'flex', gap: 3 }}>
          {[
            { icon: '↩', act: onUndo,  dis: !canUndo, title: 'Undo (Ctrl+Z)' },
            { icon: '↪', act: onRedo,  dis: !canRedo, title: 'Redo (Ctrl+Y)' },
            { icon: '⟳', act: onReset, dis: false,    title: 'Reset to default' },
          ].map(b => (
            <button key={b.icon} onClick={b.act} disabled={b.dis} title={b.title} style={{
              width: 26, height: 26, borderRadius: 4,
              cursor: b.dis ? 'not-allowed' : 'pointer',
              background: '#0f0f18', border: '1px solid #1e1e2e',
              color: b.dis ? '#222230' : '#606080', fontSize: 13,
            }}>{b.icon}</button>
          ))}
        </div>

        <div style={{ width: 1, height: 16, background: '#1e1e2e' }} />

        {/* Presets + Help */}
        <button
          onClick={onOpenPresets}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
            fontSize: 9, fontWeight: 700, letterSpacing: '0.07em',
            border: '1px solid #252535', background: 'transparent', color: '#606080',
            transition: 'all 120ms',
          }}
        >🎛 PRESETS</button>

        <button
          onClick={onShowHelp}
          title="Keyboard shortcuts (?)"
          style={{
            width: 26, height: 26, borderRadius: 4, cursor: 'pointer',
            background: '#0f0f18', border: '1px solid #1e1e2e', color: '#606080', fontSize: 12,
          }}
        >?</button>
      </div>

      {/* ── Source error banner ─────────────────────────────────────── */}
      {sourceError && (
        <div style={{
          padding: '7px 14px', background: 'rgba(239,68,68,0.08)',
          borderBottom: '1px solid rgba(239,68,68,0.2)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 12 }}>⚠️</span>
          <span style={{ fontSize: 11, color: '#ef8888', flex: 1 }}>{sourceError}</span>
          <button
            onClick={onClearError}
            style={{ background: 'none', border: 'none', color: '#604040', cursor: 'pointer', fontSize: 14 }}
          >✕</button>
        </div>
      )}

      {/* ── Frequency axis ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', background: '#0b0b12' }}>
        <div style={{ width: 34, flexShrink: 0 }} />
        <div style={{ flex: 1, position: 'relative', height: 16 }}>
          {FREQ_TICKS.map(f => {
            const pct = (Math.log10(f / 20) / Math.log10(20000 / 20)) * 100;
            return (
              <span key={f} style={{
                position: 'absolute', left: `${pct}%`,
                fontSize: 8, color: '#2d2d40',
                transform: 'translateX(-50%)',
                letterSpacing: '0.04em', lineHeight: '16px',
              }}>{fmtFreq(f)}</span>
            );
          })}
        </div>
      </div>

      {/* ── EQ canvas + dB rail ─────────────────────────────────────── */}
      <div style={{ display: 'flex', background: '#0b0b12' }}>
        {/* dB labels */}
        <div style={{
          width: 34, flexShrink: 0,
          display: 'flex', flexDirection: 'column', justifyContent: 'space-around',
          padding: '4px 0',
        }}>
          {DB_LABELS.map(db => (
            <span key={db} style={{
              fontSize: 8, color: db === 0 ? '#555568' : '#2a2a38',
              textAlign: 'right', paddingRight: 5, fontFamily: 'monospace',
            }}>{db > 0 ? `+${db}` : db}</span>
          ))}
        </div>
        {/* Canvas */}
        <div style={{ flex: 1, minWidth: 0, height: 224 }}>
          <FruityEQCanvas
            curve={curve}
            bands={state.bands}
            selectedBand={selectedBand}
            onSelectBand={onSelectBand}
            onBandDrag={onBandDrag}
            bypass={bypass}
            liveSpectrum={spectrumData}
          />
        </div>
      </div>

      {/* ── Vertical faders ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        background: '#0c0c16',
        borderTop: '1px solid #151525',
        borderBottom: '1px solid #151525',
      }}>
        {state.bands.map((band, idx) => (
          <VerticalFader
            key={band.id}
            band={band}
            selected={band.id === selectedBand}
            isLast={idx === state.bands.length - 1}
            onSelect={() => onSelectBand(band.id)}
            onGainChange={gain => onBandUpdate(band.id, { gain })}
            onToggleEnable={() => onBandUpdate(band.id, { enabled: !band.enabled })}
          />
        ))}
      </div>

      {/* ── AI Analysis ─────────────────────────────────────────────── */}
      <AIPanel
        spectrumData={spectrumData}
        isPlaying={isPlaying}
        bands={state.bands}
        onApply={onAIApply}
      />
    </div>
  );
}

// ── Vertical Fader ─────────────────────────────────────────────────────────────

interface FaderProps {
  band: EQBand;
  selected: boolean;
  isLast: boolean;
  onSelect: () => void;
  onGainChange: (g: number) => void;
  onToggleEnable: () => void;
}

function VerticalFader({ band, selected, isLast, onSelect, onGainChange, onToggleEnable }: FaderProps) {
  const color = BAND_COLORS[band.id] ?? '#B7FF00';
  const noGain = band.type === FilterType.HighPass || band.type === FilterType.LowPass;

  return (
    <div
      onClick={onSelect}
      style={{
        flex: 1, minWidth: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '10px 2px 10px',
        borderRight: isLast ? 'none' : '1px solid #151525',
        background: selected ? 'rgba(255,255,255,0.025)' : 'transparent',
        cursor: 'pointer',
        transition: 'background 150ms',
        userSelect: 'none',
      }}
    >
      {/* Band badge + type label */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, marginBottom: 8 }}>
        <div style={{
          width: 18, height: 18, borderRadius: '50%',
          background: band.enabled ? color : '#1e1e2e',
          border: `1px solid ${band.enabled ? color + '60' : '#252535'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 800,
          color: band.enabled ? '#000' : '#404040',
          transition: 'all 200ms',
        }}>{band.id + 1}</div>
        <span style={{
          fontSize: 7, color: '#404055', letterSpacing: '0.06em', fontWeight: 700,
        }}>{TYPE_SHORT[band.type]}</span>
      </div>

      {/* Vertical gain slider */}
      <div
        style={{
          position: 'relative', width: '100%', height: 82,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: noGain ? 0.15 : (band.enabled ? 1 : 0.3),
          transition: 'opacity 200ms',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Center "zero" tick */}
        <div style={{
          position: 'absolute', top: '50%', left: '10%',
          width: '80%', height: 1,
          background: 'rgba(255,255,255,0.05)',
          pointerEvents: 'none',
        }} />
        <input
          type="range"
          min={-18}
          max={18}
          step={0.1}
          value={noGain ? 0 : band.gain}
          disabled={noGain || !band.enabled}
          onChange={e => onGainChange(parseFloat(e.target.value))}
          style={{
            position: 'absolute',
            width: 80,
            height: 4,
            transform: 'rotate(-90deg)',
            cursor: noGain ? 'default' : 'pointer',
            accentColor: color,
          }}
        />
      </div>

      {/* Gain value */}
      <span style={{
        fontSize: 8, fontFamily: 'monospace', marginTop: 2,
        color: noGain ? '#252535'
          : band.gain > 0.1 ? color
          : band.gain < -0.1 ? '#ef8888'
          : '#404055',
        minWidth: 38, textAlign: 'center',
        transition: 'color 150ms',
      }}>
        {noGain ? '—' : `${band.gain >= 0 ? '+' : ''}${band.gain.toFixed(1)}`}
      </span>

      {/* Frequency */}
      <span style={{
        fontSize: 8, color: selected ? '#8080a0' : '#383848',
        marginTop: 2, letterSpacing: '0.03em',
        transition: 'color 150ms',
      }}>
        {fmtFreq(band.frequency)}
      </span>

      {/* Enable toggle pill */}
      <button
        onClick={e => { e.stopPropagation(); onToggleEnable(); }}
        title={band.enabled ? 'Disable band' : 'Enable band'}
        style={{
          marginTop: 7, width: 22, height: 7, borderRadius: 4,
          border: 'none', cursor: 'pointer',
          background: band.enabled ? color : '#252535',
          transition: 'background 200ms',
        }}
      />
    </div>
  );
}
