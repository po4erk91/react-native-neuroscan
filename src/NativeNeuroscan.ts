import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * Error codes thrown by NeuroScan methods.
 */
export type NeuroScanErrorCode =
  | 'CAMERA_UNAVAILABLE'
  | 'SCANNER_CANCELLED'
  | 'SCANNER_FAILED'
  | 'PROCESS_FAILED'
  | 'CLEANUP_FAILED';

/**
 * Typed error thrown by NeuroScan methods.
 */
export interface NeuroScanError extends Error {
  code: NeuroScanErrorCode;
}

/**
 * Type guard to check if an unknown error is a NeuroScanError.
 */
export function isNeuroScanError(error: unknown): error is NeuroScanError {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof (error as NeuroScanError).code === 'string'
  );
}

export interface Spec extends TurboModule {
  /**
   * Launch native document scanner UI
   * iOS: VNDocumentCameraViewController
   * Android: ML Kit Document Scanner
   */
  scanDocument(options: {
    maxPages?: number;
    enableAutoCapture?: boolean;
  }): Promise<{
    imageUrls: string[];
    pageCount: number;
  }>;

  /**
   * Apply post-processing filters to a scanned image.
   * Returns a new file:// URI for the processed image.
   *
   * Filter application order: crop -> rotate -> brightness/contrast -> sharpen -> grayscale/threshold
   */
  processImage(options: {
    imageUrl: string;
    grayscale?: boolean;
    contrast?: number;
    brightness?: number;
    sharpness?: number;
    rotation?: number;
    cropX?: number;
    cropY?: number;
    cropWidth?: number;
    cropHeight?: number;
    threshold?: number;
    outputFormat?: string;
    quality?: number;
  }): Promise<{
    imageUrl: string;
  }>;

  /**
   * Cleanup temporary files created by the scanner
   */
  cleanupTempFiles(): Promise<boolean>;

  // Event emitter support
  addListener(eventType: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('Neuroscan');
