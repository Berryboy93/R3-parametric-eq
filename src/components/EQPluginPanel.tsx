/**
 * EQPluginPanel — EQ plugin with metallic smoky-rustic theme
 * Toolbar · canvas · vertical faders · AI
 */

import { useRef, useState, useCallback } from 'react';
import { FruityEQCanvas } from './FruityEQCanvas';
import { AIPanel } from './AIPanel';
import { BAND_COLORS } from './BandStrip';
import { FilterType } from '../dsp';
import type { EQBand, FrequencyResponsePoint, EQState } from '../dsp';
import type { AudioSourceMode } from '../hooks/useAudioEngine';

const DB_LABELS  = [24, 12, 6, 0, -6, -12, -24];
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
  bypass: boolean;
  onToggleBypass: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onOpenPresets: () => void;
  onShowHelp: () => void;
  activeSlot: 'A' | 'B';
  onCaptureSlot: (slot: 'A' | 'B') => void;
  onToggleAB: () => void;
  onAIApply: (bandId: number, freq: number, gain: number, q: number) => void;
  fileDuration: number;
  fileCurrentTime: number;
  onSeek: (t: number) => void;
}

function fmtTime(s: number) {
  const m   = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ── Shared metallic button helper ─────────────────────────────────────────────
const metalBtn = (active: boolean, color = '#C4862A'): React.CSSProperties => ({
  background: active
    ? `linear-gradient(180deg,#1a1408 0%,#241c0a 45%,#1e1810 100%)`
    : `linear-gradient(180deg,#3a3530 0%,#252220 55%,#2e2825 100%)`,
  border: `1px solid ${active ? color + '70' : '#4a4440'}`,
  borderTop: `1px solid ${active ? color + '50' : '#5a5450'}`,
  borderBottom: `1px solid ${active ? color + '40' : '#1a1612'}`,
  color: active ? color : '#706860',
  boxShadow: active
    ? `inset 0 2px 5px rgba(0,0,0,0.7), 0 0 7px ${color}22`
    : 'inset 0 1px 0 rgba(255,235,200,0.07), inset 0 -1px 0 rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.55)',
  transition: 'all 120ms',
  cursor: 'pointer',
});

export function EQPluginPanel(props: EQPluginPanelProps) {
  const {
    state, curve, selectedBand, onSelectBand, onBandDrag, onBandUpdate, spectrumData,
    isPlaying, onPlay, onStop, sourceMode, onSourceMode, sourceError, onClearError,
    loadFile, fileReady, fileName,
    bypass, onToggleBypass, canUndo, canRedo, onUndo, onRedo, onReset, onOpenPresets, onShowHelp,
    activeSlot, onCaptureSlot, onToggleAB, onAIApply,
    fileDuration, fileCurrentTime, onSeek,
  } = props;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (!file.type.startsWith('audio/') && !/\.(mp3|wav|flac|ogg|aac|m4a|opus)$/i.test(file.name)) return;
    onSourceMode('file');
    loadFile(file);
  }, [onSourceMode, loadFile]);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        position: 'relative',
        background: 'linear-gradient(180deg,#181510 0%,#111008 100%)',
        border: `1px solid ${isDragging ? 'rgba(196,134,42,0.55)' : '#3a3530'}`,
        borderTop: `2px solid ${isDragging ? 'rgba(196,134,42,0.85)' : 'rgba(196,134,42,0.35)'}`,
        borderRadius: '0 0 10px 10px',
        boxShadow: '0 0 0 1px rgba(196,134,42,0.05), 0 32px 80px rgba(0,0,0,0.75)',
        overflow: 'hidden',
        transition: 'border-color 120ms',
      }}
    >
      {/* ── Drag-over overlay ─────────────────────────────────────────── */}
      {isDragging && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          background: 'rgba(196,134,42,0.04)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            border: '2px dashed rgba(196,134,42,0.55)', borderRadius: 10,
            padding: '20px 40px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🎵</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#C4862A', letterSpacing: '0.08em',
              textShadow: '0 0 10px rgba(196,134,42,0.4)' }}>
              DROP AUDIO FILE
            </div>
            <div style={{ fontSize: 10, color: '#6e6660', marginTop: 4 }}>MP3 · WAV · FLAC · OGG · AAC</div>
          </div>
        </div>
      )}

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

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        padding: '8px 14px',
        background: 'linear-gradient(180deg,#1c1916 0%,#111008 100%)',
        borderBottom: '1px solid #2c2825',
        boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.4)',
      }}>

        {/* ── Source selector ── */}
        <div style={{ display: 'flex', gap: 3 }}>
          {([
            { mode: 'pink-noise' as AudioSourceMode, icon: '🎵', label: 'PINK' },
            { mode: 'microphone' as AudioSourceMode, icon: '🎤', label: 'MIC'  },
            { mode: 'file'       as AudioSourceMode, icon: '📁', label: 'FILE' },
          ]).map(({ mode, icon, label }) => {
            const on = sourceMode === mode;
            return (
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
                  padding: '4px 9px', borderRadius: 4,
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.07em',
                  ...metalBtn(on),
                }}
              >
                <span style={{ fontSize: 10 }}>{icon}</span>
                {label}
              </button>
            );
          })}
          {sourceMode === 'file' && fileReady && fileName && (
            <button
              onClick={() => fileInputRef.current?.click()}
              title={`Loaded: ${fileName} — click to change`}
              style={{
                padding: '4px 8px', borderRadius: 4,
                fontSize: 9, fontWeight: 600, letterSpacing: '0.04em',
                maxWidth: 96, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                ...metalBtn(false),
                color: '#8a7a6a',
              }}
            >
              {fileName.length > 13 ? `${fileName.slice(0, 11)}…` : fileName}
            </button>
          )}
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 18, background: 'linear-gradient(to bottom,transparent,#3c3733,transparent)', flexShrink: 0 }} />

        {/* ── Play / Stop ── */}
        <button
          onClick={isPlaying ? onStop : onPlay}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 14px', borderRadius: 5,
            fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
            ...(isPlaying
              ? {
                  background: 'linear-gradient(180deg,#2a0a0a 0%,#1e0808 100%)',
                  border: '1px solid #ef444455',
                  borderTop: '1px solid #ef444440',
                  color: '#ef8888',
                  boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.7), 0 0 7px rgba(239,68,68,0.15)',
                }
              : {
                  background: 'linear-gradient(180deg,#2e2610 0%,#1e1a0a 50%,#252010 100%)',
                  border: '1px solid rgba(196,134,42,0.55)',
                  borderTop: '1px solid rgba(196,134,42,0.40)',
                  color: '#C4862A',
                  boxShadow: 'inset 0 1px 0 rgba(255,235,200,0.08), 0 0 8px rgba(196,134,42,0.20)',
                }),
            cursor: 'pointer', transition: 'all 150ms',
          }}
        >
          <span style={{ fontSize: 8 }}>{isPlaying ? '■' : '▶'}</span>
          {isPlaying ? 'STOP' : 'PLAY'}
        </button>

        {/* Divider */}
        <div style={{ width: 1, height: 18, background: 'linear-gradient(to bottom,transparent,#3c3733,transparent)', flexShrink: 0 }} />

        {/* ── A/B comparison ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ fontSize: 9, color: '#6e6660', letterSpacing: '0.07em' }}>A/B</span>
          {(['A', 'B'] as const).map(slot => (
            <button
              key={slot}
              onClick={() => slot === activeSlot ? onCaptureSlot(slot) : onToggleAB()}
              title={slot === activeSlot ? `Capture to slot ${slot}` : `Switch to slot ${slot}`}
              style={{
                width: 28, height: 24, borderRadius: 3,
                fontSize: 10, fontWeight: 800,
                ...metalBtn(slot === activeSlot),
              }}
            >{slot}</button>
          ))}
          <button
            onClick={onToggleAB}
            title="Swap A ↔ B"
            style={{ width: 28, height: 24, borderRadius: 3, fontSize: 12, ...metalBtn(false) }}
          >⇄</button>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 18, background: 'linear-gradient(to bottom,transparent,#3c3733,transparent)', flexShrink: 0 }} />

        {/* ── Bypass ── */}
        <button
          onClick={onToggleBypass}
          style={{
            padding: '4px 10px', borderRadius: 4,
            fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
            ...(bypass
              ? {
                  background: 'linear-gradient(180deg,#2a0808 0%,#1e0606 100%)',
                  border: '1px solid #ef444455',
                  color: '#ef8888',
                  boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.7)',
                }
              : { ...metalBtn(false), color: '#524c47' }),
            cursor: 'pointer', transition: 'all 150ms',
          }}
        >{bypass ? 'BYPASSED' : 'BYPASS'}</button>

        <div style={{ flex: 1 }} />

        {/* ── Undo / Redo / Reset ── */}
        <div style={{ display: 'flex', gap: 3 }}>
          {[
            { icon: '↩', act: onUndo,  dis: !canUndo, title: 'Undo (Ctrl+Z)' },
            { icon: '↪', act: onRedo,  dis: !canRedo, title: 'Redo (Ctrl+Y)' },
            { icon: '⟳', act: onReset, dis: false,    title: 'Reset to default' },
          ].map(b => (
            <button key={b.icon} onClick={b.act} disabled={b.dis} title={b.title} style={{
              width: 28, height: 26, borderRadius: 4,
              cursor: b.dis ? 'not-allowed' : 'pointer',
              fontSize: 13, opacity: b.dis ? 0.35 : 1,
              ...metalBtn(false),
              color: '#8a8078',
            }}>{b.icon}</button>
          ))}
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 18, background: 'linear-gradient(to bottom,transparent,#3c3733,transparent)', flexShrink: 0 }} />

        {/* ── Presets + Help ── */}
        <button
          onClick={onOpenPresets}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 4,
            fontSize: 9, fontWeight: 700, letterSpacing: '0.07em',
            ...metalBtn(false), color: '#8a8078',
          }}
        >🎛 PRESETS</button>

        <button
          onClick={onShowHelp}
          title="Keyboard shortcuts (?)"
          style={{ width: 28, height: 26, borderRadius: 4, fontSize: 12, ...metalBtn(false), color: '#8a8078' }}
        >?</button>
      </div>

      {/* ── Source error banner ──────────────────────────────────────── */}
      {sourceError && (
        <div style={{
          padding: '7px 14px', background: 'rgba(239,68,68,0.07)',
          borderBottom: '1px solid rgba(239,68,68,0.18)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 12 }}>⚠️</span>
          <span style={{ fontSize: 11, color: '#ef8888', flex: 1 }}>{sourceError}</span>
          <button onClick={onClearError}
            style={{ background: 'none', border: 'none', color: '#705050', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>
      )}

      {/* ── Seek / progress bar (file mode only) ──────────────────────── */}
      {sourceMode === 'file' && fileReady && fileDuration > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '5px 14px',
          background: 'linear-gradient(180deg,#0f0d0a 0%,#0a0908 100%)',
          borderBottom: '1px solid #252220',
        }}>
          <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#6e6660', minWidth: 30, textAlign: 'right' }}>
            {fmtTime(fileCurrentTime)}
          </span>
          <input
            type="range" min={0} max={fileDuration} step={0.1}
            value={fileCurrentTime}
            onChange={e => onSeek(parseFloat(e.target.value))}
            style={{ flex: 1, height: 3, cursor: 'pointer', accentColor: '#C4862A' }}
          />
          <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#3c3733', minWidth: 30 }}>
            {fmtTime(fileDuration)}
          </span>
        </div>
      )}

      {/* ── Frequency axis ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', background: '#0f0d0a' }}>
        <div style={{ width: 34, flexShrink: 0 }} />
        <div style={{ flex: 1, position: 'relative', height: 16 }}>
          {FREQ_TICKS.map(f => {
            const pct = (Math.log10(f / 20) / Math.log10(20000 / 20)) * 100;
            return (
              <span key={f} style={{
                position: 'absolute', left: `${pct}%`,
                fontSize: 8, color: '#524c47',
                transform: 'translateX(-50%)',
                letterSpacing: '0.04em', lineHeight: '16px',
              }}>{fmtFreq(f)}</span>
            );
          })}
        </div>
      </div>

      {/* ── EQ canvas + dB rail ───────────────────────────────────────── */}
      <div style={{ display: 'flex', background: '#0a0908' }}>
        <div style={{
          width: 34, flexShrink: 0,
          display: 'flex', flexDirection: 'column', justifyContent: 'space-around',
          padding: '4px 0',
        }}>
          {DB_LABELS.map(db => (
            <span key={db} style={{
              fontSize: 8,
              color: db === 0 ? '#6e6660' : '#3c3733',
              textAlign: 'right', paddingRight: 5, fontFamily: 'monospace',
            }}>{db > 0 ? `+${db}` : db}</span>
          ))}
        </div>
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

      {/* ── Vertical faders ───────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        background: 'linear-gradient(180deg,#141210 0%,#0f0d0a 100%)',
        borderTop: '1px solid #2c2825',
        borderBottom: '1px solid #2c2825',
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

      {/* ── AI Analysis ───────────────────────────────────────────────── */}
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
  const color  = BAND_COLORS[band.id] ?? '#C4862A';
  const noGain = band.type === FilterType.HighPass || band.type === FilterType.LowPass;

  return (
    <div
      onClick={onSelect}
      style={{
        flex: 1, minWidth: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '10px 2px 10px',
        borderRight: isLast ? 'none' : '1px solid #252220',
        background: selected
          ? 'linear-gradient(180deg,rgba(196,134,42,0.05) 0%,transparent 100%)'
          : 'transparent',
        cursor: 'pointer',
        transition: 'background 150ms',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, marginBottom: 8 }}>
        <div style={{
          width: 18, height: 18, borderRadius: '50%',
          background: band.enabled
            ? `radial-gradient(circle at 35% 35%, ${color}cc, ${color}66)`
            : '#252220',
          border: `1px solid ${band.enabled ? color + '70' : '#3c3733'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 800,
          color: band.enabled ? '#0a0908' : '#524c47',
          boxShadow: band.enabled ? `0 0 4px ${color}30` : 'none',
          transition: 'all 200ms',
        }}>{band.id + 1}</div>
        <span style={{ fontSize: 7, color: '#524c47', letterSpacing: '0.06em', fontWeight: 700 }}>
          {TYPE_SHORT[band.type]}
        </span>
      </div>

      <div
        style={{
          position: 'relative', width: '100%', height: 82,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: noGain ? 0.15 : (band.enabled ? 1 : 0.3),
          transition: 'opacity 200ms',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          position: 'absolute', top: '50%', left: '10%',
          width: '80%', height: 1,
          background: 'rgba(255,235,200,0.06)',
          pointerEvents: 'none',
        }} />
        <input
          type="range"
          min={-24} max={24} step={0.1}
          value={noGain ? 0 : band.gain}
          disabled={noGain || !band.enabled}
          onChange={e => onGainChange(parseFloat(e.target.value))}
          style={{
            position: 'absolute',
            width: 80, height: 4,
            transform: 'rotate(-90deg)',
            cursor: noGain ? 'default' : 'pointer',
            accentColor: color,
          }}
        />
      </div>

      <span style={{
        fontSize: 8, fontFamily: 'monospace', marginTop: 2,
        color: noGain ? '#3c3733'
          : band.gain > 0.1 ? color
          : band.gain < -0.1 ? '#C45A3A'
          : '#524c47',
        minWidth: 38, textAlign: 'center',
        transition: 'color 150ms',
      }}>
        {noGain ? '—' : `${band.gain >= 0 ? '+' : ''}${band.gain.toFixed(1)}`}
      </span>

      <span style={{
        fontSize: 8,
        color: selected ? '#C4862A' : '#3c3733',
        marginTop: 2, letterSpacing: '0.03em',
        transition: 'color 150ms',
      }}>
        {fmtFreq(band.frequency)}
      </span>

      <button
        onClick={e => { e.stopPropagation(); onToggleEnable(); }}
        title={band.enabled ? 'Disable band' : 'Enable band'}
        style={{
          marginTop: 7, width: 24, height: 8, borderRadius: 4,
          border: `1px solid ${band.enabled ? color + '60' : '#3c3733'}`,
          cursor: 'pointer',
          background: band.enabled
            ? `linear-gradient(to right, ${color}aa, ${color}66)`
            : 'linear-gradient(180deg,#2c2825 0%,#1e1b18 100%)',
          boxShadow: band.enabled ? `0 0 5px ${color}30` : 'none',
          transition: 'all 200ms',
        }}
      />
    </div>
  );
}
