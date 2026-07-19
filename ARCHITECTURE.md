# R3 Parametric EQ - Architecture Document

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   R3 NATIVE Application                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   UI Layer (@r3/ui)                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ React Components (ParametricEQ, Graph, Nodes, etc.)  │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ Canvas Renderer (Spectrum, EQ Curve)                 │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ React Hooks (useEQState, state management)           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  DSP Layer (@r3/dsp)                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ParametricEQEngine (8-band cascade filter)           │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ Filters:                                             │  │
│  │  - Biquad coefficients (RBJ cookbook)                │  │
│  │  - Direct Form II processing                         │  │
│  │  - High/Low Pass, Peaking, Shelf filters             │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ Analyzers:                                           │  │
│  │  - FFT (Cooley-Tukey algorithm)                       │  │
│  │  - Window functions (Blackman-Harris)                │  │
│  │  - Peak hold, RMS, stereo/mid-side modes             │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ Presets:                                             │  │
│  │  - JSON schema validation                            │  │
│  │  - Storage interface (LocalStorage, etc.)            │  │
│  │  - Factory presets (Vocal, Podcast, Hip-Hop, etc.)   │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ AI Analyzer:                                         │  │
│  │  - Frequency issue detection                         │  │
│  │  - Intelligent recommendations                       │  │
│  │  - Confidence scoring                                │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Web Audio API Layer                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ AudioContext → AnalyserNode → Filter Chain           │  │
│  │                              → Destination           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Audio Processing Pipeline

```
Input Audio
    │
    ▼
Input Gain (dB → linear conversion)
    │
    ▼
Spectrum Analyzer (FFT, peak-hold)
    │
    ▼
Band 1: High Pass Filter (BiquadFilterNode)
    │
    ▼
Band 2: Low Shelf (BiquadFilterNode)
    │
    ▼
Band 3-6: Peaking Filters (BiquadFilterNode)
    │
    ▼
Band 7: High Shelf (BiquadFilterNode)
    │
    ▼
Band 8: Low Pass Filter (BiquadFilterNode)
    │
    ▼
Soft Limiter (-1 to +1 clipping)
    │
    ▼
Output Gain (dB → linear conversion)
    │
    ▼
Output Audio
```

### 2. State Management Flow

```
User Input
  │ (drag node, change gain, load preset)
  ▼
useEQState Hook (React Reducer)
  │
  ├─ Validation (clamping, type checking)
  │
  ├─ State Update
  │  ├─ past: [...previous states]
  │  ├─ present: EQState (current)
  │  └─ future: [...redo states]
  │
  ▼
ParametricEQEngine.setState()
  │
  ├─ Recalculate Filter Coefficients
  │  (biquad math, normalization, validation)
  │
  ├─ Update Internal State
  │
  ▼
Re-render UI
  ├─ Spectrum Renderer
  ├─ EQ Curve Display
  ├─ Band Sliders
  └─ Parameter Displays
```

### 3. Preset Flow

```
Create Preset
    │
    ├─ Capture EQState
    │ (8 bands + gains + settings)
    │
    ├─ Validate Schema
    │
    ├─ Generate ID & Metadata
    │
    ├─ Store in PresetManager
    │
    ├─ Persist to Storage (LocalStorage)
    │
    ▼
Preset Available in UI

Load Preset
    │
    ├─ Retrieve from PresetManager
    │
    ├─ Validate State
    │
    ├─ Update useEQState Hook
    │
    ├─ Push to undo/redo history
    │
    ▼
Audio Processing Reflects New Settings
```

## Component Hierarchy

### UI Components

```
ParametricEQComponent (root)
├── Toolbar
│   ├── PresetMenu
│   ├── UndoRedo
│   └── Settings (Linear Phase, HQ, etc.)
├── SpectrumCanvas
│   ├── FFTAnalyzer feed
│   ├── EQ Curve overlay
│   └── Frequency/Gain labels
├── BandPanel (for each of 8 bands)
│   ├── BandNode (draggable)
│   ├── FrequencySlider
│   ├── GainSlider
│   ├── QControl
│   └── TypeSelector (if applicable)
├── MainControls
│   ├── InputGainSlider
│   └── OutputGainSlider
├── AIAssistant
│   └─ Recommendation Display
└── LearningCards
    └─ Educational Content
```

## Filtering Architecture

### Biquad Filter Pipeline

Each filter band uses a **biquad** (second-order IIR filter):

```
State Update → Calculate Coefficients → Process Audio
                                            │
                                ┌───────────┴───────────┐
                                ▼                       ▼
                    Direct Form II Transposed    Block Processing
                                │                       │
                                └───────────┬───────────┘
                                            ▼
                                    Output Samples
```

**Coefficient Calculation** (RBJ Cookbook):

```
Input: frequency, gain (dB), Q, sampleRate, filterType
  │
  ├─ Normalize frequency (0 to π)
  ├─ Calculate alpha (Q-based or slope-based)
  ├─ Calculate A (gain linear)
  │
  └─ Apply filter-type-specific formulas:
     - HighPass: (1+cos)/2 numerator
     - LowPass: (1-cos)/2 numerator
     - Peaking: gain-dependent bilinear
     - Shelf: composite S calculation

Output: {b0, b1, b2, a1, a2} (normalized by a0)
```

**Sample Processing** (Direct Form II Transposed):

```typescript
y[n] = b0*x[n] + s1
s1 = b1*x[n] - a1*y[n] + s2
s2 = b2*x[n] - a2*y[n]
```

Benefits:
- Numerically stable
- No intermediate rounding errors
- Efficient memory usage
- Low CPU per sample

## Analysis Architecture

### FFT Analyzer

**Algorithm**: Cooley-Tukey (Power-of-2 FFT)

```
Input: PCM Samples (time domain)
  │
  ├─ Window Function (Blackman-Harris)
  │
  ├─ Bit Reversal Permutation
  │
  ├─ Butterfly Operations (log2(N) stages)
  │ Each stage: Twiddle factor multiplication + addition
  │
  ├─ Magnitude Calculation: |X[k]| = sqrt(real² + imag²)
  │
  ├─ Convert to dB: 20*log10(magnitude)
  │
  ├─ Phase: atan2(imag, real)
  │
  └─ Peak Hold: exponential decay with refresh

Output: Frequency domain representation
```

**Complexity**:
- Time: O(N log N)
- Space: O(N)
- Window overhead: 1x input length

### Stereo Analysis

```
Left Channel  ──┐
                ├─→ FFT Analyzer ──┐
Right Channel ─┘                   │
                                   ├─→ Display: Left/Right/Mono
                                   │
Mid = (L + R) / 2  ──┐
                      ├─→ FFT Analyzer ──┐
Side = (L - R) / 2 ─┘                   └─→ Display: Mid/Side
```

## Preset System Architecture

### Schema Validation

```typescript
interface EQPreset {
  id: string;              // Must match: /^[a-z0-9-]+$/
  name: string;            // 1-100 chars
  category: string;        // Non-empty
  description: string;     // 0-500 chars
  tags: string[];          // Array of strings
  state: EQState;          // Full EQ configuration
  createdAt: number;       // Unix timestamp
  updatedAt: number;       // Unix timestamp
}

Validation Rules:
  - ID must be unique
  - Name must be non-empty
  - State must contain exactly 8 bands
  - Timestamps must be positive numbers
```

### Storage Interface

```typescript
interface PresetStorage {
  savePreset(preset: EQPreset): Promise<void>
  deletePreset(id: string): Promise<void>
  loadAllPresets(): Promise<EQPreset[]>
}
```

**Implementations**:
- `LocalStoragePresetStorage` - Browser localStorage
- `IndexedDBPresetStorage` - (Future) larger storage
- `RemotePresetStorage` - (Future) cloud sync

## Performance Considerations

### CPU Budget

Per-instance overhead:
- **Filter coefficients**: ~1 microsecond (amortized)
- **Sample processing**: ~50 nanoseconds (8 biquads × 6-8ns each)
- **FFT (4096 points)**: ~10 microseconds
- **Canvas rendering**: variable (60 FPS target)

**Target**: < 2% CPU on modern hardware (at 44.1kHz, 512 block size)

### Memory

- **Coefficients**: 8 bands × 6 floats = 48 bytes
- **Filter states**: 8 bands × 4 floats = 128 bytes
- **FFT buffer**: 4096 samples × 4 bytes = 16 KB
- **Analyzer output**: 2048 bins × 4 bytes = 8 KB

**Total per instance**: ~25 KB

### Rendering

- **Canvas resolution**: 1920×1080 max
- **Draw call frequency**: 60 Hz (requestAnimationFrame)
- **Spectrum point count**: 512-4096 points
- **Neon glow effect**: 1 shadow + stroke + fill

**Target**: 60 FPS on consumer hardware

## Error Handling

### Input Validation

```
User Input
  ├─ Type check (number, boolean, etc.)
  ├─ Range clamping (freq: 20-20kHz, gain: ±24dB)
  ├─ NaN/Infinity detection
  └─ Update only if valid

Coefficient Calculation
  ├─ Validate coefficients post-calculation
  ├─ Check for numerical instability
  └─ Fall back to bypass filter if invalid

State Persistence
  ├─ Parse JSON safely
  ├─ Validate against schema
  └─ Reject invalid presets with error message
```

### Graceful Degradation

- **Invalid coefficients** → Bypass band (unity gain)
- **Storage failure** → Use in-memory storage
- **Analyzer overflow** → Clamp to display range
- **Sample rate mismatch** → Recalculate coefficients

## Thread Safety

**Design**: Single-threaded (main JavaScript thread)

- No workers initially (can add AudioWorklet for DSP later)
- State updates are atomic
- Filter states are local per instance
- No shared mutable state between filters

**Future**: AudioWorklet option for dedicated DSP thread

## Type Safety

**TypeScript Configuration**:
```json
{
  "strict": true,
  "noImplicitAny": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true
}
```

**Coverage**:
- ✅ All public APIs fully typed
- ✅ No implicit `any` types
- ✅ Immutable state types (readonly properties)
- ✅ Discriminated unions for filter types
- ✅ Generic types for reusable components

## Testing Strategy

### Unit Tests

- Biquad coefficient calculations
- Frequency/dB conversions
- Validation functions
- Preset schema validation

### Integration Tests

- Audio processing pipeline
- Preset save/load
- Undo/redo history
- Analyzer data flow

### Performance Tests

- Coefficient calculation speed
- Sample processing throughput
- Canvas rendering FPS
- Memory leak detection

### Accessibility Tests

- Keyboard navigation
- High-contrast rendering
- Screen reader compatibility
- Touch target sizing (44×44px)

---

**Document Version**: 1.0  
**Last Updated**: 2025  
**Status**: Production Specification
