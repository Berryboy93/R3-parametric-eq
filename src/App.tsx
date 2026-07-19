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
        background: '#111111',
        borderBottom: '1px solid #242424',
        boxShadow: '0 2px 12px rgba(0,0,0,0.6)',
      }}>
        <div style={{
          maxWidth: 1024, margin: '0 auto',
          padding: '10px 24px 10px',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          {/* R3 NATIVE badge */}
          <div style={{
            width: 50, height: 50, borderRadius: '50%', flexShrink: 0,
            background: 'radial-gradient(circle at 32% 32%, #1a2800 0%, #0d1400 50%, #080808 100%)',
            border: '2px solid rgba(183,255,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'greenPulse 3s ease-in-out infinite',
            position: 'relative',
          }}>
            {/* Concentric inner ring */}
            <div style={{
              position: 'absolute', inset: 4, borderRadius: '50%',
              border: '1px solid rgba(183,255,0,0.18)',
              pointerEvents: 'none',
            }} />
            <span style={{
              fontSize: 15, fontWeight: 900, color: '#B7FF00',
              letterSpacing: '0.02em',
              fontFamily: 'Bebas Neue, Montserrat, sans-serif',
              textShadow: '0 0 10px rgba(183,255,0,0.7)',
              lineHeight: 1,
            }}>R3</span>
          </div>

          {/* Title block */}
          <div style={{ animation: 'fadeInDown 0.6s ease-out' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{
                  fontSize: 20, lineHeight: 1,
                  fontFamily: 'Bebas Neue, Montserrat, sans-serif',
                  color: '#B7FF00',
                  letterSpacing: '0.08em',
                  textShadow: '0 0 18px rgba(183,255,0,0.30), 0 1px 2px rgba(0,0,0,0.7)',
                }}>
                  EQ MASTERCLASS
                </div>
                {/* Neon green underline */}
                <div style={{
                  height: 2,
                  background: 'linear-gradient(to right, rgba(183,255,0,0.8), rgba(183,255,0,0.2), transparent)',
                  borderRadius: 1,
                }} />
              </div>
              <div style={{ fontSize: 10, color: '#505050', letterSpacing: '0.14em', fontWeight: 700, marginBottom: 4 }}>
                R3 V4
              </div>
            </div>
            <div style={{
              fontSize: 10, color: '#606060', fontStyle: 'italic',
              letterSpacing: '0.06em', marginTop: 2,
            }}>
              by DJ Ernesto
            </div>
          </div>

          {/* Divider line */}
          <div style={{
            flex: 1, height: 1,
            background: 'linear-gradient(to right, rgba(183,255,0,0.15), transparent)',
          }} />

          {/* Slot pill */}
          <div style={{
            padding: '3px 10px', borderRadius: 3,
            border: '1px solid rgba(183,255,0,0.22)',
            background: '#141414',
            fontSize: 9, fontWeight: 800, color: 'rgba(183,255,0,0.55)',
            letterSpacing: '0.14em', flexShrink: 0,
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
        <div style={{
          marginTop: 72,
          borderTop: '1px solid #242424',
          borderBottom: '1px solid #242424',
          padding: '28px 0 26px',
          textAlign: 'center',
          position: 'relative',
        }}>
          {/* Decorative neon lines */}
          <div style={{
            position: 'absolute', top: '50%', left: 0,
            transform: 'translateY(-50%)',
            width: 140, height: 2, borderRadius: 1,
            background: 'linear-gradient(to right, transparent, rgba(183,255,0,0.40), transparent)',
            animation: 'greenShimmer 3s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute', top: '50%', right: 0,
            transform: 'translateY(-50%)',
            width: 140, height: 2, borderRadius: 1,
            background: 'linear-gradient(to left, transparent, rgba(183,255,0,0.40), transparent)',
            animation: 'greenShimmer 3s ease-in-out infinite',
          }} />

          <div style={{
            fontSize: 16, fontStyle: 'italic', fontWeight: 600,
            fontFamily: 'Montserrat, sans-serif',
            color: '#505050',
            letterSpacing: '0.06em',
            lineHeight: 1.6,
          }}>
            <span style={{ color: '#B7FF00', fontSize: 22, opacity: 0.7, marginRight: 6, verticalAlign: 'middle' }}>"</span>
            LESS IS MORE. SPACE IS POWER.
            <span style={{ color: '#B7FF00', fontSize: 22, opacity: 0.7, marginLeft: 6, verticalAlign: 'middle' }}>"</span>
          </div>
          <div style={{ fontSize: 9, color: '#2e2e2e', marginTop: 10, letterSpacing: '0.16em', fontWeight: 700 }}>
            R3 NATIVE · EQ MASTERCLASS · BY DJ ERNESTO
          </div>
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '36px 0 14px' }}>
      {/* Neon green left-border accent */}
      <div style={{
        width: 4, height: 18, flexShrink: 0, borderRadius: 2,
        background: 'linear-gradient(180deg, rgba(183,255,0,0.9), rgba(183,255,0,0.25))',
      }} />
      <span style={{
        fontSize: 11, fontWeight: 800, color: '#505050',
        letterSpacing: '0.24em', whiteSpace: 'nowrap',
        fontFamily: 'Bebas Neue, Montserrat, sans-serif',
        textTransform: 'uppercase',
      }}>{children}</span>
      <div style={{
        flex: 1, height: 1,
        background: 'linear-gradient(to right, rgba(183,255,0,0.15), transparent)',
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
          background: open ? '#161616' : '#1a1a1a',
          border: '1px solid #2e2e2e',
          borderTop: `1px solid ${open ? 'rgba(183,255,0,0.35)' : '#3a3a3a'}`,
          borderBottom: open ? '1px solid #1e1e1e' : '1px solid #111111',
          borderRadius: open ? '6px 6px 0 0' : '6px',
          cursor: 'pointer',
          boxShadow: open
            ? 'none'
            : 'inset 0 1px 0 rgba(255,255,255,0.03), inset 0 -1px 0 rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.5)',
          transition: 'all 180ms',
          overflow: 'hidden',
          userSelect: 'none',
        }}
      >
        {/* Left neon accent strip */}
        <div style={{
          width: 3, alignSelf: 'stretch', flexShrink: 0,
          background: open
            ? 'linear-gradient(180deg, rgba(183,255,0,0.7), rgba(183,255,0,0.2))'
            : 'rgba(183,255,0,0.15)',
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
                    ? 'rgba(183,255,0,0.08)'
                    : 'transparent',
                  border: `1px solid ${(open && activeTab === tab) ? 'rgba(183,255,0,0.40)' : 'transparent'}`,
                  color: (open && activeTab === tab) ? '#B7FF00' : '#606060',
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
            fontSize: 10, color: open ? '#B7FF00' : '#3a3a3a',
            transform: open ? 'rotate(180deg)' : 'rotate(0)',
            display: 'inline-block', transition: 'all 200ms',
          }}>▾</span>
        </div>
      </div>

      {/* ── Collapsible body ── */}
      {open && (
        <div style={{
          border: '1px solid #2e2e2e',
          borderTop: 'none',
          borderRadius: '0 0 6px 6px',
          background: '#111111',
          padding: '16px 16px 18px',
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
      border: '1px solid #2a2a2a',
      borderLeft: '3px solid rgba(183,255,0,0.45)',
      borderRadius: 8,
      overflow: 'hidden',
      background: '#141414',
    }}>
      {PRO_TIPS.map((tip, idx) => {
        const open = openIdx === idx;
        return (
          <div key={idx} style={{ borderBottom: idx < PRO_TIPS.length - 1 ? '1px solid #1e1e1e' : 'none' }}>
            <button
              onClick={() => setOpenIdx(open ? null : idx)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 16px', background: 'none', border: 'none',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              {/* Number badge */}
              <span style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                background: open
                  ? 'radial-gradient(circle at 35% 35%, #d4ff40cc, #B7FF0066)'
                  : '#242424',
                border: `1px solid ${open ? 'rgba(183,255,0,0.55)' : '#3a3a3a'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 800,
                color: open ? '#080808' : '#606060',
                boxShadow: open ? '0 0 8px rgba(183,255,0,0.30)' : 'none',
                transition: 'all 200ms',
              }}>{idx + 1}</span>

              <span style={{
                fontSize: 12, fontWeight: 700,
                color: open ? '#E6E6E6' : '#909090',
                letterSpacing: '0.04em',
                transition: 'color 200ms',
              }}>{tip.title}</span>

              <span style={{
                marginLeft: 'auto', fontSize: 11,
                color: open ? '#B7FF00' : '#3a3a3a',
                transition: 'all 200ms',
                transform: open ? 'rotate(180deg)' : 'rotate(0)',
                display: 'inline-block',
              }}>▾</span>
            </button>

            {open && (
              <div style={{
                borderTop: '1px solid #1e1e1e',
                padding: '12px 16px 14px 48px',
              }}>
                <p style={{
                  fontSize: 12, lineHeight: 1.65,
                  color: '#808080',
                  marginBottom: 10,
                }}>{tip.content}</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 9, color: '#484848', letterSpacing: '0.06em' }}>Related:</span>
                  {tip.related.map(tag => (
                    <span key={tag} style={{
                      fontSize: 9, padding: '2px 7px', borderRadius: 3,
                      background: '#1a1a1a',
                      border: '1px solid #2e2e2e',
                      color: '#606060', letterSpacing: '0.04em',
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
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#141414',
          border: '1px solid #2e2e2e',
          borderTop: '2px solid rgba(183,255,0,0.45)',
          borderRadius: 10,
          padding: '24px 28px',
          minWidth: 320, maxWidth: 400,
          boxShadow: '0 0 60px rgba(0,0,0,0.8), 0 0 20px rgba(183,255,0,0.06)',
        }}
      >
        <div style={{
          fontSize: 20, fontWeight: 800, color: '#B7FF00',
          letterSpacing: '0.14em',
          fontFamily: 'Bebas Neue, Montserrat, sans-serif',
          marginBottom: 16,
          textShadow: '0 0 12px rgba(183,255,0,0.3)',
        }}>KEYBOARD SHORTCUTS</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SHORTCUTS.map(s => (
            <div key={s.desc} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '4px 0',
              borderBottom: '1px solid #1e1e1e',
            }}>
              <span style={{ fontSize: 12, color: '#808080' }}>{s.desc}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {s.keys.map(k => (
                  <kbd key={k} style={{
                    fontSize: 10, padding: '2px 6px', borderRadius: 3,
                    background: '#1e1e1e',
                    border: '1px solid #3a3a3a',
                    borderBottom: '2px solid #111111',
                    color: '#B7FF00', fontFamily: 'monospace',
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
            background: 'rgba(183,255,0,0.08)',
            border: '1px solid rgba(183,255,0,0.40)',
            color: '#B7FF00', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
            cursor: 'pointer',
            boxShadow: '0 0 8px rgba(183,255,0,0.10)',
          }}
        >CLOSE</button>
      </div>
    </div>
  );
}
