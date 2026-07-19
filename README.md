# R3 NATIVE Parametric EQ Engine

A **production-ready, enterprise-grade parametric equalizer** built for the R3 NATIVE audio platform. Implements advanced digital signal processing with Web Audio API integration, real-time spectrum analysis, AI-powered EQ recommendations, and professional preset management.

## ✨ Features

### 🎛️ Core Processing
- **8-Band Parametric EQ** with independent control over each filter
- **High-Pass, Low-Pass** filters with variable slopes (12/24/36/48 dB/octave)
- **Low-Shelf, High-Shelf** filters for bass and treble shaping
- **5 Peaking filters** for surgical mid-range correction
- **Sample-accurate processing** with < 10ms latency
- **Multi-channel support** (stereo, mono, mid-side)

### 📊 Analysis & Visualization
- **Real-time FFT analyzer** (2048-16384 points) with Blackman-Harris windowing
- **60 FPS spectrum visualization** using Canvas 2D
- **Peak-hold and RMS display modes**
- **Logarithmic frequency scaling** for accurate frequency representation
- **Stereo and mid-side analysis modes**

### 🤖 AI-Powered Intelligence
- **Automatic frequency issue detection** (mud, harshness, sibilance, etc.)
- **Intelligent EQ recommendations** with suggested gain and Q values
- **Confidence scoring** for reliability assessment
- **Real-time analysis** as audio plays

### 🎨 UI/UX
- **R3 NATIVE theme integration** (Midnight Black + Neon Green)
- **Draggable EQ nodes** with fine-tuning controls
- **Touch and mouse support** with 44×44px hit targets
- **Keyboard shortcuts** for efficiency
- **High-contrast mode** for accessibility

### 💾 Presets & Automation
- **Factory presets** for common use cases (Vocal, Podcast, Hip-Hop, etc.)
- **Unlimited preset save/load** with metadata
- **Import/Export** as JSON
- **Automation support** for frequency, gain, Q, and bypass
- **A/B comparison** mode for reference

### 🔧 Professional Features
- **Undo/Redo** with full state history
- **Linear phase mode** for phase-coherent processing
- **Oversampling** support for reduced aliasing
- **Auto-gain compensation** to maintain loudness
- **Bypass mode** for transparent AB testing

## 📦 Project Structure

```
r3-parametric-eq/
├── packages/
│   ├── dsp/                    # Digital Signal Processing
│   │   ├── src/
│   │   │   ├── types/          # TypeScript type definitions
│   │   │   ├── filters/        # Biquad filters, EQ band management
│   │   │   ├── analyzer/       # FFT spectrum analyzer
│   │   │   ├── presets/        # Preset manager
│   │   │   └── ai/             # AI recommendation engine
│   │   └── __tests__/
│   │
│   ├── ui/                     # React Components & Canvas Rendering
│   │   ├── src/
│   │   │   ├── components/     # React EQ components
│   │   │   ├── hooks/          # React hooks (useEQState, etc.)
│   │   │   ├── canvas/         # Canvas renderers
│   │   │   └── styles/         # R3 theme CSS
│   │   └── __tests__/
│   │
│   ├── engine/                 # Web Audio API integration
│   ├── shared/                 # Shared utilities
│   │
│   └── package.json
│
├── apps/
│   ├── demo/                   # Interactive demo application
│   └── docs/                   # Documentation site
│
├── docs/
│   └── architecture/           # Technical architecture documentation
│
└── package.json               # Root workspace configuration
```

## 🚀 Quick Start

### Installation

```bash
# Clone the project
git clone <repo>
cd r3-parametric-eq

# Install dependencies (using pnpm)
pnpm install

# Build all packages
pnpm build

# Run type checking
pnpm type-check

# Run tests
pnpm test

# Start development
pnpm dev
```

### Basic Usage

#### DSP Engine

```typescript
import { createParametricEQ } from '@r3/dsp';

// Create engine
const eq = createParametricEQ(44100); // 44.1kHz sample rate

// Get current state
const state = eq.getState();
console.log(state.bands); // Array of 8 EQ bands

// Update band
eq.updateBand(2, {
  frequency: 300,
  gain: -3,
  q: 1.2,
});

// Process audio
const inputSamples = new Float32Array(512);
const outputSamples = eq.processBlock(inputSamples);

// Get frequency response
const curve = eq.getEQCurve(512); // 512 points for UI rendering
```

#### React Hook

```typescript
import { useEQState } from '@r3/ui/hooks';

function MyEQComponent() {
  const {
    state,
    updateBand,
    setInputGain,
    setOutputGain,
    undo,
    redo,
    canUndo,
    canRedo,
    engine,
  } = useEQState();

  const handleBandChange = (bandId: number, frequency: number) => {
    updateBand(bandId, { frequency });
  };

  return (
    <div>
      <button onClick={() => updateBand(0, { gain: 5 })}>
        Boost Band 1
      </button>
      <button onClick={undo} disabled={!canUndo}>
        Undo
      </button>
      <button onClick={redo} disabled={!canRedo}>
        Redo
      </button>
    </div>
  );
}
```

#### Preset Management

```typescript
import { PresetManager } from '@r3/dsp/presets';

const manager = new PresetManager();

// Create preset
const preset = manager.createPreset(
  'My Custom Preset',
  state,
  'Custom',
  'Great for vocals',
  ['vocal', 'bright']
);

// Search presets
const vocalPresets = manager.searchPresets('vocal');

// Export
const json = manager.exportPreset(preset.id);

// Import
const imported = manager.importPreset(json);
```

## 📐 Architecture

### DSP Layer (`@r3/dsp`)

**Zero Runtime Dependencies** - Pure TypeScript math and DSP algorithms.

- **Biquad Filters**: RBJ Audio EQ Cookbook implementations with numerically stable coefficients
- **FFT Analyzer**: Cooley-Tukey FFT with Blackman-Harris windowing
- **Parametric EQ**: 8-band cascade filter with state management
- **Preset System**: Validated JSON schema with storage interface

### UI Layer (`@r3/ui`)

**React 19 Compatible** - Modern React with hooks and functional components.

- **Canvas Rendering**: High-performance 2D graphics for spectrum
- **React Hooks**: State management with undo/redo support
- **Styled Components**: R3 theme CSS with CSS variables
- **Touch Optimized**: Mobile-friendly gesture support

### Integration

- **Web Audio API**: AudioNode connections for real-time processing
- **Audio Worklet**: Option for DSP on dedicated thread
- **TypeScript**: Strict mode (`noImplicitAny`, full type safety)

## 🧪 Quality Assurance

### Code Quality

- ✅ **TypeScript Strict Mode** - Zero implicit `any`
- ✅ **ESLint** - Strict linting rules
- ✅ **Prettier** - Automatic code formatting
- ✅ **No duplicate logic** - Centralized implementations

### Testing

- ✅ **Unit Tests** - Vitest for DSP math validation
- ✅ **Integration Tests** - Audio graph and preset system
- ✅ **Performance Tests** - 60 FPS rendering, CPU usage budgets
- ✅ **Accessibility** - High-contrast mode, keyboard navigation

### Performance Targets

- **Latency**: < 10ms (Web Audio API minimum)
- **CPU**: < 2% per instance (target)
- **Memory**: Immutable state structures
- **Rendering**: 60 FPS (Canvas 2D + requestAnimationFrame)

## 📚 API Reference

### ParametricEQEngine

```typescript
class ParametricEQEngine {
  // State
  getState(): Readonly<EQState>
  setState(updates: Partial<EQState>): void
  updateBand(bandId: number, updates: Partial<EQBand>): void

  // Processing
  processBlock(input: Float32Array): Float32Array
  processChannels(inputs: Float32Array[]): Float32Array[]
  resetFilters(): void

  // Analysis
  getFrequencyResponse(frequencies: number[]): FrequencyResponse
  getEQCurve(numPoints?: number): FrequencyResponsePoint[]
  getMagnitudeAtFrequency(frequency: number): number

  // Lifecycle
  setSampleRate(sampleRate: number): void
  getSampleRate(): number
  validate(): { valid: boolean; errors: string[] }
}
```

### FFTAnalyzer

```typescript
class FFTAnalyzer {
  pushSamples(samples: Float32Array): boolean
  getAnalysisData(): AnalyzerData
  getMagnitudes(): Float32Array
  getPeakHold(): Float32Array
  reset(): void
  setFFTSize(fftSize: AnalyzerFFTSize): void
}
```

### PresetManager

```typescript
class PresetManager {
  createPreset(
    name: string,
    state: EQState,
    category?: string,
    description?: string,
    tags?: string[]
  ): EQPreset

  getPreset(id: string): EQPreset | null
  getAllPresets(): EQPreset[]
  updatePreset(id: string, updates: Partial<EQPreset>): EQPreset
  deletePreset(id: string): boolean

  searchPresets(query: string): EQPreset[]
  getPresetsByCategory(category: string): EQPreset[]
  getPresetsByTag(tag: string): EQPreset[]

  exportPreset(id: string): string
  importPreset(json: string): EQPreset
}
```

## 🎓 Educational Reference

### The 8 Bands Explained

| Band | Type | Range | Purpose |
|------|------|-------|---------|
| 1 | High Pass | 20-200 Hz | Remove rumble and subsonic noise |
| 2 | Low Shelf | 20-250 Hz | Shape bass response |
| 3 | Peaking | 200-500 Hz | Cut mud and boxiness |
| 4 | Peaking | 500Hz-2kHz | Control muddiness in mids |
| 5 | Peaking | 2-5kHz | Add presence and clarity |
| 6 | Peaking | 5-8kHz | Reduce harshness (sibilance) |
| 7 | High Shelf | 8-20kHz | Add air and shimmer |
| 8 | Low Pass | 10-20kHz | Remove hiss |

### Key Techniques

**Subtractive EQ**: Always remove problem frequencies first, then boost what matters.

**Small Moves**: Start with ±2-3dB. Large boosts/cuts sound artificial and increase CPU load.

**Reference Tracks**: Compare against professional mixes in your genre.

**Trust Your Ears**: But verify with spectrum analyzer for objective data.

## 🔌 Integration with R3 NATIVE

### Audio Graph Connection

```typescript
import { createParametricEQ } from '@r3/dsp';

// Create engine
const eqEngine = createParametricEQ(audioContext.sampleRate);

// In your audio processing callback:
const processed = eqEngine.processBlock(inputBuffer);
```

### State Persistence

```typescript
// Save to R3 project state
const preset = manager.createPreset('My Mix', eqEngine.getState());
projectState.eqPreset = preset.id;

// Restore later
const restored = manager.getPreset(projectState.eqPreset);
eqEngine.setState(restored.state);
```

## 🐛 Troubleshooting

### Issue: High CPU Usage

- Reduce FFT size (2048 instead of 16384)
- Disable peak-hold display
- Reduce number of analyzer bands
- Use mono analysis instead of stereo

### Issue: Audio Artifacts

- Check sample rate mismatch
- Verify filter coefficients with `validateCoefficients()`
- Ensure audio is not clipping (check output gain)
- Reset filters between preset changes

### Issue: Spectrum Not Updating

- Verify analyzer is enabled in state
- Check that audio is flowing to analyzer
- Increase FFT size for lower frequency resolution

## 📖 Additional Resources

- **Biquad Design**: [RBJ Audio EQ Cookbook](https://www.w3.org/TR/webaudio/#biquadfilter-algorithms)
- **FFT**: Cooley-Tukey algorithm with complex number support
- **Spectral Analysis**: Window functions and leakage reduction
- **Audio in Web**: [Web Audio API Spec](https://www.w3.org/TR/webaudio/)

## 📄 License

Part of R3 NATIVE. See LICENSE file.

## 🙋 Support

For issues and feature requests, please open GitHub issues in the R3 NATIVE repository.

---

**Built with ❤️ for professional audio engineers using R3 NATIVE**
