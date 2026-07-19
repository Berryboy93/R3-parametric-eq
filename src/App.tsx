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
    <div style={{ minHeight: '100vh', background: '#06060a', overflowY: 'auto' }}>

      {/* ── Masthead ──────────────────────────────────────────────────────── */}
      <div style={{
        background: '#09090f',
        borderBottom: '1px solid #151525',
      }}>
        <div style={{
          maxWidth: 1024, margin: '0 auto',
          padding: '10px 24px 10px',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          {/* R3 NATIVE circular badge */}
          <div style={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
            background: 'radial-gradient(circle at 35% 35%, #0f0f20, #060608)',
            border: '1.5px solid rgba(183,255,0,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(183,255,0,0.10), inset 0 0 8px rgba(183,255,0,0.04)',
          }}>
            <span style={{
              fontSize: 11, fontWeight: 900, color: '#B7FF00',
              letterSpacing: '0.04em',
              fontFamily: 'Bebas Neue, Montserrat, sans-serif',
            }}>R3</span>
          </div>

          {/* Title block */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <div style={{
              fontSize: 22, lineHeight: 1,
              fontFamily: 'Bebas Neue, Montserrat, sans-serif',
              color: '#B7FF00',
              letterSpacing: '0.05em',
              textShadow: '0 0 24px rgba(183,255,0,0.18)',
            }}>
              EQ MASTERCLASS
            </div>
            <div style={{
              fontSize: 10, color: '#35354a', letterSpacing: '0.14em',
              fontWeight: 700,
            }}>
              R3 V4
            </div>
            <div style={{
              fontSize: 10, color: '#40405a', fontStyle: 'italic',
              letterSpacing: '0.02em',
            }}>
              by DJ Ernesto
            </div>
          </div>

          {/* Decorative rule */}
          <div style={{
            flex: 1, height: 1,
            background: 'linear-gradient(to right, rgba(183,255,0,0.10), transparent)',
          }} />

          {/* Slot indicator pill */}
          <div style={{
            padding: '3px 10px', borderRadius: 20,
            border: '1px solid rgba(183,255,0,0.15)',
            background: 'rgba(183,255,0,0.04)',
            fontSize: 9, fontWeight: 800, color: '#B7FF0070',
            letterSpacing: '0.14em',
            flexShrink: 0,
          }}>
            SLOT {activeSlot}
          </div>
        </div>
      </div>

      {/* ── Page content ─────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 1024, margin: '0 auto', padding: '0 24px 80px' }}>

        {/* ── EQ Plugin Panel ─────────────────────────────────────────────── */}
        <EQPluginPanel
          state={state}
          curve={curve}
          selectedBand={selectedBand}
          onSelectBand={setSelectedBand}
          onBandDrag={handleDrag}
          onBandUpdate={(id, u) => updateBand(id, u)}
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
        />

        {/* ── EQ Operations ───────────────────────────────────────────────── */}
        <SectionLabel>EQ OPERATIONS</SectionLabel>
        <OperationsGrid onApply={handleOperation} />

        {/* ── Pro Tips ────────────────────────────────────────────────────── */}
        <ProTipsAccordion />

        {/* ── Footer quote ────────────────────────────────────────────────── */}
        <div style={{ marginTop: 72, display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(183,255,0,0.07)' }} />
          <div style={{ textAlign: 'center', padding: '0 8px' }}>
            <div style={{
              fontSize: 20,
              fontFamily: 'Bebas Neue, Montserrat, sans-serif',
              color: '#35354a',
              letterSpacing: '0.24em',
            }}>
              LESS IS MORE. SPACE IS POWER.
            </div>
            <div style={{
              fontSize: 9, color: '#252535', marginTop: 7,
              letterSpacing: '0.14em', fontWeight: 700,
            }}>
              R3 NATIVE · EQ MASTERCLASS · BY DJ ERNESTO
            </div>
          </div>
          <div style={{ flex: 1, height: 1, background: 'rgba(183,255,0,0.07)' }} />
        </div>
      </main>

      {/* ── Preset Browser modal ──────────────────────────────────────────── */}
      {showBrowser && (
        <PresetBrowser
          factoryPresets={presets.factoryPresets}
          userPresets={presets.userPresets}
          currentState={state}
          onLoad={p => { setState(p.state as any); setShowBrowser(false); }}
          onSave={(name, st, cat) => presets.savePreset(name, st, cat)}
          onDelete={id => presets.deletePreset(id)}
          onExport={id => presets.exportPreset(id)}
          onImport={json => presets.importPreset(json)}
          onClose={() => setShowBrowser(false)}
        />
      )}

      {/* ── Keyboard shortcut help ────────────────────────────────────────── */}
      {showHelp && <ShortcutOverlay onClose={() => setShowHelp(false)} />}
    </div>
  );
}

// ── Section label ──────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      margin: '36px 0 14px',
    }}>
      <div style={{ width: 20, height: 1, background: 'rgba(183,255,0,0.2)', flexShrink: 0 }} />
      <span style={{
        fontSize: 13, fontWeight: 800, color: '#404055',
        letterSpacing: '0.24em', whiteSpace: 'nowrap',
        fontFamily: 'Bebas Neue, Montserrat, sans-serif',
      }}>{children}</span>
      <div style={{
        flex: 1, height: 1,
        background: 'linear-gradient(to right, rgba(183,255,0,0.07), transparent)',
      }} />
    </div>
  );
}

// ── Pro tips data ──────────────────────────────────────────────────────────────

const PRO_TIPS = [
  {
    icon: '✂️',
    title: 'Cut Before Boosting',
    body: 'Identify and reduce problem frequencies before reaching for a boost. A targeted cut is more transparent and costs nothing in loudness — unnecessary boosts add phase distortion and mask other elements in your mix.',
  },
  {
    icon: '🎯',
    title: 'Small EQ Moves',
    body: 'Most professional EQ moves are ±3 dB or less. Subtle changes are more musical and stack better across instruments. If you need more than 6 dB to fix something, there\'s likely a deeper issue in the recording or signal chain.',
  },
  {
    icon: '👂',
    title: 'Trust Your Ears',
    body: 'Use bypass frequently to A/B compare your EQ against the raw signal. If you can\'t clearly hear the difference on playback, the change may be unnecessary. The best EQ move is often the one you don\'t make.',
  },
];

// ── Pro Tips accordion ────────────────────────────────────────────────────────

function ProTipsAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div style={{ marginTop: 0 }}>
      <SectionLabel>PRO TIPS</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {PRO_TIPS.map((tip, i) => {
          const isOpen = openIndex === i;
          return (
            <div
              key={tip.title}
              style={{
                background: '#09090f',
                border: '1px solid #151525',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              {/* Header row — always visible */}
              <button
                onClick={() => setOpenIndex(isOpen ? null : i)}
                style={{
                  width: '100%',
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 14px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  outline: 'none', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>{tip.icon}</span>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: '#a0a0be',
                  letterSpacing: '0.05em', fontFamily: 'Montserrat, sans-serif', flex: 1,
                }}>
                  {tip.title}
                </span>
                <span style={{
                  fontSize: 10, color: '#303048', transition: 'transform 150ms',
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  display: 'inline-block',
                }}>▾</span>
              </button>

              {/* Collapsible body */}
              {isOpen && (
                <div style={{
                  padding: '0 14px 12px 38px',
                  fontSize: 11, color: '#484860', lineHeight: 1.75,
                  borderTop: '1px solid #111120',
                  paddingTop: 10,
                }}>
                  {tip.body}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Shortcut overlay ──────────────────────────────────────────────────────────

function ShortcutOverlay({ onClose }: { onClose: () => void }) {
  const rows: [string, string][] = [
    ['Tab / Shift+Tab',       'Cycle through bands'],
    ['← / →',                'Nudge frequency ×1.05'],
    ['Shift+← / →',          'Nudge frequency ×1.3'],
    ['↑ / ↓',                'Nudge gain ±0.5 dB'],
    ['Shift+↑ / ↓',          'Nudge gain ±3 dB'],
    ['E',                     'Toggle band on / off'],
    ['B',                     'Toggle bypass'],
    ['Ctrl+Z',                'Undo'],
    ['Ctrl+Y / Ctrl+Shift+Z', 'Redo'],
    ['?',                     'Toggle this panel'],
  ];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0d0d1a', border: '1px solid #252538',
          borderRadius: 10, padding: '22px 26px', minWidth: 380,
          boxShadow: '0 12px 60px rgba(0,0,0,0.8)',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', marginBottom: 16,
        }}>
          <span style={{
            fontSize: 11, fontWeight: 800, color: '#606080', letterSpacing: '0.14em',
          }}>KEYBOARD SHORTCUTS</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#404050', fontSize: 18, cursor: 'pointer' }}
          >✕</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {rows.map(([k, d]) => (
              <tr key={k} style={{ borderBottom: '1px solid #12121e' }}>
                <td style={{ padding: '6px 14px 6px 0', whiteSpace: 'nowrap' }}>
                  <kbd style={{
                    background: '#13131e', border: '1px solid #252535', borderRadius: 4,
                    padding: '2px 8px', fontSize: 10, color: '#8080a0', fontFamily: 'monospace',
                  }}>{k}</kbd>
                </td>
                <td style={{ fontSize: 11, color: '#606070', padding: '6px 0' }}>{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ margin: '14px 0 0', fontSize: 10, color: '#303040', textAlign: 'center' }}>
          click outside or press{' '}
          <kbd style={{
            background: '#13131e', border: '1px solid #252535',
            borderRadius: 3, padding: '1px 6px', fontSize: 9, color: '#606070',
          }}>?</kbd>{' '}to close
        </p>
      </div>
    </div>
  );
}
