/**
 * useAudioEngine — Web Audio API source through a live BiquadFilter chain
 * Supports three source modes:
 *   • pink-noise   — built-in Voss-McCartney pink noise (default)
 *   • microphone   — getUserMedia mic input (real-time analysis)
 *   • file         — decoded audio file (looped playback)
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { EQBand, FilterType } from '../dsp';

export type AudioSourceMode = 'pink-noise' | 'microphone' | 'file';

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
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [sourceMode,  setSourceMode]  = useState<AudioSourceMode>('pink-noise');
  const [spectrumData, setSpectrum]   = useState<Float32Array | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [fileReady,   setFileReady]   = useState(false);
  const [fileName,    setFileName]    = useState<string | null>(null);

  // Audio node refs
  const ctxRef         = useRef<AudioContext | null>(null);
  const bufSrcRef      = useRef<AudioBufferSourceNode | null>(null);
  const streamRef      = useRef<MediaStream | null>(null);
  const streamSrcRef   = useRef<MediaStreamAudioSourceNode | null>(null);
  const filtersRef     = useRef<BiquadFilterNode[]>([]);
  const analyserRef    = useRef<AnalyserNode | null>(null);
  const gainRef        = useRef<GainNode | null>(null);
  const rafRef         = useRef<number>(0);
  const pinkRef        = useRef<AudioBuffer | null>(null);
  const fileBufferRef  = useRef<AudioBuffer | null>(null);
  const playingRef     = useRef(false);
  // Ref copy of sourceMode to avoid stale closure in play()
  const sourceModeRef  = useRef<AudioSourceMode>('pink-noise');
  useEffect(() => { sourceModeRef.current = sourceMode; }, [sourceMode]);

  // ── Filter sync ─────────────────────────────────────────────────────────────
  const syncFilters = useCallback((bs: readonly EQBand[], byp: boolean, now: number) => {
    filtersRef.current.forEach((f, i) => {
      const band = bs[i];
      if (!band) return;
      if (byp || !band.enabled) { f.type = 'allpass'; return; }
      f.type = webAudioType(band.type);
      const freq = Math.max(20, Math.min(20000, band.frequency));
      f.frequency.linearRampToValueAtTime(freq,           now + 0.015);
      f.gain.linearRampToValueAtTime(band.gain,            now + 0.015);
      f.Q.linearRampToValueAtTime(Math.max(0.001, band.q), now + 0.015);
    });
  }, []);

  useEffect(() => {
    if (!playingRef.current || !ctxRef.current) return;
    syncFilters(bands, bypass, ctxRef.current.currentTime);
  }, [bands, bypass, syncFilters]);

  // ── RAF loop for spectrum data ───────────────────────────────────────────────
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

  // ── Ensure AudioContext exists and is running ────────────────────────────────
  const ensureCtx = useCallback(async () => {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    const ctx = ctxRef.current;
    if (ctx.state === 'suspended') await ctx.resume();
    return ctx;
  }, []);

  // ── Load an audio file ───────────────────────────────────────────────────────
  const loadFile = useCallback(async (file: File) => {
    setSourceError(null);
    try {
      const ctx = await ensureCtx();
      const arrayBuf   = await file.arrayBuffer();
      const audioBuf   = await ctx.decodeAudioData(arrayBuf);
      fileBufferRef.current = audioBuf;
      setFileReady(true);
      setFileName(file.name);
    } catch {
      setSourceError(`Could not decode "${file.name}" — try MP3, WAV, OGG, or FLAC`);
      setFileReady(false);
    }
  }, [ensureCtx]);

  // ── Play ─────────────────────────────────────────────────────────────────────
  const play = useCallback(async () => {
    setSourceError(null);
    const ctx = await ensureCtx();
    const mode = sourceModeRef.current;

    // Build filter chain
    filtersRef.current = bands.map(() => ctx.createBiquadFilter());

    // Analyser
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0.75;
    analyserRef.current = analyser;

    // Output gain
    const gainNode = ctx.createGain();
    gainNode.gain.value = mode === 'microphone' ? 0.85 : 0.45;
    gainRef.current = gainNode;

    // Wire helper: sourceNode → filters → analyser → gain → destination
    const wire = (sourceNode: AudioNode) => {
      let node: AudioNode = sourceNode;
      for (const f of filtersRef.current) { node.connect(f); node = f; }
      node.connect(analyser);
      analyser.connect(gainNode);
      gainNode.connect(ctx.destination);
    };

    if (mode === 'microphone') {
      // ── Microphone ──────────────────────────────────────────────────────────
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        streamRef.current = stream;
        const src = ctx.createMediaStreamSource(stream);
        streamSrcRef.current = src;
        wire(src);
        // Mic does not need .start() — it's live immediately
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        setSourceError(
          msg.toLowerCase().includes('denied') || msg.toLowerCase().includes('permission')
            ? 'Microphone access denied — allow mic access in your browser then try again'
            : `Microphone error: ${msg || 'unknown error'}`
        );
        // Tear down partially-built chain
        filtersRef.current.forEach(f => f.disconnect());
        analyser.disconnect();
        gainNode.disconnect();
        filtersRef.current = [];
        analyserRef.current = null;
        return;
      }
    } else if (mode === 'file') {
      // ── Audio file ──────────────────────────────────────────────────────────
      if (!fileBufferRef.current) {
        setSourceError('No file loaded — choose an audio file first');
        filtersRef.current.forEach(f => f.disconnect());
        analyser.disconnect();
        gainNode.disconnect();
        filtersRef.current = [];
        analyserRef.current = null;
        return;
      }
      const src = ctx.createBufferSource();
      src.buffer = fileBufferRef.current;
      src.loop = true;
      bufSrcRef.current = src;
      wire(src);
      src.start();
    } else {
      // ── Pink noise (default) ─────────────────────────────────────────────────
      if (!pinkRef.current) pinkRef.current = buildPinkNoise(ctx);
      const src = ctx.createBufferSource();
      src.buffer = pinkRef.current;
      src.loop = true;
      bufSrcRef.current = src;
      wire(src);
      src.start();
    }

    syncFilters(bands, bypass, ctx.currentTime);
    playingRef.current = true;
    setIsPlaying(true);
    startRaf();
  }, [bands, bypass, syncFilters, startRaf, ensureCtx]);

  // ── Stop ─────────────────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    playingRef.current = false;
    // Stop buffer source (pink noise / file)
    try { bufSrcRef.current?.stop(); } catch {}
    bufSrcRef.current?.disconnect();
    bufSrcRef.current = null;
    // Stop mic stream
    streamSrcRef.current?.disconnect();
    streamSrcRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    // Tear down rest of chain
    filtersRef.current.forEach(f => f.disconnect());
    analyserRef.current?.disconnect();
    gainRef.current?.disconnect();
    filtersRef.current  = [];
    analyserRef.current = null;
    gainRef.current     = null;
    setIsPlaying(false);
    setSpectrum(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => { stop(); ctxRef.current?.close(); }, [stop]);

  return {
    isPlaying, play, stop, spectrumData,
    sourceMode, setSourceMode,
    sourceError, setSourceError,
    loadFile, fileReady, fileName,
  };
}
