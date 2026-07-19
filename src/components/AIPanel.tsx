/**
 * AIPanel — AI-powered EQ recommendations
 * FR-AI-001 to FR-AI-008: mud, harshness, sibilance, boxiness detection
 * Shows confidence score + one-click apply per recommendation
 */

import { useEffect, useState, useCallback } from 'react';
import { AIEQAnalyzer, FilterType } from '../dsp';
import type { AIRecommendation, EQBand } from '../dsp';
import { FrequencyIssue } from '../dsp';

const analyzer = new AIEQAnalyzer();
const SAMPLE_RATE = 48000;
const FFT_SIZE    = 4096;

const ISSUE_META: Record<string, { label: string; icon: string; color: string }> = {
  [FrequencyIssue.Mud]:       { label: 'Mud',       icon: '🟤', color: '#c8a46a' },
  [FrequencyIssue.Harshness]: { label: 'Harshness', icon: '🔴', color: '#e05555' },
  [FrequencyIssue.Sibilance]: { label: 'Sibilance', icon: '🟡', color: '#f0c040' },
  [FrequencyIssue.Boominess]: { label: 'Boominess', icon: '🟠', color: '#e07040' },
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

  // Run analysis at most every 2 seconds while live spectrum is flowing
  useEffect(() => {
    if (!spectrumData || !isPlaying) return;
    const now = Date.now();
    if (now - lastAnalyzed < 2000) return;

    const result = analyzer.analyzeSpectrum(spectrumData, SAMPLE_RATE, FFT_SIZE);
    setRecs(result.recommendations);
    setLastAnalyzed(now);
  }, [spectrumData, isPlaying, lastAnalyzed]);

  // Reset when stopped
  useEffect(() => {
    if (!isPlaying) { setRecs([]); setApplied(new Set()); }
  }, [isPlaying]);

  const handleApply = useCallback((rec: AIRecommendation) => {
    // Find the best available peaking band (prefer disabled ones)
    const peaking = bands.filter(b => b.type === FilterType.Peaking);
    const target  = peaking.find(b => !b.enabled) ?? peaking[0];
    if (!target) return;
    onApply(target.id, rec.detectedFrequency, rec.suggestedGain, rec.suggestedQ);
    setApplied(prev => new Set([...prev, rec.issue]));
  }, [bands, onApply]);

  return (
    <div style={{
      margin: '0 16px',
      border: '1px solid #1c1c1c',
      borderRadius: 6,
      overflow: 'hidden',
      background: '#0a0a0a',
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
        <span style={{ fontSize: 14 }}>🤖</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#B7FF00', letterSpacing: '0.12em', fontFamily: 'Bebas Neue, Montserrat, sans-serif', fontSize: 13 }}>AI ANALYSIS</span>
        {isPlaying && recs.length === 0 && (
          <span style={{ fontSize: 10, color: '#555', marginLeft: 4, fontStyle: 'italic' }}>listening…</span>
        )}
        {recs.length > 0 && (
          <span style={{
            marginLeft: 4, fontSize: 9, fontWeight: 700,
            background: '#B7FF0030', color: '#B7FF00',
            border: '1px solid #B7FF0060', borderRadius: 10,
            padding: '1px 6px', letterSpacing: '0.04em',
          }}>{recs.length} ISSUE{recs.length !== 1 ? 'S' : ''}</span>
        )}
        {!isPlaying && (
          <span style={{ fontSize: 10, color: '#333', marginLeft: 4 }}>— press PLAY to analyze</span>
        )}
        <span style={{ marginLeft: 'auto', color: '#444', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Body */}
      {open && (
        <div style={{ borderTop: '1px solid #161616', padding: recs.length ? '10px 12px' : '6px 12px 10px' }}>
          {recs.length === 0 ? (
            <p style={{ fontSize: 11, color: '#333', fontStyle: 'italic' }}>
              {isPlaying ? 'No significant issues detected — your mix sounds balanced.' : 'Start audio playback to detect frequency issues.'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recs.map(rec => {
                const meta = ISSUE_META[rec.issue] ?? { label: rec.issue, icon: '⚪', color: '#888' };
                const pct  = Math.round(rec.confidence * 100);
                const done = applied.has(rec.issue);
                return (
                  <div key={rec.issue} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px',
                    background: '#0f0f0f',
                    border: `1px solid ${done ? '#242424' : meta.color + '30'}`,
                    borderRadius: 5,
                    opacity: done ? 0.5 : 1,
                    transition: 'opacity 200ms',
                  }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{meta.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: meta.color, letterSpacing: '0.05em' }}>{meta.label.toUpperCase()}</span>
                        <span style={{ fontSize: 10, color: '#555' }}>
                          {rec.detectedFrequency >= 1000
                            ? `${(rec.detectedFrequency / 1000).toFixed(1)} kHz`
                            : `${Math.round(rec.detectedFrequency)} Hz`}
                        </span>
                        <span style={{ fontSize: 10, color: '#555' }}>
                          {rec.suggestedGain >= 0 ? '+' : ''}{rec.suggestedGain.toFixed(1)} dB
                        </span>
                      </div>
                      {/* Confidence bar */}
                      <div style={{ height: 3, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${pct}%`,
                          background: meta.color,
                          borderRadius: 2,
                          transition: 'width 400ms',
                        }} />
                      </div>
                      <span style={{ fontSize: 9, color: '#444', marginTop: 2, display: 'block' }}>
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
                        letterSpacing: '0.06em',
                        background: done ? 'transparent' : '#B7FF0015',
                        border: `1px solid ${done ? '#242424' : '#B7FF0060'}`,
                        color: done ? '#333' : '#B7FF00',
                        flexShrink: 0,
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
