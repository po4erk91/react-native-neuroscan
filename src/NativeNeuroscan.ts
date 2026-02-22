import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

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
