# react-native-neuroscan

High-performance native document scanner for React Native with automatic edge detection, perspective correction, and advanced image processing. Built as a TurboModule for the New Architecture.

- **iOS** — Apple VisionKit (`VNDocumentCameraViewController`)
- **Android** — Google ML Kit Document Scanner

## Features

- Native document camera UI with real-time edge detection
- Automatic perspective correction
- Multi-page scanning with configurable page limits
- Gallery import support (Android)
- Post-processing filters: brightness, contrast, sharpness, rotation, crop
- Grayscale and black & white document modes with threshold control
- JPEG / PNG output with adjustable quality
- Temporary file management with cleanup API
- Full TypeScript support

## Requirements

| Platform | Minimum Version |
|----------|----------------|
| iOS      | 16.0           |
| Android  | SDK 24 (Android 7.0) |
| React Native | 0.76+ (New Architecture) |

**Android note:** requires Google Play Services (ML Kit). Devices without GMS (e.g. Huawei) are not currently supported.

## Installation

```sh
npm install react-native-neuroscan
# or
yarn add react-native-neuroscan
```

### iOS

```sh
cd ios && pod install
```

Add camera permission to `Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>We need camera access to scan documents</string>
```

### Android

Camera permission is declared in the library's `AndroidManifest.xml` and will be merged automatically. No additional setup required.

## Usage

### Scan documents

```tsx
import { NeuroScan } from 'react-native-neuroscan';

async function scan() {
  try {
    const result = await NeuroScan.scanDocument({
      maxPages: 5,
    });

    console.log(`Scanned ${result.pageCount} pages`);
    console.log(result.imageUrls); // ['file:///...page1.jpg', ...]
  } catch (error) {
    if (error.code === 'SCANNER_CANCELLED') {
      // User dismissed the scanner
      return;
    }
    console.error(error);
  }
}
```

### Process images

Apply filters to scanned images. Filters are applied in order: **crop > rotate > brightness/contrast > sharpen > grayscale/threshold**.

```tsx
const processed = await NeuroScan.processImage({
  imageUrl: result.imageUrls[0],
  brightness: 10,
  contrast: 20,
  sharpness: 50,
  rotation: 90,
});

console.log(processed.imageUrl); // 'file:///...processed.jpg'
```

#### Black & white document mode

```tsx
const bw = await NeuroScan.processImage({
  imageUrl: result.imageUrls[0],
  threshold: 128, // 0-255, converts to pure black & white
});
```

#### Crop with normalized coordinates

```tsx
const cropped = await NeuroScan.processImage({
  imageUrl: result.imageUrls[0],
  cropX: 0.1,      // 10% from left
  cropY: 0.1,      // 10% from top
  cropWidth: 0.8,   // 80% of width
  cropHeight: 0.8,  // 80% of height
});
```

### Cleanup temporary files

```tsx
await NeuroScan.cleanupTempFiles();
```

## API Reference

### `scanDocument(options?)`

Opens the native document scanner UI.

#### Options

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `maxPages` | `number` | `0` | Maximum pages to scan. `0` = unlimited |
| `enableAutoCapture` | `boolean` | `true` | Enable automatic capture mode |

#### Returns

```typescript
Promise<{
  imageUrls: string[];  // Array of file:// URIs (JPEG)
  pageCount: number;    // Number of scanned pages
}>
```

---

### `processImage(options)`

Applies post-processing filters to an image. Returns a new file URI — the original is not modified.

#### Options

| Parameter | Type | Range | Default | Description |
|-----------|------|-------|---------|-------------|
| `imageUrl` | `string` | — | **required** | `file://` URI of the source image |
| `brightness` | `number` | -100 to 100 | `0` | Brightness adjustment |
| `contrast` | `number` | -100 to 100 | `0` | Contrast adjustment |
| `sharpness` | `number` | 0 to 100 | `0` | Sharpening intensity |
| `rotation` | `number` | 0, 90, 180, 270 | `0` | Rotation in degrees |
| `grayscale` | `boolean` | — | `false` | Convert to grayscale |
| `threshold` | `number` | 0 to 255 | `0` | B&W threshold (`0` = disabled) |
| `cropX` | `number` | 0 to 1 | — | Normalized crop X offset |
| `cropY` | `number` | 0 to 1 | — | Normalized crop Y offset |
| `cropWidth` | `number` | 0 to 1 | — | Normalized crop width |
| `cropHeight` | `number` | 0 to 1 | — | Normalized crop height |
| `outputFormat` | `string` | `"jpeg"`, `"png"` | `"jpeg"` | Output image format |
| `quality` | `number` | 1 to 100 | `90` | Compression quality |

#### Returns

```typescript
Promise<{
  imageUrl: string;  // file:// URI of the processed image
}>
```

---

### `cleanupTempFiles()`

Removes all temporary files created by the scanner and image processor.

#### Returns

```typescript
Promise<boolean>  // true on success
```

## Error Codes

| Code | Description |
|------|-------------|
| `CAMERA_UNAVAILABLE` | Camera or scanner UI is not available on this device |
| `SCANNER_CANCELLED` | User dismissed the scanner |
| `SCANNER_FAILED` | Scanner initialization or execution error |
| `PROCESS_FAILED` | Image processing error |
| `CLEANUP_FAILED` | Failed to remove temporary files |

## Example

A full working example app is included in the [`example/`](./example) directory. It demonstrates scanning, page gallery, and an image editor with all available filters.

```sh
# Clone the repo
git clone https://github.com/po4erk91/react-native-neuroscan.git
cd react-native-neuroscan

# Install dependencies
yarn install

# Run the example
yarn example ios
# or
yarn example android
```

## How It Works

### iOS

Uses Apple's `VNDocumentCameraViewController` from the VisionKit framework. Edge detection and perspective correction are handled natively by the system. Image processing uses Core Image filters (`CIColorControls`, `CISharpenLuminance`, `CIPhotoEffectMono`, `CIColorThreshold`).

### Android

Uses Google ML Kit Document Scanner API in full scanner mode with gallery import support. Image processing uses Android's `ColorMatrix` for color adjustments and convolution kernels for sharpening. All processing runs on coroutines with the IO dispatcher.

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow details.

## License

MIT
