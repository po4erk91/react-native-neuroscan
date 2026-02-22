import Foundation
import UIKit
import VisionKit

public typealias RNResolver = @convention(block) (Any?) -> Void
public typealias RNRejecter = @convention(block) (String?, String?, Error?) -> Void

@objcMembers
public class NeuroScanImpl: NSObject {

    private let fileManager = FileManager.default
    private var scannerController: DocumentScannerController?

    // MARK: - Temp Directory

    private var tempDirectory: URL {
        let dir = fileManager.temporaryDirectory.appendingPathComponent("neuroscan", isDirectory: true)
        if !fileManager.fileExists(atPath: dir.path) {
            try? fileManager.createDirectory(at: dir, withIntermediateDirectories: true)
        }
        return dir
    }

    // MARK: - scanDocument

    public func scanDocument(
        maxPages: Int,
        enableAutoCapture: Bool,
        resolver: @escaping RNResolver,
        rejecter: @escaping RNRejecter
    ) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            guard VNDocumentCameraViewController.isSupported else {
                rejecter("CAMERA_UNAVAILABLE", "Document camera is not available on this device", nil)
                return
            }

            self.scannerController = DocumentScannerController(
                maxPages: maxPages > 0 ? maxPages : Int.max,
                tempDirectory: self.tempDirectory
            ) { result in
                switch result {
                case .success(let urls):
                    let urlStrings = urls.map { $0.absoluteString }
                    resolver([
                        "imageUrls": urlStrings,
                        "pageCount": urlStrings.count,
                    ] as [String: Any])
                case .failure(let error):
                    if (error as NSError).code == -1 {
                        rejecter("SCANNER_CANCELLED", "Document scanner was cancelled", error)
                    } else {
                        rejecter("SCANNER_FAILED", error.localizedDescription, error)
                    }
                }
                self.scannerController = nil
            }

            self.scannerController?.present()
        }
    }

    // MARK: - processImage

    public func processImage(
        imageUrl: String,
        grayscale: Bool,
        contrast: Double,
        brightness: Double,
        sharpness: Double,
        rotation: Double,
        cropX: Double,
        cropY: Double,
        cropWidth: Double,
        cropHeight: Double,
        threshold: Double,
        outputFormat: String,
        quality: Double,
        resolver: @escaping RNResolver,
        rejecter: @escaping RNRejecter
    ) {
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }

            // 1. Load the image
            guard let url = URL(string: imageUrl),
                  let imageData = try? Data(contentsOf: url),
                  let uiImage = UIImage(data: imageData),
                  var ciImage = CIImage(image: uiImage) else {
                rejecter("PROCESS_FAILED", "Failed to load image from \(imageUrl)", nil)
                return
            }

            let context = CIContext(options: [.useSoftwareRenderer: false])

            // --- Filter order: crop -> rotate -> brightness/contrast -> sharpen -> grayscale/threshold ---

            // 2. CROP (all four values must be >= 0)
            if cropX >= 0, cropY >= 0, cropWidth > 0, cropHeight > 0 {
                let extent = ciImage.extent
                let x = cropX * Double(extent.width)
                // CIImage origin is bottom-left, so invert Y
                let y = (1.0 - cropY - cropHeight) * Double(extent.height)
                let w = cropWidth * Double(extent.width)
                let h = cropHeight * Double(extent.height)
                ciImage = ciImage.cropped(to: CGRect(x: x, y: y, width: w, height: h))
            }

            // 3. ROTATION (0, 90, 180, 270)
            let rotationInt = Int(rotation) % 360
            if rotationInt != 0 {
                let radians = Double(rotationInt) * .pi / 180.0
                ciImage = ciImage.transformed(by: CGAffineTransform(rotationAngle: CGFloat(radians)))
                // Translate to ensure origin stays at (0,0)
                let ext = ciImage.extent
                ciImage = ciImage.transformed(by: CGAffineTransform(
                    translationX: -ext.origin.x,
                    y: -ext.origin.y
                ))
            }

            // 4. BRIGHTNESS & CONTRAST (CIColorControls)
            if brightness != 0 || contrast != 0 {
                if let filter = CIFilter(name: "CIColorControls") {
                    filter.setValue(ciImage, forKey: kCIInputImageKey)
                    // inputBrightness: -1 to 1
                    filter.setValue(brightness / 100.0, forKey: kCIInputBrightnessKey)
                    // inputContrast: 0 to 4 (1.0 = no change). Map -100..100 to 0..2
                    filter.setValue(1.0 + (contrast / 100.0), forKey: kCIInputContrastKey)
                    if let output = filter.outputImage {
                        ciImage = output
                    }
                }
            }

            // 5. SHARPNESS (CISharpenLuminance)
            if sharpness > 0 {
                if let filter = CIFilter(name: "CISharpenLuminance") {
                    filter.setValue(ciImage, forKey: kCIInputImageKey)
                    // inputSharpness 0..2. Map 0-100 to 0-2
                    filter.setValue(sharpness / 50.0, forKey: kCIInputSharpnessKey)
                    if let output = filter.outputImage {
                        ciImage = output
                    }
                }
            }

            // 6. GRAYSCALE or THRESHOLD
            if threshold > 0 {
                // Grayscale first, then threshold for B&W document mode
                if let monoFilter = CIFilter(name: "CIPhotoEffectMono") {
                    monoFilter.setValue(ciImage, forKey: kCIInputImageKey)
                    if let monoOutput = monoFilter.outputImage {
                        ciImage = monoOutput
                    }
                }
                if let thresholdFilter = CIFilter(name: "CIColorThreshold") {
                    thresholdFilter.setValue(ciImage, forKey: kCIInputImageKey)
                    // Map 0-255 to 0.0-1.0
                    thresholdFilter.setValue(threshold / 255.0, forKey: "inputThreshold")
                    if let output = thresholdFilter.outputImage {
                        ciImage = output
                    }
                }
            } else if grayscale {
                if let filter = CIFilter(name: "CIPhotoEffectMono") {
                    filter.setValue(ciImage, forKey: kCIInputImageKey)
                    if let output = filter.outputImage {
                        ciImage = output
                    }
                }
            }

            // 7. Render and save
            guard let cgImage = context.createCGImage(ciImage, from: ciImage.extent) else {
                rejecter("PROCESS_FAILED", "Failed to render processed image", nil)
                return
            }

            let resultImage = UIImage(cgImage: cgImage)
            let ext = outputFormat == "png" ? "png" : "jpg"
            let outputUrl = self.tempDirectory.appendingPathComponent("\(UUID().uuidString).\(ext)")

            let data: Data?
            if outputFormat == "png" {
                data = resultImage.pngData()
            } else {
                data = resultImage.jpegData(compressionQuality: CGFloat(quality / 100.0))
            }

            guard let fileData = data else {
                rejecter("PROCESS_FAILED", "Failed to encode processed image", nil)
                return
            }

            do {
                try fileData.write(to: outputUrl)
                resolver(["imageUrl": outputUrl.absoluteString] as [String: Any])
            } catch {
                rejecter("PROCESS_FAILED", "Failed to save processed image: \(error.localizedDescription)", error)
            }
        }
    }

    // MARK: - cleanupTempFiles

    public func cleanupTempFiles(
        resolver: @escaping RNResolver,
        rejecter: @escaping RNRejecter
    ) {
        DispatchQueue.global(qos: .utility).async { [weak self] in
            guard let self = self else { return }

            do {
                if self.fileManager.fileExists(atPath: self.tempDirectory.path) {
                    try self.fileManager.removeItem(at: self.tempDirectory)
                }
                resolver(NSNumber(value: true))
            } catch {
                rejecter("CLEANUP_FAILED", "Failed to cleanup temp files: \(error.localizedDescription)", error)
            }
        }
    }
}
