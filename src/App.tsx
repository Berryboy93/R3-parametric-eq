/**
 * R3 NATIVE — Fruity Parametric EQ 2 style UI
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { FruityEQCanvas, BAND_COLORS } from './components/FruityEQCanvas';
import { BandCard, BAND_CARDS } from './components/BandCard';
import { useEQState } from './hooks/useEQState';
import { createFactoryPresets, FilterType } from './dsp';
import type { FrequencyResponsePoint, EQBand } from './dsp';

const PRESETS = createFactoryPresets();
const PRESET_LIST = Array.from(PRESETS.values());
const DB_TICKS = [18, 12, 6, 0, -6, -12, -18];
const DB_RANGE = 18;

export function App() {
  const { state, setState, updateBand, toggleBypass, reset, undo, redo, canUndo, canRedo, engine } =
    useEQState();
  const [selectedBand, setSelectedBand] = useState<number>(0);
  const [activePreset, setActivePreset] = useState<string>('flat');

  // Keep engine in sync
  useEffect(() => { engine.setState(state); }, [state, engine]);

  const curve = useMemo<FrequencyResponsePoint[]>(() => {
    engine.setState(state);
    return engine.getEQCurve(512);
  }, [state, engine]);

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
    <div style={{ minHeight: '100vh', background: '#0a0a10', color: '#d0d4e8', fontFamily: "'Segoe UI', system-ui, sans-serif", display: 'flex', flexDirection: 'column' }}>

      {/* ── Title bar ──────────────────────────────────────────────────────── */}
      <TitleBar
        activePreset={activePreset}
        onPreset={handlePreset}
        onUndo={undo} canUndo={canUndo}
        onRedo={redo} canRedo={canRedo}
        onReset={reset}
      />

      {/* ── EQ Panel ───────────────────────────────────────────────────────── */}
      <EQPanel
        curve={curve}
        bands={state.bands}
        selectedBand={selectedBand}
        onSelectBand={setSelectedBand}
        onBandDrag={handleBandDrag}
        onBandUpdate={updateBand}
        bypass={state.bypass}
        onToggleBypass={toggleBypass}
      />

      {/* ── Band cards ─────────────────────────────────────────────────────── */}
      <section style={{ padding: '18px 20px 0', display: 'flex', gap: 12 }}>
        {BAND_CARDS.map(d => <BandCard key={d.num} data={d} />)}
      </section>

      {/* ── Pro Tips ───────────────────────────────────────────────────────── */}
      <ProTips />

      {/* ── Quote strip ────────────────────────────────────────────────────── */}
      <QuoteStrip />
    </div>
  );
}

// ── Title bar ─────────────────────────────────────────────────────────────────
function TitleBar({ activePreset, onPreset, onUndo, canUndo, onRedo, canRedo, onReset }: {
  activePreset: string; onPreset: (id: string) => void;
  onUndo: () => void; canUndo: boolean;
  onRedo: () => void; canRedo: boolean;
  onReset: () => void;
}) {
  return (
    <div style={{
      background: '#13131e', borderBottom: '1px solid #2a2a40',
      padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 10,
    }}>
      {/* Gear icon */}
      <span style={{ fontSize: 14, color: '#7a7a9a' }}>⚙</span>
      <span style={{ fontSize: 13, color: '#c0c4dc', letterSpacing: '0.02em' }}>
        Fruity parametric EQ 2
        <span style={{ color: '#606080', marginLeft: 6 }}>(Master)</span>
      </span>
      <div style={{ flex: 1 }} />
      {/* Undo / Redo / Reset */}
      <button onClick={onUndo} disabled={!canUndo} style={tinyBtn(!canUndo)}>↩</button>
      <button onClick={onRedo} disabled={!canRedo} style={tinyBtn(!canRedo)}>↪</button>
      <button onClick={onReset} style={tinyBtn(false)}>Reset</button>
      {/* Presets */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: '1px solid #3a3a58', borderRadius: 4, overflow: 'hidden' }}>
        <span style={{ fontSize: 12, color: '#888aaa', padding: '4px 8px', background: '#1a1a28' }}>Presets</span>
        <select
          value={activePreset}
          onChange={e => onPreset(e.target.value)}
          style={{ background: '#1a1a28', border: 'none', color: '#d0d4e8', fontSize: 12, padding: '4px 6px', cursor: 'pointer' }}
        >
          {PRESET_LIST.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button style={{ ...tinyBtn(false), borderRadius: 0, borderLeft: '1px solid #3a3a58' }}>◄</button>
        <button style={{ ...tinyBtn(false), borderRadius: 0, borderLeft: '1px solid #3a3a58' }}>►</button>
      </div>
    </div>
  );
}

// ── EQ Panel ──────────────────────────────────────────────────────────────────
function EQPanel({ curve, bands, selectedBand, onSelectBand, onBandDrag, onBandUpdate, bypass, onToggleBypass }: {
  curve: FrequencyResponsePoint[];
  bands: readonly EQBand[];
  selectedBand: number;
  onSelectBand: (id: number) => void;
  onBandDrag: (id: number, freq: number, gain: number) => void;
  onBandUpdate: (id: number, u: Partial<EQBand>) => void;
  bypass: boolean;
  onToggleBypass: () => void;
}) {
  const FREQ_TICKS = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
  const fmtFreq = (f: number) => f >= 1000 ? `${f / 1000}k` : `${f}`;

  return (
    <div style={{ margin: '10px 20px 0', background: '#0e0e18', border: '1px solid #2a2a42', borderRadius: 8, overflow: 'hidden' }}>

      {/* Frequency labels row */}
      <div style={{ position: 'relative', height: 22, borderBottom: '1px solid #1e1e30', paddingLeft: 2 }}>
        <FreqLabelRow ticks={FREQ_TICKS} fmt={fmtFreq} />
      </div>

      {/* Main canvas + right fader panel */}
      <div style={{ display: 'flex', height: 240 }}>

        {/* Canvas */}
        <div style={{ flex: 1, position: 'relative' }}>
          <FruityEQCanvas
            curve={curve} bands={bands}
            selectedBand={selectedBand} onSelectBand={onSelectBand}
            onBandDrag={onBandDrag} bypass={bypass}
          />
          {/* dB scale overlay (inside canvas, right edge) */}
          <div style={{
            position: 'absolute', top: 0, right: 6, bottom: 0,
            display: 'flex', flexDirection: 'column', justifyContent: 'space-around',
            pointerEvents: 'none',
          }}>
            {DB_TICKS.map(db => (
              <span key={db} style={{ fontSize: 9, color: db === 0 ? '#8888aa' : '#555570', lineHeight: 1 }}>
                {db > 0 ? `+${db}` : db}
              </span>
            ))}
          </div>
        </div>

        {/* Right panel — vertical band faders */}
        <BandFaderPanel
          bands={bands}
          selectedBand={selectedBand}
          onSelectBand={onSelectBand}
          onBandUpdate={onBandUpdate}
        />
      </div>

      {/* Bottom control bar */}
      <BottomControlBar bypass={bypass} onToggleBypass={onToggleBypass} />
    </div>
  );
}

// Frequency label row
function FreqLabelRow({ ticks, fmt }: { ticks: number[]; fmt: (f: number) => string }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center' }}>
      {ticks.map(f => {
        const pct = (Math.log10(f / 20) / Math.log10(20000 / 20)) * 100;
        return (
          <span key={f} style={{
            position: 'absolute', left: `${pct}%`,
            fontSize: 10, color: '#555570',
            transform: 'translateX(-50%)',
          }}>{fmt(f)}</span>
        );
      })}
    </div>
  );
}

// Vertical fader panel (right side)
function BandFaderPanel({ bands, selectedBand, onSelectBand, onBandUpdate }: {
  bands: readonly EQBand[]; selectedBand: number;
  onSelectBand: (id: number) => void;
  onBandUpdate: (id: number, u: Partial<EQBand>) => void;
}) {
  return (
    <div style={{
      width: 144, background: '#0a0a14',
      borderLeft: '1px solid #1e1e30',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Coloured band tabs row */}
      <div style={{ display: 'flex', height: 20, borderBottom: '1px solid #1a1a28' }}>
        {bands.map(b => (
          <div
            key={b.id}
            onClick={() => onSelectBand(b.id)}
            title={`Band ${b.id + 1}`}
            style={{
              flex: 1, cursor: 'pointer',
              background: b.id === selectedBand ? BAND_COLORS[b.id] : `${BAND_COLORS[b.id]}55`,
              borderRight: '1px solid #0a0a14',
              transition: 'background 150ms',
            }}
          />
        ))}
      </div>

      {/* Vertical faders */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', padding: '6px 4px 4px' }}>
        {bands.map(b => (
          <VerticalFader
            key={b.id}
            value={b.gain}
            color={BAND_COLORS[b.id]}
            selected={b.id === selectedBand}
            onClick={() => onSelectBand(b.id)}
            onChange={v => onBandUpdate(b.id, { gain: v })}
          />
        ))}
      </div>

      {/* Enable toggles row */}
      <div style={{ display: 'flex', padding: '2px 4px 6px', gap: 2 }}>
        {bands.map(b => (
          <button
            key={b.id}
            onClick={() => onBandUpdate(b.id, { enabled: !b.enabled })}
            title={`Band ${b.id + 1} ${b.enabled ? 'on' : 'off'}`}
            style={{
              flex: 1, height: 10, padding: 0, border: 'none', cursor: 'pointer',
              background: b.enabled ? BAND_COLORS[b.id] : '#2a2a3a',
              borderRadius: 1,
              transition: 'background 150ms',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// Single vertical fader
function VerticalFader({ value, color, selected, onClick, onChange }: {
  value: number; color: string; selected: boolean;
  onClick: () => void; onChange: (v: number) => void;
}) {
  const FADER_H = 100; // px of travel
  const DB_MAX  = 18;

  // clamp & normalise 0–1 (centre = 0.5)
  const norm = Math.max(0, Math.min(1, 0.5 - value / (DB_MAX * 2)));
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const startDrag = (e: React.MouseEvent) => {
    e.stopPropagation();
    dragging.current = true;
    onClick();

    const onMove = (ev: MouseEvent) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const t = Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height));
      onChange(Math.round(((0.5 - t) * DB_MAX * 2) * 10) / 10);
    };
    const onUp = () => { dragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div
      ref={trackRef}
      onClick={onClick}
      onMouseDown={startDrag}
      title={`${value > 0 ? '+' : ''}${value.toFixed(1)} dB`}
      style={{
        flex: 1, height: FADER_H, position: 'relative',
        cursor: 'ns-resize',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}
    >
      {/* Track */}
      <div style={{
        position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2,
        background: '#2a2a40', transform: 'translateX(-50%)', borderRadius: 1,
      }} />
      {/* Fill (from center to handle) */}
      <div style={{
        position: 'absolute', left: '50%', width: 2,
        top: value >= 0 ? `${norm * 100}%` : '50%',
        height: `${Math.abs(value / (DB_MAX * 2)) * 100}%`,
        background: color,
        transform: 'translateX(-50%)',
        borderRadius: 1,
      }} />
      {/* Handle */}
      <div style={{
        position: 'absolute', top: `${norm * 100}%`, left: '50%',
        width: selected ? 14 : 10, height: selected ? 5 : 4,
        background: color,
        borderRadius: 2,
        transform: 'translate(-50%, -50%)',
        boxShadow: selected ? `0 0 6px ${color}` : 'none',
        transition: 'box-shadow 150ms',
      }} />
    </div>
  );
}

// Bottom control bar (mimics the Fruity EQ transport + controls strip)
function BottomControlBar({ bypass, onToggleBypass }: { bypass: boolean; onToggleBypass: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '5px 12px', borderTop: '1px solid #1e1e30',
      background: '#0b0b16',
    }}>
      {/* Brand */}
      <span style={{ fontSize: 12, color: '#3a3a58', letterSpacing: '0.12em', fontWeight: 500 }}>
        PARAMETRIC <span style={{ color: '#5a5a7a', fontWeight: 700 }}>EQ</span>
        <sub style={{ fontSize: 9, color: '#444460' }}>2</sub>
      </span>

      <div style={{ flex: 1 }} />

      {/* Transport-style controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <PillBtn label="⏭" title="Fast Forward" />
        <PillBtn label="LIN" title="Linear Phase" />
        <PillBtn label="HQ" title="High Quality" />
        <PillBtn label="◎" title="Tune" />
      </div>

      <div style={{ width: 1, height: 16, background: '#2a2a40' }} />

      {/* Bypass */}
      <button
        onClick={onToggleBypass}
        title={bypass ? 'Bypassed — click to enable' : 'Active — click to bypass'}
        style={{
          fontSize: 11, padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
          background: bypass ? 'rgba(240,100,100,0.15)' : 'rgba(46,204,113,0.12)',
          border: `1px solid ${bypass ? '#e05555' : '#2ECC71'}88`,
          color: bypass ? '#e07070' : '#2ECC71',
          fontWeight: 600, letterSpacing: '0.04em',
        }}
      >{bypass ? 'BYPASSED' : 'ACTIVE'}</button>

      <div style={{ width: 1, height: 16, background: '#2a2a40' }} />
      <span style={{ fontSize: 10, color: '#404060' }}>MONITOR</span>
      <span style={{ fontSize: 10, color: '#404060' }}>COMPARE</span>
    </div>
  );
}

function PillBtn({ label, title }: { label: string; title: string }) {
  return (
    <button title={title} style={{
      fontSize: 11, padding: '2px 8px', borderRadius: 3, cursor: 'pointer',
      background: '#1a1a2c', border: '1px solid #2a2a42', color: '#606080',
    }}>{label}</button>
  );
}

// ── Pro Tips ──────────────────────────────────────────────────────────────────
function ProTips() {
  return (
    <div style={{
      margin: '18px 20px 0',
      background: '#130f08',
      border: '1px solid #6b3a0a',
      borderRadius: 8,
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 24,
    }}>
      {/* PRO TIPS badge */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 64, paddingRight: 16, borderRight: '1px solid #3a2010' }}>
        <span style={{ fontSize: 28, lineHeight: 1 }}>💡</span>
        <span style={{ fontSize: 14, fontWeight: 900, color: '#e8830a', letterSpacing: '0.06em', lineHeight: 1.1, textAlign: 'center' }}>PRO<br/>TIPS</span>
      </div>

      {/* Tips */}
      {[
        { icon: '✂️', head: 'CUT BEFORE BOOSTING', body: 'Always remove problem frequencies first. Then boost what matters.' },
        { icon: '🎚️', head: 'SMALL EQ MOVES', body: 'Subtle changes make a big difference. Avoid extreme boosts or deep cuts.' },
        { icon: '👂', head: 'TRUST YOUR EARS', body: 'Use reference tracks and A/B often. Your ears are the best tool.' },
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
    <div style={{
      margin: '14px 20px 20px',
      padding: '14px 24px',
      borderTop: '1px solid #2a1a08',
      borderBottom: '1px solid #2a1a08',
      textAlign: 'center',
    }}>
      <span style={{
        fontSize: 15, fontWeight: 700, letterSpacing: '0.18em',
        color: '#c4700a', fontStyle: 'italic',
      }}>
        {'" '}<span style={{ letterSpacing: '0.22em' }}>LESS IS MORE.&nbsp; SPACE IS POWER.</span>{' "'}
      </span>
    </div>
  );
}

function tinyBtn(disabled: boolean): React.CSSProperties {
  return {
    fontSize: 11, padding: '3px 8px', borderRadius: 4, cursor: disabled ? 'not-allowed' : 'pointer',
    background: '#1a1a28', border: '1px solid #2a2a40',
    color: disabled ? '#3a3a58' : '#8888aa',
  };
}
