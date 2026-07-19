/**
 * @r3/dsp
 * R3 NATIVE Digital Signal Processing Engine
 * Production-ready audio processing for parametric EQ
 */

// ============================================================================
// Type Exports
// ============================================================================
export type {
  EQBand,
  EQBandUpdate,
  EQState,
  EQStateUpdate,
  AnalyzerData,
  BiquadCoefficients,
  BiquadState,
  FrequencyResponse,
  FrequencyResponsePoint,
  EQPreset,
  PresetMetadata,
  AIRecommendation,
  AIAnalysisResult,
  AutomationPoint,
  AutomationTrack,
  AudioBuffer,
  ProcessingOptions,
  ValidationError,
  ValidationResult,
  UndoRedoState,
  PeakHoldData,
} from './types/index.js';

export {
  FilterType,
  ButterworthSlope,
  AnalyzerFFTSize,
  FrequencyIssue,
  AutomatableParameter,
} from './types/index.js';

// ============================================================================
// Filter Exports
// ============================================================================
export {
  // Biquad
  calculateBiquadCoefficients,
  processSampleBiquad,
  processBlockBiquad,
  validateCoefficients,
  resetFilterState,
  getMagnitudeResponse,
  getPhaseResponse,
  // EQ Band
  createDefaultBand,
  cloneBand,
  validateFrequency,
  validateGain,
  validateQ,
  validateBand,
  setBandFrequency,
  setBandGain,
  setBandQ,
  setBandEnabled,
  resetBand,
  updateBand,
  getSuggestedFrequencyRange,
  getFilterTypeName,
  getSuggestedQRange,
  BandFilterState,
  // Parametric EQ
  ParametricEQEngine,
  createParametricEQ,
} from './filters/index.js';

// ============================================================================
// Analyzer Exports
// ============================================================================
export {
  FFTAnalyzer,
  StereoAnalyzer,
  createBlackmanHarrisWindow,
  createHannWindow,
  createHammingWindow,
} from './analyzer/fft-analyzer.js';

// ============================================================================
// Preset Exports
// ============================================================================
export {
  PresetManager,
  LocalStoragePresetStorage,
  validatePreset,
  createFactoryPresets,
} from './presets/preset-manager.js';

export type { PresetStorage } from './presets/preset-manager.js';

// ============================================================================
// AI Analyzer Exports
// ============================================================================
export { AIEQAnalyzer, createAIAnalyzer } from './ai/ai-analyzer.js';

// ============================================================================
// Version
// ============================================================================
export const VERSION = '1.0.0';
