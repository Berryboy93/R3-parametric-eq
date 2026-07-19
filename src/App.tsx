/**
 * R3 NATIVE — EQ Masterclass
 * PRD §9.3: Masterclass page layout — header · plugin panel · operations · pro tips · footer
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { EQPluginPanel } from './components/EQPluginPanel';
import { OperationsGrid } from './components/OperationsGrid';
import { PresetBrowser } from './components/PresetBrowser';
import { useEQState } from './hooks/useEQState';
import { useAudioEngine } from './hooks/useAudioEngine';
import type { AudioSourceMode } from './hooks/useAudioEngine';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { usePresetManager } from './hooks/usePresetManager';
import { FilterType } from './dsp';
import type { EQBand } from './dsp';
import './styles/theme.css';

export function App() {
  const {
    state, setState, updateBand, toggleBypass, reset, undo, redo,
    canUndo, canRedo, engine,
    abSlots, activeSlot, captureToSlot, toggleAB,
  } = useEQState();

  const presets = usePresetManager();

  const [selectedBand, setSelectedBand] = useState(0);
  const [showHelp,     setShowHelp]     = useState(false);
  const [showBrowser,  setShowBrowser]  = useState(false);

  useEffect(() => { engine.setState(state); }, [state, engine]);

  const curve = useMemo(() => {
    engine.setState(state);
    return engine.getEQCurve(512);
  }, [state, engine]);

  const {
    isPlaying, play, stop, spectrumData,
    sourceMode, setSourceMode, sourceError, setSourceError,
    loadFile, fileReady, fileName,
    fileDuration, fileCurrentTime, seek,
  } = useAudioEngine(state.bands, state.bypass);

  useKeyboardShortcuts({
    bands: state.bands, selectedBand, setSelectedBand,
    updateBand, toggleBypass, undo, redo, setShowHelp,
  });

  const handleDrag = (id: number, freq: number, gain: number) => {
    const b = state.bands.find(b => b.id === id);
    if (!b) return;
    const hasGain = b.type !== FilterType.HighPass && b.type !== FilterType.LowPass;
    updateBand(id, hasGain ? { frequency: freq, gain } : { frequency: freq });
  };

  const handleAIApply = useCallback((bandId: number, freq: number, gain: number, q: number) => {
    updateBand(bandId, { frequency: freq, gain, q, enabled: true });
  }, [updateBand]);

  const handleOperation = useCallback((bandId: number, update: Partial<EQBand>) => {
    updateBand(bandId, update);
  }, [updateBand]);

  const handleSourceMode = (mode: AudioSourceMode) => {
    if (isPlaying) stop();
    setSourceMode(mode);
    setSourceError(null);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', overflowY: 'auto' }}>

      {/* ── Masthead ──────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(180deg,#1a1714 0%,#111008 100%)',
        borderBottom: '1px solid #2c2825',
        boxShadow: '0 2px 12px rgba(0,0,0,0.6)',
      }}>
        <div style={{
          maxWidth: 1024, margin: '0 auto',
          padding: '10px 24px 10px',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          {/* R3 NATIVE badge — forged metal */}
          <div style={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
            background: 'radial-gradient(circle at 35% 35%, #2c2420, #0f0d0a)',
            border: '1.5px solid rgba(196,134,42,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 10px rgba(196,134,42,0.18), inset 0 1px 0 rgba(255,235,200,0.08)',
          }}>
            <span style={{
              fontSize: 11, fontWeight: 900, color: '#C4862A',
              letterSpacing: '0.04em',
              fontFamily: 'Bebas Neue, Montserrat, sans-serif',
              textShadow: '0 0 8px rgba(196,134,42,0.5)',
            }}>R3</span>
          </div>

          {/* Title */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <div style={{
              fontSize: 22, lineHeight: 1,
              fontFamily: 'Bebas Neue, Montserrat, sans-serif',
              color: '#C4862A',
              letterSpacing: '0.05em',
              textShadow: '0 0 20px rgba(196,134,42,0.30), 0 1px 2px rgba(0,0,0,0.7)',
            }}>
              EQ MASTERCLASS
            </div>
            <div style={{ fontSize: 10, color: '#6e6660', letterSpacing: '0.14em', fontWeight: 700 }}>
              R3 V4
            </div>
            <div style={{ fontSize: 10, color: '#524c47', fontStyle: 'italic', letterSpacing: '0.02em' }}>
              by DJ Ernesto
            </div>
          </div>

          {/* Forge line */}
          <div style={{
            flex: 1, height: 1,
            background: 'linear-gradient(to right, rgba(196,134,42,0.20), transparent)',
          }} />

          {/* Slot pill */}
          <div style={{
            padding: '3px 10px', borderRadius: 3,
            border: '1px solid rgba(196,134,42,0.25)',
            background: 'linear-gradient(180deg,#2c2420 0%,#1a1410 100%)',
            fontSize: 9, fontWeight: 800, color: '#C4862A90',
            letterSpacing: '0.14em', flexShrink: 0,
            boxShadow: 'inset 0 1px 0 rgba(255,235,200,0.06)',
          }}>
            SLOT {activeSlot}
          </div>
        </div>
      </div>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1024, margin: '0 auto', padding: '0 24px 64px' }}>

        {/* Preset browser overlay */}
        {showBrowser && (
          <PresetBrowser
            presets={presets.presets}
            onLoad={p => { setState(p.state); setShowBrowser(false); }}
            onSave={name => { presets.save(name, state); setShowBrowser(false); }}
            onDelete={id => presets.remove(id)}
            onClose={() => setShowBrowser(false)}
          />
        )}

        <SectionLabel>EQ PLUGIN</SectionLabel>

        <EQPluginPanel
          state={state}
          curve={curve}
          selectedBand={selectedBand}
          onSelectBand={setSelectedBand}
          onBandDrag={handleDrag}
          onBandUpdate={updateBand}
          spectrumData={spectrumData}
          isPlaying={isPlaying}
          onPlay={play}
          onStop={stop}
          sourceMode={sourceMode}
          onSourceMode={handleSourceMode}
          sourceError={sourceError}
          onClearError={() => setSourceError(null)}
          loadFile={loadFile}
          fileReady={fileReady}
          fileName={fileName}
          bypass={state.bypass}
          onToggleBypass={toggleBypass}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          onReset={reset}
          onOpenPresets={() => setShowBrowser(true)}
          onShowHelp={() => setShowHelp(true)}
          activeSlot={activeSlot}
          onCaptureSlot={captureToSlot}
          onToggleAB={toggleAB}
          onAIApply={handleAIApply}
          fileDuration={fileDuration}
          fileCurrentTime={fileCurrentTime}
          onSeek={seek}
        />

        <ToolsPanel onApply={handleOperation} />

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div style={{ marginTop: 72, display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, rgba(196,134,42,0.15))' }} />
          <div style={{ textAlign: 'center', padding: '0 8px' }}>
            <div style={{
              fontSize: 18,
              fontFamily: 'Bebas Neue, Montserrat, sans-serif',
              color: '#524c47',
              letterSpacing: '0.24em',
              textShadow: '0 1px 4px rgba(0,0,0,0.6)',
            }}>
              LESS IS MORE. SPACE IS POWER.
            </div>
            <div style={{ fontSize: 9, color: '#3c3733', marginTop: 7, letterSpacing: '0.14em', fontWeight: 700 }}>
              R3 NATIVE · EQ MASTERCLASS · BY DJ ERNESTO
            </div>
          </div>
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, rgba(196,134,42,0.15))' }} />
        </div>
      </div>

      {/* ── Help overlay ─────────────────────────────────────────────────── */}
      {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}
    </div>
  );
}

// ── Section label ──────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '36px 0 14px' }}>
      <div style={{ width: 20, height: 1, background: 'rgba(196,134,42,0.35)', flexShrink: 0 }} />
      <span style={{
        fontSize: 11, fontWeight: 800, color: '#6e6660',
        letterSpacing: '0.24em', whiteSpace: 'nowrap',
        fontFamily: 'Bebas Neue, Montserrat, sans-serif',
      }}>{children}</span>
      <div style={{
        flex: 1, height: 1,
        background: 'linear-gradient(to right, rgba(196,134,42,0.12), transparent)',
      }} />
    </div>
  );
}

// ── Combined Tools Panel (EQ Operations + Pro Tips) ───────────────────────────

function ToolsPanel({ onApply }: { onApply: (bandId: number, update: import('./dsp').EQBand extends never ? never : Partial<import('./dsp').EQBand>) => void }) {
  const [open, setOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'ops' | 'tips'>('ops');

  return (
    <div style={{ marginTop: 28 }}>
      {/* ── Collapsible header bar ── */}
      <div
        onClick={() => setOpen(v => !v)}
        role="button"
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 0,
          background: open
            ? 'linear-gradient(180deg,#2a2520 0%,#1e1b16 100%)'
            : 'linear-gradient(180deg,#3a3530 0%,#252220 55%,#2e2825 100%)',
          border: '1px solid #4a4440',
          borderTop: `1px solid ${open ? 'rgba(196,134,42,0.45)' : '#5a5450'}`,
          borderBottom: open ? '1px solid #2c2825' : '1px solid #1a1612',
          borderRadius: open ? '6px 6px 0 0' : '6px',
          cursor: 'pointer',
          boxShadow: open
            ? 'inset 0 1px 0 rgba(255,235,200,0.06)'
            : 'inset 0 1px 0 rgba(255,235,200,0.07), inset 0 -1px 0 rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.5)',
          transition: 'all 180ms',
          overflow: 'hidden',
          userSelect: 'none',
        }}
      >
        {/* Left amber accent strip */}
        <div style={{
          width: 3, alignSelf: 'stretch', flexShrink: 0,
          background: open
            ? 'linear-gradient(180deg, rgba(196,134,42,0.7), rgba(196,134,42,0.3))'
            : 'rgba(196,134,42,0.2)',
          transition: 'background 180ms',
        }} />

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4 }}>
            {(['ops', 'tips'] as const).map(tab => (
              <button
                key={tab}
                onClick={e => { e.stopPropagation(); setOpen(true); setActiveTab(tab); }}
                style={{
                  padding: '3px 10px', borderRadius: 3,
                  fontSize: 9, fontWeight: 800, letterSpacing: '0.12em',
                  cursor: 'pointer',
                  background: (open && activeTab === tab)
                    ? 'linear-gradient(180deg,#1a1408 0%,#241c0a 100%)'
                    : 'transparent',
                  border: `1px solid ${(open && activeTab === tab) ? 'rgba(196,134,42,0.5)' : 'transparent'}`,
                  color: (open && activeTab === tab) ? '#C4862A' : '#6e6660',
                  boxShadow: (open && activeTab === tab) ? 'inset 0 1px 3px rgba(0,0,0,0.5)' : 'none',
                  transition: 'all 150ms',
                }}
              >
                {tab === 'ops' ? 'EQ OPERATIONS' : 'PRO TIPS'}
              </button>
            ))}
          </div>

          {/* Spacer + chevron */}
          <div style={{ flex: 1 }} />
          <span style={{
            fontSize: 10, color: open ? '#C4862A' : '#524c47',
            transform: open ? 'rotate(180deg)' : 'rotate(0)',
            display: 'inline-block', transition: 'all 200ms',
          }}>▾</span>
        </div>
      </div>

      {/* ── Collapsible body ── */}
      {open && (
        <div style={{
          border: '1px solid #4a4440',
          borderTop: 'none',
          borderRadius: '0 0 6px 6px',
          background: 'linear-gradient(180deg,#181510 0%,#111008 100%)',
          padding: '16px 16px 18px',
          boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.3)',
        }}>
          {activeTab === 'ops' && <OperationsGrid onApply={onApply} />}
          {activeTab === 'tips' && <ProTipsAccordion />}
        </div>
      )}
    </div>
  );
}

// ── Pro Tips Accordion ─────────────────────────────────────────────────────────

const PRO_TIPS = [
  {
    title: 'Surgical cuts, broad boosts',
    content: 'When cutting frequencies, use a narrow Q (high value) to surgically remove problem areas. When boosting, use a wide Q (low value) for a natural, musical sound. Narrow boosts can sound unnatural and harsh.',
    related: ['Q control', 'Peaking filter'],
  },
  {
    title: 'Always cut before you boost',
    content: 'Before adding gain anywhere, first try removing what\'s causing the problem. A 3 dB cut in the mud range (200–400 Hz) will make your highs sound brighter without adding any brightness at all.',
    related: ['Gain staging', 'Low-mid clarity'],
  },
  {
    title: 'High-pass everything (almost)',
    content: 'Apply a high-pass filter at 80 Hz or higher on most non-bass elements. Sub-bass frequencies on instruments like guitars or vocals add mud and waste headroom. Your mix will instantly sound cleaner and louder.',
    related: ['High Pass filter', 'Headroom'],
  },
  {
    title: 'The 3 kHz presence bump',
    content: 'Human hearing is most sensitive around 3–5 kHz. A gentle +2 to +3 dB boost here adds intelligibility and cut-through in a dense mix. It\'s why telephone audio sounds "present" even at low volumes.',
    related: ['Presence', 'Vocal clarity'],
  },
  {
    title: 'Reference on loop',
    content: 'Always compare your EQ\'d signal to the unprocessed original using the Bypass toggle. Our ears adapt to changes within seconds — bypass regularly to ensure you\'re actually improving the sound, not just making it different.',
    related: ['A/B comparison', 'Bypass'],
  },
];

function ProTipsAccordion() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div style={{
      border: '1px solid #2c2825',
      borderRadius: 8,
      overflow: 'hidden',
      background: 'linear-gradient(180deg,#141210 0%,#0f0d0a 100%)',
      boxShadow: 'inset 0 1px 0 rgba(255,235,200,0.04)',
    }}>
      {PRO_TIPS.map((tip, idx) => {
        const open = openIdx === idx;
        return (
          <div key={idx} style={{ borderBottom: idx < PRO_TIPS.length - 1 ? '1px solid #252220' : 'none' }}>
            <button
              onClick={() => setOpenIdx(open ? null : idx)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 16px', background: 'none', border: 'none',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              {/* Number rivet */}
              <span style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                background: open
                  ? 'radial-gradient(circle at 35% 35%, #C4862Acc, #C4862A66)'
                  : 'linear-gradient(180deg,#3a3530 0%,#252220 100%)',
                border: `1px solid ${open ? 'rgba(196,134,42,0.55)' : '#4a4440'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 800,
                color: open ? '#0a0908' : '#6e6660',
                boxShadow: open ? '0 0 6px rgba(196,134,42,0.3)' : 'inset 0 1px 0 rgba(255,235,200,0.06)',
                transition: 'all 200ms',
              }}>{idx + 1}</span>

              <span style={{
                fontSize: 12, fontWeight: 700,
                color: open ? '#D8D0C4' : '#a09080',
                letterSpacing: '0.04em',
                transition: 'color 200ms',
              }}>{tip.title}</span>

              <span style={{
                marginLeft: 'auto', fontSize: 11,
                color: open ? '#C4862A' : '#524c47',
                transition: 'all 200ms',
                transform: open ? 'rotate(180deg)' : 'rotate(0)',
                display: 'inline-block',
              }}>▾</span>
            </button>

            {open && (
              <div style={{
                borderTop: '1px solid #252220',
                padding: '12px 16px 14px 48px',
              }}>
                <p style={{
                  fontSize: 12, lineHeight: 1.65,
                  color: '#8a8078',
                  marginBottom: 10,
                }}>{tip.content}</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 9, color: '#524c47', letterSpacing: '0.06em' }}>Related:</span>
                  {tip.related.map(tag => (
                    <span key={tag} style={{
                      fontSize: 9, padding: '2px 7px', borderRadius: 3,
                      background: 'linear-gradient(180deg,#2c2825 0%,#1e1b18 100%)',
                      border: '1px solid #3c3733',
                      color: '#6e6660', letterSpacing: '0.04em',
                      boxShadow: 'inset 0 1px 0 rgba(255,235,200,0.05)',
                    }}>{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Help Overlay ───────────────────────────────────────────────────────────────

function HelpOverlay({ onClose }: { onClose: () => void }) {
  const SHORTCUTS = [
    { keys: ['1 – 8'], desc: 'Select band 1–8' },
    { keys: ['←', '→'], desc: 'Adjust frequency (fine)' },
    { keys: ['↑', '↓'], desc: 'Adjust gain ±0.5 dB' },
    { keys: ['Ctrl+Z'], desc: 'Undo' },
    { keys: ['Ctrl+Y'], desc: 'Redo' },
    { keys: ['B'], desc: 'Toggle bypass' },
    { keys: ['?'], desc: 'Show/hide help' },
  ];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.82)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'linear-gradient(180deg,#1c1916 0%,#141210 100%)',
          border: '1px solid #3c3733',
          borderTop: '2px solid rgba(196,134,42,0.4)',
          borderRadius: 10,
          padding: '24px 28px',
          minWidth: 320, maxWidth: 400,
          boxShadow: '0 0 60px rgba(0,0,0,0.8), 0 0 20px rgba(196,134,42,0.08)',
        }}
      >
        <div style={{
          fontSize: 20, fontWeight: 800, color: '#C4862A',
          letterSpacing: '0.14em',
          fontFamily: 'Bebas Neue, Montserrat, sans-serif',
          marginBottom: 16,
          textShadow: '0 0 12px rgba(196,134,42,0.3)',
        }}>KEYBOARD SHORTCUTS</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SHORTCUTS.map(s => (
            <div key={s.desc} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '4px 0',
              borderBottom: '1px solid #252220',
            }}>
              <span style={{ fontSize: 12, color: '#8a8078' }}>{s.desc}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {s.keys.map(k => (
                  <kbd key={k} style={{
                    fontSize: 10, padding: '2px 6px', borderRadius: 3,
                    background: 'linear-gradient(180deg,#3a3530 0%,#252220 100%)',
                    border: '1px solid #4a4440',
                    borderBottom: '2px solid #1a1612',
                    color: '#C4862A', fontFamily: 'monospace',
                    boxShadow: 'inset 0 1px 0 rgba(255,235,200,0.07)',
                  }}>{k}</kbd>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: 20, width: '100%',
            padding: '8px', borderRadius: 5,
            background: 'linear-gradient(180deg,#2e2610 0%,#1e1a0a 50%,#252010 100%)',
            border: '1px solid rgba(196,134,42,0.45)',
            color: '#C4862A', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
            cursor: 'pointer',
            boxShadow: 'inset 0 1px 0 rgba(255,235,200,0.08), 0 0 8px rgba(196,134,42,0.12)',
          }}
        >CLOSE</button>
      </div>
    </div>
  );
}
