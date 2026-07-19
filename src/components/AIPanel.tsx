/**
 * AIPanel — AI-powered EQ recommendations
 * R3 NATIVE RFQ-official color system
 */

import { useEffect, useState, useCallback } from 'react';
import { AIEQAnalyzer, FilterType } from '../dsp';
import type { AIRecommendation, EQBand } from '../dsp';
import { FrequencyIssue } from '../dsp';

const analyzer = new AIEQAnalyzer();
const SAMPLE_RATE = 48000;
const FFT_SIZE    = 4096;

const ISSUE_META: Record<string, { label: string; dot: string; color: string }> = {
  [FrequencyIssue.Mud]:       { label: 'Mud',       dot: '#FF8C1A', color: '#FF8C1A' },
  [FrequencyIssue.Harshness]: { label: 'Harshness', dot: '#ef6666', color: '#ef6666' },
  [FrequencyIssue.Sibilance]: { label: 'Sibilance', dot: '#FFD633', color: '#FFD633' },
  [FrequencyIssue.Boominess]: { label: 'Boominess', dot: '#FF3B30', color: '#FF3B30' },
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
      border: '1px solid #242424',
      borderRadius: 5,
      overflow: 'hidden',
      background: '#111111',
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
        <span style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
          background: 'radial-gradient(circle at 35% 35%, #d4ff40, #B7FF00)',
          boxShadow: '0 0 6px rgba(183,255,0,0.55)',
        }} />
        <span style={{
          fontSize: 12, fontWeight: 800, color: '#B7FF00',
          letterSpacing: '0.14em', fontFamily: 'Bebas Neue, Montserrat, sans-serif',
          textShadow: '0 0 8px rgba(183,255,0,0.35)',
        }}>AI ANALYSIS</span>
        {isPlaying && recs.length === 0 && (
          <span style={{ fontSize: 10, color: '#484848', marginLeft: 4, fontStyle: 'italic' }}>listening…</span>
        )}
        {recs.length > 0 && (
          <span style={{
            marginLeft: 4, fontSize: 9, fontWeight: 700,
            background: 'rgba(183,255,0,0.10)', color: '#B7FF00',
            border: '1px solid rgba(183,255,0,0.30)', borderRadius: 3,
            padding: '1px 6px', letterSpacing: '0.04em',
          }}>{recs.length} ISSUE{recs.length !== 1 ? 'S' : ''}</span>
        )}
        {!isPlaying && (
          <span style={{ fontSize: 10, color: '#2e2e2e', marginLeft: 4 }}>— press PLAY to analyze</span>
        )}
        <span style={{ marginLeft: 'auto', color: '#484848', fontSize: 11 }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Body */}
      {open && (
        <div style={{ borderTop: '1px solid #1e1e1e', padding: recs.length ? '10px 12px' : '6px 12px 10px' }}>
          {recs.length === 0 ? (
            <p style={{ fontSize: 11, color: '#484848', fontStyle: 'italic' }}>
              {isPlaying ? 'No significant issues detected — your mix sounds balanced.' : 'Start audio playback to detect frequency issues.'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recs.map(rec => {
                const meta = ISSUE_META[rec.issue] ?? { label: rec.issue, dot: '#B7FF00', color: '#B7FF00' };
                const pct  = Math.round(rec.confidence * 100);
                const done = applied.has(rec.issue);
                return (
                  <div key={rec.issue} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px',
                    background: '#161616',
                    border: `1px solid ${done ? '#242424' : meta.color + '30'}`,
                    borderRadius: 5,
                    opacity: done ? 0.5 : 1,
                    transition: 'opacity 200ms',
                  }}>
                    <span style={{
                      width: 10, height: 10, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
                      background: `radial-gradient(circle at 35% 35%, ${meta.dot}ff, ${meta.dot}88)`,
                      boxShadow: `0 0 7px ${meta.dot}66`,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: meta.color, letterSpacing: '0.05em' }}>
                          {meta.label.toUpperCase()}
                        </span>
                        <span style={{ fontSize: 10, color: '#606060' }}>
                          {rec.detectedFrequency >= 1000
                            ? `${(rec.detectedFrequency / 1000).toFixed(1)} kHz`
                            : `${Math.round(rec.detectedFrequency)} Hz`}
                        </span>
                        <span style={{ fontSize: 10, color: '#606060' }}>
                          {rec.suggestedGain >= 0 ? '+' : ''}{rec.suggestedGain.toFixed(1)} dB
                        </span>
                      </div>
                      <div style={{ height: 3, background: '#242424', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${pct}%`,
                          background: `linear-gradient(to right, ${meta.color}aa, ${meta.color})`,
                          borderRadius: 2, transition: 'width 400ms',
                        }} />
                      </div>
                      <span style={{ fontSize: 9, color: '#484848', marginTop: 2, display: 'block' }}>
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
                          : 'rgba(183,255,0,0.08)',
                        border: `1px solid ${done ? '#2a2a2a' : meta.color + '55'}`,
                        color: done ? '#484848' : meta.color,
                        boxShadow: done ? 'none' : `0 0 6px ${meta.color}18`,
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
