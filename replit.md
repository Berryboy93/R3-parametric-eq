# R3 NATIVE Parametric EQ

An interactive demo of the **R3 NATIVE Parametric EQ Engine** — a production-grade 8-band parametric equalizer with real-time frequency response visualization, factory presets, and full undo/redo support.

## How to run

The dev server starts automatically. It runs on port 5000 via:

```
npx vite --port 5000 --host 0.0.0.0
```

To build for production:
```
npm run build
```

## Project structure

```
src/
  dsp/                    # DSP engine (pure TypeScript, no external deps)
    types/index.ts        # All type definitions & enums
    filters/
      biquad.ts           # RBJ biquad filter math
      eq-band.ts          # Per-band state management
      parametric-eq.ts    # 8-band EQ engine
      index.ts            # Barrel export
    analyzer/fft-analyzer.ts   # FFT spectrum analyzer
    presets/preset-manager.ts  # Preset CRUD + factory presets
    ai/ai-analyzer.ts          # Frequency issue detection
    index.ts              # Main DSP barrel export
  components/
    EQDisplay.tsx         # Canvas-based frequency response curve
    BandControl.tsx       # Per-band controls (freq, gain, Q sliders)
  hooks/useEQState.ts     # React state hook with undo/redo
  styles/theme.css        # R3 NATIVE design system (Midnight Black + Neon Green)
  App.tsx                 # Main app
  main.tsx                # Entry point
index.html                # HTML entry
vite.config.ts            # Vite config (port 5000, host 0.0.0.0)
```

## Features

- 8-band parametric EQ (High Pass, Low Shelf, 4× Peaking, High Shelf, Low Pass)
- Real-time frequency response curve on canvas (log scale, ±24 dB)
- Draggable band nodes on the EQ curve
- Factory presets: Flat, Vocal Bright, Podcast Clear, Bass Boost, Air
- Undo/redo with full state history
- Bypass mode
- R3 NATIVE dark theme (Midnight Black #080808 + Neon Green #B7FF00)

## Tech stack

- **React 18** + **Vite 5** + **TypeScript**
- No external audio or UI libraries — all DSP is pure math

## User preferences

<!-- Add any user preferences here -->
