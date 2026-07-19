/**
 * AIPanel — AI-powered EQ recommendations
 * Smoky metallic aesthetic — amber/copper accents
 */

import { useEffect, useState, useCallback } from 'react';
import { AIEQAnalyzer, FilterType } from '../dsp';
import type { AIRecommendation, EQBand } from '../dsp';
import { FrequencyIssue } from '../dsp';

const analyzer = new AIEQAnalyzer();
const SAMPLE_RATE = 48000;
const FFT_SIZE    = 4096;

const ISSUE_META: Record<string, { label: string; icon: string; color: string }> = {
  [FrequencyIssue.Mud]:       { label: 'Mud',       icon: '🟤', color: '#C4862A' },
  [FrequencyIssue.Harshness]: { label: 'Harshness', icon: '🔴', color: '#C45A3A' },
  [FrequencyIssue.Sibilance]: { label: 'Sibilance', icon: '🟡', color: '#C9A840' },
  [FrequencyIssue.Boominess]: { label: 'Boominess', icon: '🟠', color: '#C47B3A' },
};

interface Props {
  spectrumData: Float32Array | null;
  isPlaying: boolean;
  bands: readonly EQBand[];
  onApply: (bandId: number, freq: number, gain: number, q: number) => void;
}

export function AIPanel({ spectrumData, isPlaying, bands, onApply }: Props) {
  const [open, setOpen]               = useState(true);
  const [recs, setRecs]               = useState<readonly AIRecommendation[]>([]);
  const [applied, setApplied]         = useState<Set<string>>(new Set());
  const [lastAnalyzed, setLastAnalyzed] = useState<number>(0);

  useEffect(() => {
    if (!spectrumData || !isPlaying) return;
    const now = Date.now();
    if (now - lastAnalyzed < 2000) return;
    const result = analyzer.analyzeSpectrum(spectrumData, SAMPLE_RATE, FFT_SIZE);
    setRecs(result.recommendations);
    setLastAnalyzed(now);
  }, [spectrumData, isPlaying, lastAnalyzed]);

  useEffect(() => {
    if (!isPlaying) { setRecs([]); setApplied(new Set()); }
  }, [isPlaying]);

  const handleApply = useCallback((rec: AIRecommendation) => {
    const peaking = bands.filter(b => b.type === FilterType.Peaking);
    const target  = peaking.find(b => !b.enabled) ?? peaking[0];
    if (!target) return;
    onApply(target.id, rec.detectedFrequency, rec.suggestedGain, rec.suggestedQ);
    setApplied(prev => new Set([...prev, rec.issue]));
  }, [bands, onApply]);

  return (
    <div style={{
      margin: '0 14px',
      border: '1px solid #2c2825',
      borderRadius: 5,
      overflow: 'hidden',
      background: 'linear-gradient(180deg,#141210 0%,#0f0d0a 100%)',
      boxShadow: 'inset 0 1px 0 rgba(255,235,200,0.04)',
    }}>
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 12px', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
        aria-expanded={open}
      >
        <span style={{ fontSize: 13 }}>⚙️</span>
        <span style={{
          fontSize: 12, fontWeight: 800, color: '#C4862A',
          letterSpacing: '0.14em', fontFamily: 'Bebas Neue, Montserrat, sans-serif',
          textShadow: '0 0 8px rgba(196,134,42,0.35)',
        }}>AI ANALYSIS</span>
        {isPlaying && recs.length === 0 && (
          <span style={{ fontSize: 10, color: '#524c47', marginLeft: 4, fontStyle: 'italic' }}>listening…</span>
        )}
        {recs.length > 0 && (
          <span style={{
            marginLeft: 4, fontSize: 9, fontWeight: 700,
            background: 'rgba(196,134,42,0.12)', color: '#C4862A',
            border: '1px solid rgba(196,134,42,0.35)', borderRadius: 3,
            padding: '1px 6px', letterSpacing: '0.04em',
          }}>{recs.length} ISSUE{recs.length !== 1 ? 'S' : ''}</span>
        )}
        {!isPlaying && (
          <span style={{ fontSize: 10, color: '#3e3830', marginLeft: 4 }}>— press PLAY to analyze</span>
        )}
        <span style={{ marginLeft: 'auto', color: '#524c47', fontSize: 11 }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Body */}
      {open && (
        <div style={{ borderTop: '1px solid #252220', padding: recs.length ? '10px 12px' : '6px 12px 10px' }}>
          {recs.length === 0 ? (
            <p style={{ fontSize: 11, color: '#524c47', fontStyle: 'italic' }}>
              {isPlaying ? 'No significant issues detected — your mix sounds balanced.' : 'Start audio playback to detect frequency issues.'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recs.map(rec => {
                const meta = ISSUE_META[rec.issue] ?? { label: rec.issue, icon: '⚪', color: '#8A7A6A' };
                const pct  = Math.round(rec.confidence * 100);
                const done = applied.has(rec.issue);
                return (
                  <div key={rec.issue} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px',
                    background: 'linear-gradient(180deg,#1c1a16 0%,#161410 100%)',
                    border: `1px solid ${done ? '#3a3530' : meta.color + '35'}`,
                    borderRadius: 5,
                    opacity: done ? 0.5 : 1,
                    transition: 'opacity 200ms',
                    boxShadow: 'inset 0 1px 0 rgba(255,235,200,0.04)',
                  }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{meta.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: meta.color, letterSpacing: '0.05em' }}>
                          {meta.label.toUpperCase()}
                        </span>
                        <span style={{ fontSize: 10, color: '#6a6058' }}>
                          {rec.detectedFrequency >= 1000
                            ? `${(rec.detectedFrequency / 1000).toFixed(1)} kHz`
                            : `${Math.round(rec.detectedFrequency)} Hz`}
                        </span>
                        <span style={{ fontSize: 10, color: '#6a6058' }}>
                          {rec.suggestedGain >= 0 ? '+' : ''}{rec.suggestedGain.toFixed(1)} dB
                        </span>
                      </div>
                      <div style={{ height: 3, background: '#2c2825', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${pct}%`,
                          background: `linear-gradient(to right, ${meta.color}aa, ${meta.color})`,
                          borderRadius: 2, transition: 'width 400ms',
                        }} />
                      </div>
                      <span style={{ fontSize: 9, color: '#524c47', marginTop: 2, display: 'block' }}>
                        {pct}% confidence · Q {rec.suggestedQ.toFixed(1)}
                      </span>
                    </div>
                    <button
                      onClick={() => handleApply(rec)}
                      disabled={done}
                      title={done ? 'Applied' : 'Apply to a peaking band'}
                      style={{
                        padding: '5px 10px', borderRadius: 4,
                        fontSize: 10, fontWeight: 700, cursor: done ? 'default' : 'pointer',
                        letterSpacing: '0.06em', flexShrink: 0,
                        background: done
                          ? 'transparent'
                          : 'linear-gradient(180deg,#3a3530 0%,#252220 100%)',
                        border: `1px solid ${done ? '#3a3530' : meta.color + '55'}`,
                        color: done ? '#524c47' : meta.color,
                        boxShadow: done ? 'none'
                          : 'inset 0 1px 0 rgba(255,235,200,0.07), 0 1px 3px rgba(0,0,0,0.5)',
                        transition: 'all 150ms',
                      }}
                    >{done ? '✓ APPLIED' : 'APPLY'}</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
