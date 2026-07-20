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
    sourceMode, setSourceMode, switchSource, sourceError, setSourceError,
    loadFile, fileReady, fileName,
    fileDuration, fileCurrentTime, seek,
    cacheError, setCacheError,
    clearCachedFile, fileFromCache,
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

  // switchSource handles fade-out → teardown → mode update → fade-in atomically
  const handleSourceMode = useCallback((mode: AudioSourceMode) => {
    setSourceError(null);
    if (isPlaying) {
      // Seamlessly cross-fade to the new source — no manual PLAY required
      switchSource(mode);
    } else {
      setSourceMode(mode);
    }
  }, [isPlaying, switchSource, setSourceMode, setSourceError]);

  const handleClearCachedFile = useCallback(async () => {
    if (isPlaying) stop();
    await clearCachedFile();
    setSourceMode('pink-noise');
  }, [isPlaying, stop, clearCachedFile, setSourceMode]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', overflowY: 'auto' }}>

      {/* ── Masthead ──────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #080808 0%, #0F1219 100%)',
        borderBottom: '1px solid #242424',
        boxShadow: '0 2px 12px rgba(0,0,0,0.6)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Studio background texture */}
        <div style={{
          position: 'absolute', right: 0, top: 0,
          width: '40%', height: '100%',
          background: 'linear-gradient(to left, rgba(183,255,0,0.03), transparent)',
          pointerEvents: 'none',
        }} />

        <div style={{
          maxWidth: 1024, margin: '0 auto',
          padding: '20px 24px 18px',
          display: 'flex', alignItems: 'center', gap: 18,
          position: 'relative', zIndex: 1,
        }}>
          {/* R3 NATIVE badge */}
          <div style={{
            width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
            background: 'radial-gradient(circle at 32% 32%, #1a2800 0%, #0d1400 50%, #080808 100%)',
            border: '2px solid rgba(183,255,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'greenPulse 3s ease-in-out infinite',
            position: 'relative',
            boxShadow: '0 0 16px rgba(183,255,0,0.20)',
          }}>
            {/* Music note icon */}
            <span style={{ fontSize: 18, lineHeight: 1 }}>♪</span>
            {/* Concentric inner ring */}
            <div style={{
              position: 'absolute', inset: 4, borderRadius: '50%',
              border: '1px solid rgba(183,255,0,0.20)',
              pointerEvents: 'none',
            }} />
            <span style={{
              position: 'absolute',
              fontSize: 11, fontWeight: 900, color: '#B7FF00',
              letterSpacing: '0.02em',
              fontFamily: 'Bebas Neue, Montserrat, sans-serif',
              textShadow: '0 0 10px rgba(183,255,0,0.7)',
              lineHeight: 1,
              bottom: 8,
            }}>R3</span>
          </div>

          {/* Title block */}
          <div style={{ flex: 1, animation: 'fadeInDown 0.6s ease-out' }}>
            {/* Brand label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{
                fontSize: 11, fontWeight: 700,
                fontFamily: 'Bebas Neue, Montserrat, sans-serif',
                color: '#B7FF00',
                letterSpacing: '0.22em',
                borderBottom: '2px solid #B7FF00',
                paddingBottom: 2,
                textTransform: 'uppercase',
              }}>R3 V4 NATIVE</span>
              <span style={{ fontSize: 9, color: '#404040', letterSpacing: '0.14em', fontWeight: 700 }}>
                LOOPSTATION MASTERCLASS
              </span>
            </div>

            {/* Main heading */}
            <div style={{
              fontSize: 28, lineHeight: 1,
              fontFamily: 'Bebas Neue, Montserrat, sans-serif',
              color: '#FFFFFF',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}>
              EQ MASTERCLASS
            </div>

            {/* Tagline */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginTop: 4,
            }}>
              <span style={{
                fontSize: 11, color: '#B7B7C0',
                fontFamily: 'Montserrat, sans-serif',
                letterSpacing: '0.04em',
              }}>EQ Mixing Guide</span>
              <span style={{ color: '#2a2a2a', fontSize: 10 }}>·</span>
              <span style={{
                fontSize: 11, color: '#B7FF00', opacity: 0.85,
                fontFamily: 'Montserrat, sans-serif',
              }}>Perfect your sound.</span>
            </div>

            {/* Attribution */}
            <div style={{
              fontSize: 11, color: '#B7FF00', opacity: 0.7,
              fontStyle: 'italic', fontWeight: 600,
              letterSpacing: '0.06em', marginTop: 3,
              fontFamily: 'Montserrat, sans-serif',
            }}>
              by DJ Ernesto
            </div>
          </div>

          {/* Slot pill */}
          <div style={{
            padding: '4px 12px', borderRadius: 4,
            border: '1px solid rgba(183,255,0,0.25)',
            background: '#141414',
            fontSize: 9, fontWeight: 800, color: 'rgba(183,255,0,0.6)',
            letterSpacing: '0.14em', flexShrink: 0,
            boxShadow: '0 0 8px rgba(183,255,0,0.08)',
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
            factoryPresets={presets.factoryPresets}
            userPresets={presets.userPresets}
            currentState={state}
            onLoad={p => { setState(p.state); setShowBrowser(false); }}
            onSave={(name, st, cat) => { presets.savePreset(name, st, cat); setShowBrowser(false); }}
            onDelete={id => presets.deletePreset(id)}
            onExport={id => presets.exportPreset(id)}
            onImport={json => presets.importPreset(json)}
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
          onSwitchSource={switchSource}
          sourceError={sourceError}
          onClearError={() => setSourceError(null)}
          loadFile={loadFile}
          fileReady={fileReady}
          fileName={fileName}
          fileFromCache={fileFromCache}
          onClearCachedFile={handleClearCachedFile}
          cacheError={cacheError}
          onClearCacheError={() => setCacheError(null)}
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
            color: '#FFFFFF',
            letterSpacing: '0.06em',
            lineHeight: 1.6,
          }}>
            <span style={{ color: '#B7FF00', fontSize: 22, opacity: 0.8, marginRight: 6, verticalAlign: 'middle' }}>"</span>
            LESS IS MORE. SPACE IS POWER.
            <span style={{ color: '#B7FF00', fontSize: 22, opacity: 0.8, marginLeft: 6, verticalAlign: 'middle' }}>"</span>
          </div>
          <div style={{ fontSize: 9, color: '#505050', marginTop: 10, letterSpacing: '0.16em', fontWeight: 700 }}>
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
        fontSize: 11, fontWeight: 800, color: '#707070',
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
          {activeTab === 'tips' && <ProTipsPanel />}
        </div>
      )}
    </div>
  );
}

// ── Pro Tips ───────────────────────────────────────────────────────────────────

const PRO_TIPS_DATA = [
  {
    icon: '✂',
    title: 'CUT BEFORE BOOSTING',
    content: 'Always cut problem frequencies before boosting others. Subtractive EQ creates cleaner mixes.',
  },
  {
    icon: '≈',
    title: 'SMALL MOVES',
    content: 'Keep EQ moves under ±3 dB for a natural sound. Subtle corrections are more musical than drastic cuts.',
  },
  {
    icon: '◉',
    title: 'TRUST YOUR EARS',
    content: 'Reference your EQ against the bypassed signal regularly. Your ears adapt — bypass often to stay honest.',
  },
];

function ProTipsPanel() {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #1A2535 0%, #0F1219 100%)',
      border: '1px solid #242424',
      borderLeft: '6px solid #B7FF00',
      borderRadius: 8,
      padding: '20px 24px',
      position: 'relative',
    }}>
      {/* PRO TIPS label */}
      <div style={{
        fontSize: 10, fontWeight: 800, color: '#B7FF00',
        letterSpacing: '0.18em', marginBottom: 16,
        fontFamily: 'Bebas Neue, Montserrat, sans-serif',
        textTransform: 'uppercase',
      }}>PRO TIPS</div>

      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
        {PRO_TIPS_DATA.map((tip, i) => (
          <div key={i} style={{
            flex: '1 1 160px',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            textAlign: 'center', gap: 8,
          }}>
            {/* Icon */}
            <div style={{
              width: 36, height: 36,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, color: '#B7FF00',
              filter: 'drop-shadow(0 0 6px rgba(183,255,0,0.4))',
            }}>{tip.icon}</div>

            {/* Title */}
            <div style={{
              fontSize: 11, fontWeight: 800, color: '#B7FF00',
              letterSpacing: '0.06em',
              fontFamily: 'Bebas Neue, Montserrat, sans-serif',
              textTransform: 'uppercase',
            }}>{tip.title}</div>

            {/* Description */}
            <div style={{
              fontSize: 11, color: '#FFFFFF', lineHeight: 1.5,
              fontFamily: 'Montserrat, sans-serif',
              opacity: 0.85,
            }}>{tip.content}</div>
          </div>
        ))}
      </div>

      {/* DJ Ernesto signature */}
      <div style={{
        textAlign: 'right', marginTop: 16,
        fontSize: 12, color: '#B7FF00', opacity: 0.6,
        fontStyle: 'italic', fontWeight: 600,
        fontFamily: 'Montserrat, sans-serif',
        letterSpacing: '0.04em',
      }}>— DJ Ernesto</div>
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
