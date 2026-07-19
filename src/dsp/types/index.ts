/**
 * @r3/dsp/types
 * Core type definitions for the R3 Parametric EQ Engine
 * Strict TypeScript with zero implicit any
 */

// ============================================================================
// Filter Types
// ============================================================================

export enum FilterType {
  HighPass = 'highpass',
  LowShelf = 'lowshelf',
  Peaking = 'peaking',
  HighShelf = 'highshelf',
  LowPass = 'lowpass',
}

export enum ButterworthSlope {
  Slope12dB = 12,
  Slope24dB = 24,
  Slope36dB = 36,
  Slope48dB = 48,
}

/**
 * Represents a single EQ band with all parameters
 * Immutable interface - updates create new instances
 */
export interface EQBand {
  readonly id: number;
  readonly enabled: boolean;
  readonly type: FilterType;
  readonly frequency: number; // Hz, 20-20000
  readonly gain: number; // dB, -24 to +24
  readonly q: number; // Q factor, 0.1 to 24
  readonly slope?: ButterworthSlope; // For HighPass/LowPass
}

/**
 * Mutable version for state updates
 */
export interface EQBandUpdate extends Partial<EQBand> {
  id: number;
}

// ============================================================================
// EQ Engine State
// ============================================================================

export interface EQState {
  readonly inputGain: number; // -96 to +24 dB
  readonly outputGain: number; // -96 to +24 dB
  readonly bypass: boolean;
  readonly analyzerEnabled: boolean;
  readonly linearPhase: boolean;
  readonly oversampling: boolean;
  readonly autoGain: boolean;
  readonly bands: readonly EQBand[];
}

export interface EQStateUpdate {
  inputGain?: number;
  outputGain?: number;
  bypass?: boolean;
  analyzerEnabled?: boolean;
  linearPhase?: boolean;
  oversampling?: boolean;
  autoGain?: boolean;
  bands?: readonly EQBandUpdate[];
}

// ============================================================================
// Analyzer
// ============================================================================

export enum AnalyzerFFTSize {
  Size2048 = 2048,
  Size4096 = 4096,
  Size8192 = 8192,
  Size16384 = 16384,
}

export interface AnalyzerData {
  readonly frequencies: Float32Array;
  readonly magnitudes: Float32Array;
  readonly phases: Float32Array;
  readonly timestamp: number;
  readonly fftSize: AnalyzerFFTSize;
  readonly sampleRate: number;
}

export interface PeakHoldData {
  readonly values: Float32Array;
  readonly decayRate: number;
}

// ============================================================================
// Biquad Filter Coefficients
// ============================================================================

export interface BiquadCoefficients {
  readonly b0: number;
  readonly b1: number;
  readonly b2: number;
  readonly a0: number;
  readonly a1: number;
  readonly a2: number;
}

export interface BiquadState {
  readonly x1: number;
  readonly x2: number;
  readonly y1: number;
  readonly y2: number;
}

// ============================================================================
// Frequency Response
// ============================================================================

export interface FrequencyResponsePoint {
  readonly frequency: number;
  readonly magnitude: number; // dB
  readonly phase: number; // radians
}

export interface FrequencyResponse {
  readonly points: readonly FrequencyResponsePoint[];
  readonly sampleRate: number;
  readonly fftSize: number;
}

// ============================================================================
// Presets
// ============================================================================

export interface EQPreset {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly description: string;
  readonly state: EQState;
  readonly tags: readonly string[];
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface PresetMetadata {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly tags: readonly string[];
}

// ============================================================================
// AI Analysis
// ============================================================================

export enum FrequencyIssue {
  Mud = 'mud',
  Masking = 'masking',
  Harshness = 'harshness',
  Boominess = 'boominess',
  NasalTone = 'nasal_tone',
  Sibilance = 'sibilance',
  LackOfPresence = 'lack_of_presence',
  LowEndBuildup = 'low_end_buildup',
  Resonance = 'resonance',
  Clipping = 'clipping',
}

export interface AIRecommendation {
  readonly issue: FrequencyIssue;
  readonly detectedFrequency: number;
  readonly confidence: number; // 0-1
  readonly suggestedGain: number; // dB
  readonly suggestedQ: number;
  readonly description: string;
}

export interface AIAnalysisResult {
  readonly recommendations: readonly AIRecommendation[];
  readonly timestamp: number;
  readonly sampleRate: number;
}

// ============================================================================
// Automation
// ============================================================================

export interface AutomationPoint {
  readonly timestamp: number;
  readonly value: number;
  readonly curve: 'linear' | 'exponential' | 'ease-in' | 'ease-out';
}

export type AutomatableParameter =
  | 'frequency'
  | 'gain'
  | 'q'
  | 'slope'
  | 'bypass'
  | 'inputGain'
  | 'outputGain'
  | 'analyzerEnabled';

export interface AutomationTrack {
  readonly bandId: number;
  readonly parameter: AutomatableParameter;
  readonly points: readonly AutomationPoint[];
  readonly enabled: boolean;
}

// ============================================================================
// Audio Processing
// ============================================================================

export interface AudioBuffer {
  readonly channelData: Float32Array[];
  readonly sampleRate: number;
  readonly length: number;
  readonly numberOfChannels: number;
}

export interface ProcessingOptions {
  readonly sampleRate: number;
  readonly blockSize: number;
  readonly oversampling: boolean;
  readonly linearPhase: boolean;
}

// ============================================================================
// Validation Results
// ============================================================================

export interface ValidationError {
  readonly field: string;
  readonly message: string;
  readonly value: unknown;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ValidationError[];
}

// ============================================================================
// Events
// ============================================================================

export interface EQChangeEvent {
  readonly type: 'band_change' | 'state_change' | 'preset_load';
  readonly timestamp: number;
  readonly data: unknown;
}

export interface UndoRedoState {
  readonly past: readonly EQState[];
  readonly present: EQState;
  readonly future: readonly EQState[];
}
