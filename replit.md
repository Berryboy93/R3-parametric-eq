# R3 NATIVE Parametric EQ

An interactive 8-band parametric EQ engine demo built for the R3 NATIVE audio platform.

## Stack
- **React 18** + **TypeScript** + **Vite**
- Web Audio API for real-time DSP
- Canvas 2D for spectrum visualization

## How to run
```
npm run dev
```
Starts the Vite dev server on port 5000.

## Project structure
- `src/App.tsx` — root component
- `src/components/` — UI components (EQ canvas, band controls, presets, AI panel)
- `src/dsp/` — DSP engine (biquad filters, FFT analyzer, AI analyzer, preset manager)
- `src/hooks/` — React hooks for audio engine, EQ state, keyboard shortcuts

## User preferences
<!-- Add user preferences here -->
