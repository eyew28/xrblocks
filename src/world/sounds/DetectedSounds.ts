/**
 * Represents a sound category with its associated confidence score.
 */
export interface Category {
  /** The name of the detected category (e.g., "Speech", "Music"). */
  categoryName: string;
  /** The confidence score of the detection, typically between 0 and 1. */
  score: number;
  /** Optional human-readable name for the category. */
  displayName?: string;
}

/**
 * Contains a list of categories for a specific detection.
 */
export interface Classification {
  /** Array of detected categories, typically sorted by score. */
  categories: Category[];
}

/**
 * A single result item from the audio classifier.
 */
export interface AudioClassifierResultItem {
  /** List of classifications for this result item since there could
   * be multiple types of sounds overlapping in the same time interval. */
  classifications: Classification[];
}

/**
 * Debugging information about the audio processing.
 */
export interface DebugData {
  /** Root Mean Square, representing the volume/energy of the audio. */
  rms: number;
  /** The size of the audio buffer processed. */
  bufferSize: number;
  /** The sample rate of the audio data. */
  sampleRate: number;
}

/**
 * The overall result returned by the audio classifier.
 */
export interface AudioClassifierResult {
  /** List of result items containing classifications. */
  items: AudioClassifierResultItem[];
  /** Optional debug data. */
  debug?: DebugData;
}
