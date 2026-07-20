/**
 * useAudioEngine — Web Audio API source through a live BiquadFilter chain
 * Supports three source modes:
 *   • pink-noise   — built-in Voss-McCartney pink noise (default)
 *   • microphone   — getUserMedia mic input (real-time analysis)
 *   • file         — decoded audio file (looped playback)
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { EQBand, FilterType } from '../dsp';
import {
  cacheAudioFile,
  clearCachedAudioFile,
  loadCachedAudioFile,
} from './useAudioFileCache';

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
  const [isPlaying,      setIsPlaying]      = useState(false);
  const [sourceMode,     setSourceMode]     = useState<AudioSourceMode>('pink-noise');
  const [spectrumData,   setSpectrum]       = useState<Float32Array | null>(null);
  const [sourceError,    setSourceError]    = useState<string | null>(null);
  const [fileReady,      setFileReady]      = useState(false);
  const [fileName,       setFileName]       = useState<string | null>(null);
  const [fileDuration,   setFileDuration]   = useState(0);
  const [fileCurrentTime, setFileCurrentTime] = useState(0);
  const [cacheError,     setCacheError]     = useState<string | null>(null);
  const [fileFromCache,  setFileFromCache]  = useState(false);

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
  // Seek / position tracking for file mode
  const startedAtRef   = useRef<number>(0);   // ctx.currentTime when src.start() was called
  const offsetRef      = useRef<number>(0);    // buffer offset where playback began
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

  // ── RAF loop for spectrum data + file position ───────────────────────────────
  const startRaf = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const buf = new Float32Array(analyser.frequencyBinCount);
    const tick = () => {
      if (!playingRef.current) return;
      analyser.getFloatFrequencyData(buf);
      setSpectrum(new Float32Array(buf));
      // Track playback position when in file mode
      if (sourceModeRef.current === 'file' && ctxRef.current && fileBufferRef.current) {
        const dur = fileBufferRef.current.duration;
        const rawPos = offsetRef.current + (ctxRef.current.currentTime - startedAtRef.current);
        setFileCurrentTime(dur > 0 ? rawPos % dur : 0);
      }
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
    setCacheError(null);
    try {
      const ctx = await ensureCtx();
      const arrayBuf   = await file.arrayBuffer();
      const audioBuf   = await ctx.decodeAudioData(arrayBuf.slice(0));
      fileBufferRef.current = audioBuf;
      setFileDuration(audioBuf.duration);
      setFileCurrentTime(0);
      offsetRef.current = 0;
      setFileReady(true);
      setFileName(file.name);
      setFileFromCache(false);
      // Persist to IndexedDB (non-blocking; report error separately)
      cacheAudioFile(file).then(err => {
        if (err) setCacheError(err);
      });
    } catch {
      setSourceError(`Could not decode "${file.name}" — try MP3, WAV, OGG, or FLAC`);
      setFileReady(false);
    }
  }, [ensureCtx]);

  // ── Clear cached file ────────────────────────────────────────────────────────
  const clearCachedFile = useCallback(async () => {
    await clearCachedAudioFile();
    fileBufferRef.current = null;
    setFileReady(false);
    setFileName(null);
    setFileDuration(0);
    setFileCurrentTime(0);
    offsetRef.current = 0;
    setFileFromCache(false);
    setCacheError(null);
  }, []);

  // ── Restore file from IndexedDB on mount ─────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const record = await loadCachedAudioFile();
      if (!record || cancelled) return;
      try {
        // Build a temporary AudioContext just for decoding (avoids requiring
        // user gesture before the main context is created).
        const tmpCtx = new AudioContext();
        const audioBuf = await tmpCtx.decodeAudioData(record.data.slice(0));
        tmpCtx.close();
        if (cancelled) return;
        fileBufferRef.current = audioBuf;
        setFileDuration(audioBuf.duration);
        setFileCurrentTime(0);
        setFileReady(true);
        setFileName(record.name);
        setFileFromCache(true);
        setSourceMode('file');
      } catch {
        // Corrupted cache — silently clear it
        clearCachedAudioFile();
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Play ─────────────────────────────────────────────────────────────────────
  // `overrideMode` lets callers (e.g. source-switch) pass a mode before the
  // React state/ref has had a chance to update, avoiding stale-closure silence.
  const play = useCallback(async (overrideMode?: AudioSourceMode) => {
    setSourceError(null);
    const ctx = await ensureCtx();
    const mode = overrideMode ?? sourceModeRef.current;

    // Build filter chain
    filtersRef.current = bands.map(() => ctx.createBiquadFilter());

    // Analyser
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0.75;
    analyserRef.current = analyser;

    // Output gain — start silent and fade in over 150 ms to prevent clicks
    const targetGain = mode === 'microphone' ? 0.85 : 0.45;
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0;
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(targetGain, ctx.currentTime + 0.15);
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
      offsetRef.current = 0;
      startedAtRef.current = ctx.currentTime;
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

  // ── Seek (file mode only) ─────────────────────────────────────────────────────
  const seek = useCallback((t: number) => {
    if (!fileBufferRef.current || !ctxRef.current) return;
    const dur = fileBufferRef.current.duration;
    const newOffset = Math.max(0, Math.min(t, dur));
    setFileCurrentTime(newOffset);
    offsetRef.current = newOffset;
    if (!playingRef.current) return;
    const ctx = ctxRef.current;
    // Swap the buffer source to the new position
    try { bufSrcRef.current?.stop(); } catch {}
    bufSrcRef.current?.disconnect();
    bufSrcRef.current = null;
    const src = ctx.createBufferSource();
    src.buffer = fileBufferRef.current;
    src.loop = true;
    // Re-attach to existing filter chain
    if (filtersRef.current.length > 0) {
      src.connect(filtersRef.current[0]);
    } else if (analyserRef.current) {
      src.connect(analyserRef.current);
    }
    bufSrcRef.current = src;
    startedAtRef.current = ctx.currentTime;
    src.start(0, newOffset);
  }, []);

  // ── Switch source with fade-out / fade-in ────────────────────────────────────
  // Fades out current audio (150 ms), tears down the chain, updates the source
  // mode, then immediately restarts playback — no manual PLAY press needed.
  const switchSource = useCallback(async (mode: AudioSourceMode) => {
    setSourceError(null);

    if (playingRef.current && gainRef.current && ctxRef.current) {
      // Fade out over 150 ms
      const gain = gainRef.current;
      const ctx  = ctxRef.current;
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
      // Wait for the ramp to finish before tearing down
      await new Promise<void>(r => setTimeout(r, 165));
    }

    // Tear down current chain (stop() sets isPlaying false, clears all refs)
    // We call the imperative version directly to avoid a stale closure.
    cancelAnimationFrame(rafRef.current);
    playingRef.current = false;
    try { bufSrcRef.current?.stop(); } catch {}
    bufSrcRef.current?.disconnect();
    bufSrcRef.current = null;
    streamSrcRef.current?.disconnect();
    streamSrcRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    filtersRef.current.forEach(f => f.disconnect());
    analyserRef.current?.disconnect();
    gainRef.current?.disconnect();
    filtersRef.current  = [];
    analyserRef.current = null;
    gainRef.current     = null;

    // Update the ref immediately so the upcoming play() call sees the new mode
    sourceModeRef.current = mode;
    setSourceMode(mode);
    setIsPlaying(false);
    setSpectrum(null);

    // Auto-restart with the new source
    await play();
  // play / stop are stable callbacks; including them avoids stale closure warnings
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, setSourceMode]);

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

  // ── Switch source (optionally keep playback running) ─────────────────────────
  // Stops the current source, sets the new mode, and restarts immediately if
  // audio was already playing — so the user never hears silence.
  const switchSource = useCallback(async (mode: AudioSourceMode) => {
    const wasPlaying = playingRef.current;
    stop();
    setSourceMode(mode);
    // Update the ref immediately so play() sees the new mode even before the
    // React state flush updates it via the useEffect above.
    sourceModeRef.current = mode;
    setSourceError(null);
    if (wasPlaying) {
      // File mode: only restart if a buffer is already loaded
      if (mode === 'file' && !fileBufferRef.current) return;
      await play(mode);
    }
  }, [stop, play]);

  return {
    isPlaying, play, stop, spectrumData,
    sourceMode, setSourceMode, switchSource,
    sourceError, setSourceError,
    loadFile, fileReady, fileName,
    fileDuration, fileCurrentTime, seek,
    cacheError, setCacheError,
    clearCachedFile, fileFromCache,
  };
}
