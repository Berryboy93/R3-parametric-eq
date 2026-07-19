/**
 * R3 NATIVE — Fruity Parametric EQ 2 style UI
 * Includes: live audio (pink noise → BiquadFilter chain → AnalyserNode),
 *           real-time spectrum, and keyboard shortcuts.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { FruityEQCanvas, BAND_COLORS, DB_TICKS } from './components/FruityEQCanvas';
import { BandCard, BAND_CARDS } from './components/BandCard';
import { useEQState } from './hooks/useEQState';
import { useAudioEngine } from './hooks/useAudioEngine';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { createFactoryPresets, FilterType } from './dsp';
import type { FrequencyResponsePoint, EQBand } from './dsp';

const PRESETS     = createFactoryPresets();
const PRESET_LIST = Array.from(PRESETS.values());

export function App() {
  const { state, setState, updateBand, toggleBypass, reset, undo, redo, canUndo, canRedo, engine } =
    useEQState();
  const [selectedBand, setSelectedBand] = useState<number>(0);
  const [activePreset, setActivePreset] = useState<string>('flat');
  const [showHelp, setShowHelp]         = useState(false);

  // Keep engine in sync
  useEffect(() => { engine.setState(state); }, [state, engine]);

  const curve = useMemo<FrequencyResponsePoint[]>(() => {
    engine.setState(state);
    return engine.getEQCurve(512);
  }, [state, engine]);

  // Live audio engine
  const { isPlaying, play, stop, spectrumData } =
    useAudioEngine(state.bands, state.bypass);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    bands: state.bands, selectedBand, setSelectedBand,
    updateBand, toggleBypass, undo, redo, setShowHelp,
  });

  const handlePreset = (id: string) => {
    const p = PRESETS.get(id);
    if (p) { setState(p.state as any); setActivePreset(id); }
  };

  const handleBandDrag = (id: number, freq: number, gain: number) => {
    const b = state.bands.find(b => b.id === id);
    if (!b) return;
    const showGain = b.type !== FilterType.HighPass && b.type !== FilterType.LowPass;
    updateBand(id, showGain ? { frequency: freq, gain } : { frequency: freq });
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a10', color: '#d0d4e8', fontFamily: "'Segoe UI', system-ui, sans-serif", display: 'flex', flexDirection: 'column', position: 'relative' }}>

      {/* Keyboard shortcut overlay */}
      {showHelp && <ShortcutHelp onClose={() => setShowHelp(false)} />}

      {/* Title bar */}
      <TitleBar
        activePreset={activePreset} onPreset={handlePreset}
        onUndo={undo} canUndo={canUndo}
        onRedo={redo} canRedo={canRedo}
        onReset={reset}
        onHelp={() => setShowHelp(v => !v)}
      />

      {/* EQ Panel */}
      <EQPanel
        curve={curve} bands={state.bands}
        selectedBand={selectedBand} onSelectBand={setSelectedBand}
        onBandDrag={handleBandDrag} onBandUpdate={updateBand}
        bypass={state.bypass} onToggleBypass={toggleBypass}
        isPlaying={isPlaying} onPlay={play} onStop={stop}
        liveSpectrum={spectrumData}
      />

      {/* Band cards */}
      <section style={{ padding: '18px 20px 0', display: 'flex', gap: 12 }}>
        {BAND_CARDS.map(d => <BandCard key={d.num} data={d} />)}
      </section>

      {/* Pro Tips */}
      <ProTips />

      {/* Quote strip */}
      <QuoteStrip />
    </div>
  );
}

// ── Title bar ─────────────────────────────────────────────────────────────────
function TitleBar({ activePreset, onPreset, onUndo, canUndo, onRedo, canRedo, onReset, onHelp }: {
  activePreset: string; onPreset: (id: string) => void;
  onUndo: () => void; canUndo: boolean;
  onRedo: () => void; canRedo: boolean;
  onReset: () => void; onHelp: () => void;
}) {
  return (
    <div style={{ background: '#13131e', borderBottom: '1px solid #2a2a40', padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 14, color: '#7a7a9a' }}>⚙</span>
      <span style={{ fontSize: 13, color: '#c0c4dc', letterSpacing: '0.02em' }}>
        Fruity parametric EQ 2
        <span style={{ color: '#606080', marginLeft: 6 }}>(Master)</span>
      </span>
      <div style={{ flex: 1 }} />
      <button onClick={onUndo} disabled={!canUndo} style={tinyBtn(!canUndo)} title="Undo (Ctrl+Z)">↩</button>
      <button onClick={onRedo} disabled={!canRedo} style={tinyBtn(!canRedo)} title="Redo (Ctrl+Y)">↪</button>
      <button onClick={onReset} style={tinyBtn(false)} title="Reset all bands">Reset</button>
      <button onClick={onHelp}  style={{ ...tinyBtn(false), color: '#9b9bcc' }} title="Keyboard shortcuts (?)">?</button>
      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #3a3a58', borderRadius: 4, overflow: 'hidden' }}>
        <span style={{ fontSize: 12, color: '#888aaa', padding: '4px 8px', background: '#1a1a28' }}>Presets</span>
        <select value={activePreset} onChange={e => onPreset(e.target.value)}
          style={{ background: '#1a1a28', border: 'none', color: '#d0d4e8', fontSize: 12, padding: '4px 6px', cursor: 'pointer' }}>
          {PRESET_LIST.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button style={{ ...tinyBtn(false), borderRadius: 0, borderLeft: '1px solid #3a3a58' }}>◄</button>
        <button style={{ ...tinyBtn(false), borderRadius: 0, borderLeft: '1px solid #3a3a58' }}>►</button>
      </div>
    </div>
  );
}

// ── EQ Panel ──────────────────────────────────────────────────────────────────
function EQPanel({ curve, bands, selectedBand, onSelectBand, onBandDrag, onBandUpdate,
  bypass, onToggleBypass, isPlaying, onPlay, onStop, liveSpectrum }: {
  curve: FrequencyResponsePoint[];
  bands: readonly EQBand[];
  selectedBand: number;
  onSelectBand: (id: number) => void;
  onBandDrag: (id: number, freq: number, gain: number) => void;
  onBandUpdate: (id: number, u: Partial<EQBand>) => void;
  bypass: boolean; onToggleBypass: () => void;
  isPlaying: boolean; onPlay: () => void; onStop: () => void;
  liveSpectrum: Float32Array | null;
}) {
  const FREQ_TICKS = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
  const fmtFreq    = (f: number) => f >= 1000 ? `${f / 1000}k` : `${f}`;

  return (
    <div style={{ margin: '10px 20px 0', background: '#0e0e18', border: '1px solid #2a2a42', borderRadius: 8, overflow: 'hidden' }}>
      {/* Frequency labels */}
      <div style={{ position: 'relative', height: 22, borderBottom: '1px solid #1e1e30' }}>
        {FREQ_TICKS.map(f => {
          const pct = (Math.log10(f / 20) / Math.log10(20000 / 20)) * 100;
          return (
            <span key={f} style={{ position: 'absolute', left: `${pct}%`, fontSize: 10, color: '#555570', transform: 'translateX(-50%)', top: 4 }}>
              {fmtFreq(f)}
            </span>
          );
        })}
      </div>

      {/* Canvas + right faders */}
      <div style={{ display: 'flex', height: 240 }}>
        {/* Canvas */}
        <div style={{ flex: 1, position: 'relative' }}>
          <FruityEQCanvas
            curve={curve} bands={bands}
            selectedBand={selectedBand} onSelectBand={onSelectBand}
            onBandDrag={onBandDrag} bypass={bypass}
            liveSpectrum={liveSpectrum}
          />
          {/* dB scale overlay */}
          <div style={{ position: 'absolute', top: 0, right: 6, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-around', pointerEvents: 'none' }}>
            {DB_TICKS.map(db => (
              <span key={db} style={{ fontSize: 9, color: db === 0 ? '#8888aa' : '#555570', lineHeight: 1 }}>
                {db > 0 ? `+${db}` : db}
              </span>
            ))}
          </div>
        </div>

        {/* Right fader panel */}
        <BandFaderPanel bands={bands} selectedBand={selectedBand} onSelectBand={onSelectBand} onBandUpdate={onBandUpdate} />
      </div>

      {/* Bottom control bar */}
      <BottomControlBar bypass={bypass} onToggleBypass={onToggleBypass} isPlaying={isPlaying} onPlay={onPlay} onStop={onStop} />
    </div>
  );
}

// ── Vertical fader panel ───────────────────────────────────────────────────────
function BandFaderPanel({ bands, selectedBand, onSelectBand, onBandUpdate }: {
  bands: readonly EQBand[]; selectedBand: number;
  onSelectBand: (id: number) => void;
  onBandUpdate: (id: number, u: Partial<EQBand>) => void;
}) {
  return (
    <div style={{ width: 144, background: '#0a0a14', borderLeft: '1px solid #1e1e30', display: 'flex', flexDirection: 'column' }}>
      {/* Coloured tabs */}
      <div style={{ display: 'flex', height: 20, borderBottom: '1px solid #1a1a28' }}>
        {bands.map(b => (
          <div key={b.id} onClick={() => onSelectBand(b.id)} title={`Band ${b.id + 1} — click or press Tab`}
            style={{ flex: 1, cursor: 'pointer', background: b.id === selectedBand ? BAND_COLORS[b.id] : `${BAND_COLORS[b.id]}55`, borderRight: '1px solid #0a0a14', transition: 'background 150ms' }} />
        ))}
      </div>
      {/* Faders */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', padding: '6px 4px 4px' }}>
        {bands.map(b => (
          <VerticalFader key={b.id} value={b.gain} color={BAND_COLORS[b.id]}
            selected={b.id === selectedBand}
            onClick={() => onSelectBand(b.id)}
            onChange={v => onBandUpdate(b.id, { gain: v })} />
        ))}
      </div>
      {/* Enable toggles */}
      <div style={{ display: 'flex', padding: '2px 4px 6px', gap: 2 }}>
        {bands.map(b => (
          <button key={b.id} onClick={() => onBandUpdate(b.id, { enabled: !b.enabled })}
            title={`Band ${b.id + 1} ${b.enabled ? '(enabled — press E to toggle)' : '(disabled)'}`}
            style={{ flex: 1, height: 10, padding: 0, border: 'none', cursor: 'pointer', background: b.enabled ? BAND_COLORS[b.id] : '#2a2a3a', borderRadius: 1, transition: 'background 150ms' }} />
        ))}
      </div>
    </div>
  );
}

function VerticalFader({ value, color, selected, onClick, onChange }: {
  value: number; color: string; selected: boolean;
  onClick: () => void; onChange: (v: number) => void;
}) {
  const FADER_H = 100;
  const DB_MAX  = 18;
  const norm    = Math.max(0, Math.min(1, 0.5 - value / (DB_MAX * 2)));
  const trackRef = useRef<HTMLDivElement>(null);

  const startDrag = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick();
    const onMove = (ev: MouseEvent) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const t    = Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height));
      onChange(Math.round(((0.5 - t) * DB_MAX * 2) * 10) / 10);
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div ref={trackRef} onClick={onClick} onMouseDown={startDrag}
      title={`${value > 0 ? '+' : ''}${value.toFixed(1)} dB — drag or use ↑↓`}
      style={{ flex: 1, height: FADER_H, position: 'relative', cursor: 'ns-resize', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, background: '#2a2a40', transform: 'translateX(-50%)', borderRadius: 1 }} />
      <div style={{ position: 'absolute', left: '50%', width: 2, top: value >= 0 ? `${norm * 100}%` : '50%', height: `${Math.abs(value / (DB_MAX * 2)) * 100}%`, background: color, transform: 'translateX(-50%)', borderRadius: 1 }} />
      <div style={{ position: 'absolute', top: `${norm * 100}%`, left: '50%', width: selected ? 14 : 10, height: selected ? 5 : 4, background: color, borderRadius: 2, transform: 'translate(-50%, -50%)', boxShadow: selected ? `0 0 6px ${color}` : 'none', transition: 'box-shadow 150ms' }} />
    </div>
  );
}

// ── Bottom control bar ────────────────────────────────────────────────────────
function BottomControlBar({ bypass, onToggleBypass, isPlaying, onPlay, onStop }: {
  bypass: boolean; onToggleBypass: () => void;
  isPlaying: boolean; onPlay: () => void; onStop: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 12px', borderTop: '1px solid #1e1e30', background: '#0b0b16' }}>
      <span style={{ fontSize: 12, color: '#3a3a58', letterSpacing: '0.12em', fontWeight: 500 }}>
        PARAMETRIC <span style={{ color: '#5a5a7a', fontWeight: 700 }}>EQ</span>
        <sub style={{ fontSize: 9, color: '#444460' }}>2</sub>
      </span>
      <div style={{ flex: 1 }} />

      {/* ── Play / Stop pink noise ── */}
      <button
        onClick={isPlaying ? onStop : onPlay}
        title={isPlaying ? 'Stop pink-noise test tone' : 'Play pink-noise test tone through EQ'}
        style={{
          fontSize: 12, padding: '3px 12px', borderRadius: 4, cursor: 'pointer', fontWeight: 600,
          background: isPlaying ? 'rgba(231,76,60,0.18)' : 'rgba(46,204,113,0.14)',
          border: `1px solid ${isPlaying ? '#e74c3c' : '#2ECC71'}88`,
          color: isPlaying ? '#e74c3c' : '#2ECC71',
          letterSpacing: '0.04em',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
        {isPlaying
          ? <><span style={{ fontSize: 10 }}>■</span> STOP</>
          : <><span style={{ fontSize: 10 }}>▶</span> PLAY</>}
      </button>

      <div style={{ width: 1, height: 16, background: '#2a2a40' }} />

      <PillBtn label="LIN" title="Linear Phase" />
      <PillBtn label="HQ"  title="High Quality" />
      <PillBtn label="◎"   title="Tune" />

      <div style={{ width: 1, height: 16, background: '#2a2a40' }} />

      {/* Bypass */}
      <button onClick={onToggleBypass} title={`${bypass ? 'Bypassed' : 'Active'} — click or press B`}
        style={{ fontSize: 11, padding: '3px 10px', borderRadius: 4, cursor: 'pointer', background: bypass ? 'rgba(240,100,100,0.15)' : 'rgba(46,204,113,0.12)', border: `1px solid ${bypass ? '#e05555' : '#2ECC71'}88`, color: bypass ? '#e07070' : '#2ECC71', fontWeight: 600, letterSpacing: '0.04em' }}>
        {bypass ? 'BYPASSED' : 'ACTIVE'}
      </button>

      <div style={{ width: 1, height: 16, background: '#2a2a40' }} />
      <span style={{ fontSize: 10, color: '#404060' }}>MONITOR</span>
      <span style={{ fontSize: 10, color: '#404060' }}>COMPARE</span>
    </div>
  );
}

function PillBtn({ label, title }: { label: string; title: string }) {
  return (
    <button title={title} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 3, cursor: 'pointer', background: '#1a1a2c', border: '1px solid #2a2a42', color: '#606080' }}>{label}</button>
  );
}

// ── Keyboard shortcut overlay ─────────────────────────────────────────────────
function ShortcutHelp({ onClose }: { onClose: () => void }) {
  const rows = [
    ['Tab / Shift+Tab',   'Cycle through bands'],
    ['← / →',            'Nudge frequency (×1.05)'],
    ['Shift + ← / →',    'Nudge frequency (×1.3)'],
    ['↑ / ↓',            'Nudge gain ±0.5 dB'],
    ['Shift + ↑ / ↓',    'Nudge gain ±3 dB'],
    ['E',                 'Toggle band enabled'],
    ['B',                 'Toggle bypass'],
    ['Ctrl+Z',            'Undo'],
    ['Ctrl+Y / Ctrl+Shift+Z', 'Redo'],
    ['?',                 'Toggle this help'],
  ];
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#13131e', border: '1px solid #3a3a58', borderRadius: 10,
        padding: '24px 28px', minWidth: 380,
        boxShadow: '0 8px 48px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#c0c4dc', letterSpacing: '0.08em' }}>KEYBOARD SHORTCUTS</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#606080', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {rows.map(([key, desc]) => (
              <tr key={key}>
                <td style={{ padding: '5px 16px 5px 0', whiteSpace: 'nowrap' }}>
                  <kbd style={{ background: '#1e1e30', border: '1px solid #3a3a52', borderRadius: 4, padding: '2px 8px', fontSize: 11, color: '#a0a4c8', fontFamily: 'monospace' }}>{key}</kbd>
                </td>
                <td style={{ padding: '5px 0', fontSize: 12, color: '#8888aa' }}>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ margin: '16px 0 0', fontSize: 11, color: '#444466', textAlign: 'center' }}>Click outside or press <kbd style={{ background: '#1e1e30', border: '1px solid #3a3a52', borderRadius: 3, padding: '1px 5px', fontSize: 10, color: '#888aaa' }}>?</kbd> to close</p>
      </div>
    </div>
  );
}

// ── Pro Tips ──────────────────────────────────────────────────────────────────
function ProTips() {
  return (
    <div style={{ margin: '18px 20px 0', background: '#130f08', border: '1px solid #6b3a0a', borderRadius: 8, padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 64, paddingRight: 16, borderRight: '1px solid #3a2010' }}>
        <span style={{ fontSize: 28, lineHeight: 1 }}>💡</span>
        <span style={{ fontSize: 14, fontWeight: 900, color: '#e8830a', letterSpacing: '0.06em', lineHeight: 1.1, textAlign: 'center' }}>PRO<br/>TIPS</span>
      </div>
      {[
        { icon: '✂️', head: 'CUT BEFORE BOOSTING', body: 'Always remove problem frequencies first. Then boost what matters.' },
        { icon: '🎚️', head: 'SMALL EQ MOVES',      body: 'Subtle changes make a big difference. Avoid extreme boosts or deep cuts.' },
        { icon: '👂', head: 'TRUST YOUR EARS',      body: 'Use reference tracks and A/B often. Your ears are the best tool.' },
      ].map(t => (
        <div key={t.head} style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 18 }}>{t.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#e8830a', letterSpacing: '0.07em' }}>{t.head}</span>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: '#9a7050', lineHeight: 1.55 }}>{t.body}</p>
        </div>
      ))}
    </div>
  );
}

// ── Quote strip ───────────────────────────────────────────────────────────────
function QuoteStrip() {
  return (
    <div style={{ margin: '14px 20px 20px', padding: '14px 24px', borderTop: '1px solid #2a1a08', borderBottom: '1px solid #2a1a08', textAlign: 'center' }}>
      <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.18em', color: '#c4700a', fontStyle: 'italic' }}>
        {'" '}<span style={{ letterSpacing: '0.22em' }}>LESS IS MORE.&nbsp; SPACE IS POWER.</span>{' "'}
      </span>
    </div>
  );
}

function tinyBtn(disabled: boolean): React.CSSProperties {
  return { fontSize: 11, padding: '3px 8px', borderRadius: 4, cursor: disabled ? 'not-allowed' : 'pointer', background: '#1a1a28', border: '1px solid #2a2a40', color: disabled ? '#3a3a58' : '#8888aa' };
}
