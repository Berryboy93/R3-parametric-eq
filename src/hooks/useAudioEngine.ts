/**
 * useAudioEngine — Web Audio API pink-noise source through a live BiquadFilter chain
 * Updates filter params in-place (no glitch reconnects) on every band/bypass change.
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { EQBand, FilterType } from '../dsp';

// Map our FilterType enum → BiquadFilterType
function webAudioType(t: FilterType): BiquadFilterType {
  switch (t) {
    case FilterType.HighPass:  return 'highpass';
    case FilterType.LowPass:   return 'lowpass';
    case FilterType.Peaking:   return 'peaking';
    case FilterType.LowShelf:  return 'lowshelf';
    case FilterType.HighShelf: return 'highshelf';
    default:                   return 'peaking';
  }
}

// Voss-McCartney pink-noise algorithm (~10 s stereo buffer)
function buildPinkNoise(ctx: AudioContext): AudioBuffer {
  const secs = 10;
  const n    = Math.floor(ctx.sampleRate * secs);
  const buf  = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886*b0 + w*0.0555179;
      b1 = 0.99332*b1 + w*0.0750759;
      b2 = 0.96900*b2 + w*0.1538520;
      b3 = 0.86650*b3 + w*0.3104856;
      b4 = 0.55000*b4 + w*0.5329522;
      b5 = -0.7616*b5 - w*0.0168980;
      d[i] = (b0+b1+b2+b3+b4+b5+b6 + w*0.5362) * 0.12;
      b6 = w * 0.115926;
    }
  }
  return buf;
}

export function useAudioEngine(bands: readonly EQBand[], bypass: boolean) {
  const [isPlaying, setIsPlaying]     = useState(false);
  const [spectrumData, setSpectrum]   = useState<Float32Array | null>(null);

  const ctxRef      = useRef<AudioContext  | null>(null);
  const sourceRef   = useRef<AudioBufferSourceNode | null>(null);
  const filtersRef  = useRef<BiquadFilterNode[]>([]);
  const analyserRef = useRef<AnalyserNode  | null>(null);
  const gainRef     = useRef<GainNode      | null>(null);
  const rafRef      = useRef<number>(0);
  const pinkRef     = useRef<AudioBuffer   | null>(null);
  const playingRef  = useRef(false);

  // Sync live filter params (called both on first play and on every update)
  const syncFilters = useCallback((bs: readonly EQBand[], byp: boolean, now: number) => {
    const filters = filtersRef.current;
    bs.forEach((band, i) => {
      if (i >= filters.length) return;
      const f = filters[i];
      if (byp || !band.enabled) {
        f.type = 'allpass';
        return;
      }
      f.type = webAudioType(band.type);
      const freq = Math.max(20, Math.min(20000, band.frequency));
      f.frequency.linearRampToValueAtTime(freq,      now + 0.015);
      f.gain.linearRampToValueAtTime(band.gain,       now + 0.015);
      f.Q.linearRampToValueAtTime(Math.max(0.001, band.q), now + 0.015);
    });
  }, []);

  // Keep filters synced whenever bands or bypass changes
  useEffect(() => {
    if (!playingRef.current || !ctxRef.current) return;
    syncFilters(bands, bypass, ctxRef.current.currentTime);
  }, [bands, bypass, syncFilters]);

  const startRaf = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const buf = new Float32Array(analyser.frequencyBinCount);
    const tick = () => {
      if (!playingRef.current) return;
      analyser.getFloatFrequencyData(buf);
      setSpectrum(new Float32Array(buf));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const play = useCallback(async () => {
    // Create AudioContext on first use (requires user gesture)
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    const ctx = ctxRef.current;
    if (ctx.state === 'suspended') await ctx.resume();

    // Pre-compute pink noise once
    if (!pinkRef.current) pinkRef.current = buildPinkNoise(ctx);

    // Build filter chain
    filtersRef.current = bands.map(() => ctx.createBiquadFilter());

    // Analyser
    const analyser       = ctx.createAnalyser();
    analyser.fftSize     = 4096;
    analyser.smoothingTimeConstant = 0.75;
    analyserRef.current  = analyser;

    // Output gain (avoid clipping)
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0.45;
    gainRef.current = gainNode;

    // Source
    const source   = ctx.createBufferSource();
    source.buffer  = pinkRef.current;
    source.loop    = true;
    sourceRef.current = source;

    // Wire: source → f0 → f1 → … → fn → analyser → gain → destination
    let node: AudioNode = source;
    for (const f of filtersRef.current) { node.connect(f); node = f; }
    node.connect(analyser);
    analyser.connect(gainNode);
    gainNode.connect(ctx.destination);

    syncFilters(bands, bypass, ctx.currentTime);
    source.start();
    playingRef.current = true;
    setIsPlaying(true);
    startRaf();
  }, [bands, bypass, syncFilters, startRaf]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    playingRef.current = false;
    try { sourceRef.current?.stop(); } catch {}
    sourceRef.current?.disconnect();
    filtersRef.current.forEach(f => f.disconnect());
    analyserRef.current?.disconnect();
    gainRef.current?.disconnect();
    filtersRef.current  = [];
    analyserRef.current = null;
    setIsPlaying(false);
    setSpectrum(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => { stop(); ctxRef.current?.close(); }, [stop]);

  return { isPlaying, play, stop, spectrumData };
}
