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
  addRecentFile,
  clearAllRecentFiles,
  listRecentFiles,
  loadRecentFileById,
  removeRecentFile,
  requestPersistentStorage,
} from './useAudioFileCache';
import type { RecentFileMeta } from './useAudioFileCache';

export type AudioSourceMode = 'pink-noise' | 'microphone' | 'file';
export type { RecentFileMeta };

// ── Mic acquisition with timeout ─────────────────────────────────────────────
// getUserMedia has no built-in cancellation. We race it against a timer and,
// if the timeout wins, stop any stream that arrives late to release hardware.
const MIC_TIMEOUT_MS = 15_000;

async function getUserMediaWithTimeout(): Promise<MediaStream> {
  let lateStream: MediaStream | null = null;

  const micPromise = navigator.mediaDevices
    .getUserMedia({ audio: true, video: false })
    .then(s => { lateStream = s; return s; });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), MIC_TIMEOUT_MS)
  );

  try {
    return await Promise.race([micPromise, timeoutPromise]);
  } catch (err) {
    // If timeout fired and the mic resolves later, release the hardware.
    if (err instanceof Error && err.message === 'timeout') {
      micPromise.then(s => s.getTracks().forEach(t => t.stop())).catch(() => {});
    }
    throw err;
  }
}

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
  const [recentFiles,    setRecentFiles]    = useState<RecentFileMeta[]>([]);

  // Track the id of the currently active recent file (for highlighting in the list)
  const activeRecentIdRef = useRef<string | null>(null);

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

  // Live refs for bands/bypass so switchSource can read the *latest* values
  // after its async play() resolves, not the stale closure snapshot.
  const bandsRef  = useRef(bands);
  const bypassRef = useRef(bypass);
  bandsRef.current  = bands;
  bypassRef.current = bypass;

  // ── Refresh recent files list ────────────────────────────────────────────────
  const refreshRecentFiles = useCallback(async () => {
    const list = await listRecentFiles();
    setRecentFiles(list);
  }, []);

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
      // Persist to IndexedDB (non-blocking; report error/warning separately).
      // Always refresh the recent-files list regardless of warning vs. clean success.
      addRecentFile(file).then(msg => {
        if (msg) setCacheError(msg);
        refreshRecentFiles().then(noop);
      });
    } catch {
      setSourceError(`Could not decode "${file.name}" — try MP3, WAV, OGG, or FLAC`);
      setFileReady(false);
    }
  }, [ensureCtx, refreshRecentFiles]);

  // ── Load a file from the recent list by its IndexedDB id ─────────────────────
  const loadRecentFile = useCallback(async (id: string) => {
    setSourceError(null);
    setCacheError(null);
    const record = await loadRecentFileById(id);
    if (!record) {
      setSourceError('Could not load file from history — it may have been cleared');
      await refreshRecentFiles();
      return;
    }
    try {
      const ctx = await ensureCtx();
      const audioBuf = await ctx.decodeAudioData(record.data.slice(0));
      fileBufferRef.current = audioBuf;
      activeRecentIdRef.current = id;
      setFileDuration(audioBuf.duration);
      setFileCurrentTime(0);
      offsetRef.current = 0;
      setFileReady(true);
      setFileName(record.name);
      setFileFromCache(true);
    } catch {
      setSourceError(`Could not decode "${record.name}" — the cached copy may be corrupted`);
      setFileReady(false);
    }
  }, [ensureCtx, refreshRecentFiles]);

  // ── Remove a single entry from the recent list ────────────────────────────────
  const removeRecentFileById = useCallback(async (id: string) => {
    await removeRecentFile(id);
    // If the removed entry was the active file, clear the player
    if (activeRecentIdRef.current === id) {
      fileBufferRef.current = null;
      activeRecentIdRef.current = null;
      setFileReady(false);
      setFileName(null);
      setFileDuration(0);
      setFileCurrentTime(0);
      offsetRef.current = 0;
      setFileFromCache(false);
    }
    await refreshRecentFiles();
  }, [refreshRecentFiles]);

  // ── Clear cached file (all recent files) ─────────────────────────────────────
  const clearCachedFile = useCallback(async () => {
    await clearAllRecentFiles();
    activeRecentIdRef.current = null;
    fileBufferRef.current = null;
    setFileReady(false);
    setFileName(null);
    setFileDuration(0);
    setFileCurrentTime(0);
    offsetRef.current = 0;
    setFileFromCache(false);
    setCacheError(null);
    setRecentFiles([]);
  }, []);

  // ── Restore most-recent file from IndexedDB on mount ─────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Ask the browser to protect this origin's storage as early as possible.
      // The module-level flag in useAudioFileCache ensures it fires at most once.
      requestPersistentStorage();

      // Load the list first so the popover is populated even if decode fails
      const list = await listRecentFiles();
      if (cancelled) return;
      setRecentFiles(list);

      if (list.length === 0) return;
      const newest = list[0]; // already sorted newest-first
      const record = await loadRecentFileById(newest.id);
      if (!record || cancelled) return;
      try {
        // Build a temporary AudioContext just for decoding (avoids requiring
        // user gesture before the main context is created).
        const tmpCtx = new AudioContext();
        const audioBuf = await tmpCtx.decodeAudioData(record.data.slice(0));
        tmpCtx.close();
        if (cancelled) return;
        fileBufferRef.current = audioBuf;
        activeRecentIdRef.current = newest.id;
        setFileDuration(audioBuf.duration);
        setFileCurrentTime(0);
        setFileReady(true);
        setFileName(record.name);
        setFileFromCache(true);
        setSourceMode('file');
      } catch {
        // Corrupted / evicted cache entry — remove it and notify the user
        // so they know to reload the file rather than wondering why FILE mode vanished.
        removeRecentFile(newest.id).then(() => {
          if (!cancelled) refreshRecentFiles();
        });
        if (!cancelled) {
          setCacheError(
            `"${newest.name}" could not be restored from cache — please reload it`
          );
        }
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Play ─────────────────────────────────────────────────────────────────────
  // `overrideMode` lets callers (e.g. source-switch) pass a mode before the
  // React state/ref has had a chance to update, avoiding stale-closure silence.
  // Returns `true` on success, `false` when the source could not start (e.g.
  // mic permission denied). Callers that auto-restart (switchSource) use this
  // to revert state instead of leaving the UI frozen.
  const play = useCallback(async (overrideMode?: AudioSourceMode): Promise<boolean> => {
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
        const stream = await getUserMediaWithTimeout();
        streamRef.current = stream;
        const src = ctx.createMediaStreamSource(stream);
        streamSrcRef.current = src;
        wire(src);
        // Mic does not need .start() — it's live immediately
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        const isDenied  = msg.toLowerCase().includes('denied') || msg.toLowerCase().includes('permission');
        const isTimeout = msg === 'timeout';
        setSourceError(
          isDenied  ? 'Microphone access denied — allow mic access in your browser then try again'
          : isTimeout ? `Microphone permission timed out after ${MIC_TIMEOUT_MS / 1000} s — grant access when prompted and try again`
          : `Microphone error: ${msg || 'unknown error'}`
        );
        // Tear down partially-built chain
        filtersRef.current.forEach(f => f.disconnect());
        analyser.disconnect();
        gainNode.disconnect();
        filtersRef.current = [];
        analyserRef.current = null;
        return false;
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
        return false;
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
    return true;
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
    const prevMode = sourceModeRef.current;   // remember before stop() clears state
    stop();
    setSourceMode(mode);
    // Update the ref immediately so play() sees the new mode even before the
    // React state flush updates it via the useEffect above.
    sourceModeRef.current = mode;
    setSourceError(null);
    if (wasPlaying) {
      // File mode: only restart if a buffer is already loaded
      if (mode === 'file' && !fileBufferRef.current) return;
      const ok = await play(mode);
      if (!ok) {
        // play() failed (e.g. mic permission denied/timed-out) — revert the
        // source mode so the UI doesn't show the new source as selected while
        // nothing is actually playing.
        setSourceMode(prevMode);
        sourceModeRef.current = prevMode;
      } else if (ctxRef.current) {
        // Re-sync filters with the *latest* band values. EQ changes made while
        // the async transition was in flight (stop→play) were silently dropped
        // because playingRef was false during that window. Apply them now.
        syncFilters(bandsRef.current, bypassRef.current, ctxRef.current.currentTime);
      }
    }
  }, [stop, play, syncFilters]);

  return {
    isPlaying, play, stop, spectrumData,
    sourceMode, setSourceMode, switchSource,
    sourceError, setSourceError,
    loadFile, loadRecentFile, fileReady, fileName,
    fileDuration, fileCurrentTime, seek,
    cacheError, setCacheError,
    clearCachedFile, fileFromCache,
    recentFiles, removeRecentFileById,
  };
}

function noop() {}
