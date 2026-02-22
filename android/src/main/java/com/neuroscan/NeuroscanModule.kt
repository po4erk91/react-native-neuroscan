package com.neuroscan

import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.content.IntentSender
import com.facebook.react.bridge.*
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult
import kotlinx.coroutines.*
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

class NeuroscanModule(reactContext: ReactApplicationContext) :
    NativeNeuroscanSpec(reactContext) {

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private var scanPromise: Promise? = null
    private val activityListener = ScanActivityListener()

    private val tempDir: File
        get() {
            val dir = File(reactApplicationContext.cacheDir, "neuroscan")
            if (!dir.exists()) dir.mkdirs()
            return dir
        }

    init {
        reactContext.addActivityEventListener(activityListener)
    }

    override fun getName(): String = NAME

    // MARK: - scanDocument

    override fun scanDocument(options: ReadableMap, promise: Promise) {
        val activity = currentActivity
        if (activity == null) {
            promise.reject("CAMERA_UNAVAILABLE", "No activity available")
            return
        }

        val maxPages = if (options.hasKey("maxPages")) options.getInt("maxPages") else 0

        val scannerOptions = GmsDocumentScannerOptions.Builder()
            .setGalleryImportAllowed(true)
            .setResultFormats(GmsDocumentScannerOptions.RESULT_FORMAT_JPEG)
            .setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_FULL)
            .apply {
                if (maxPages > 0) setPageLimit(maxPages)
            }
            .build()

        val scanner = GmsDocumentScanning.getClient(scannerOptions)

        scanPromise = promise

        scanner.getStartScanIntent(activity)
            .addOnSuccessListener { intentSender: IntentSender ->
                try {
                    activity.startIntentSenderForResult(
                        intentSender,
                        SCAN_REQUEST_CODE,
                        null, 0, 0, 0
                    )
                } catch (e: Exception) {
                    scanPromise?.reject("SCANNER_FAILED", "Failed to start scanner: ${e.message}", e)
                    scanPromise = null
                }
            }
            .addOnFailureListener { e: Exception ->
                scanPromise?.reject("SCANNER_FAILED", "Failed to initialize scanner: ${e.message}", e)
                scanPromise = null
            }
    }

    // MARK: - processImage

    override fun processImage(options: ReadableMap, promise: Promise) {
        scope.launch {
            try {
                val imageUrl = options.getString("imageUrl")
                    ?: throw IllegalArgumentException("imageUrl is required")
                val grayscale = if (options.hasKey("grayscale")) options.getBoolean("grayscale") else false
                val contrast = if (options.hasKey("contrast")) options.getDouble("contrast") else 0.0
                val brightness = if (options.hasKey("brightness")) options.getDouble("brightness") else 0.0
                val sharpness = if (options.hasKey("sharpness")) options.getDouble("sharpness") else 0.0
                val rotation = if (options.hasKey("rotation")) options.getDouble("rotation").toFloat() else 0f
                val cropX = if (options.hasKey("cropX")) options.getDouble("cropX") else -1.0
                val cropY = if (options.hasKey("cropY")) options.getDouble("cropY") else -1.0
                val cropWidth = if (options.hasKey("cropWidth")) options.getDouble("cropWidth") else -1.0
                val cropHeight = if (options.hasKey("cropHeight")) options.getDouble("cropHeight") else -1.0
                val threshold = if (options.hasKey("threshold")) options.getDouble("threshold").toInt() else 0
                val outputFormat = if (options.hasKey("outputFormat")) options.getString("outputFormat") ?: "jpeg" else "jpeg"
                val quality = if (options.hasKey("quality")) options.getDouble("quality").toInt() else 90

                // Load bitmap
                val filePath = imageUrl.removePrefix("file://")
                val originalBitmap = BitmapFactory.decodeFile(filePath)
                    ?: throw IllegalArgumentException("Failed to load image from $imageUrl")

                var bitmap = originalBitmap.copy(Bitmap.Config.ARGB_8888, true)
                originalBitmap.recycle()

                // --- Filter order: crop -> rotate -> brightness/contrast -> sharpen -> grayscale/threshold ---

                // 1. CROP
                if (cropX >= 0 && cropY >= 0 && cropWidth > 0 && cropHeight > 0) {
                    val x = (cropX * bitmap.width).toInt().coerceAtLeast(0)
                    val y = (cropY * bitmap.height).toInt().coerceAtLeast(0)
                    val w = (cropWidth * bitmap.width).toInt().coerceAtMost(bitmap.width - x)
                    val h = (cropHeight * bitmap.height).toInt().coerceAtMost(bitmap.height - y)
                    if (w > 0 && h > 0) {
                        val cropped = Bitmap.createBitmap(bitmap, x, y, w, h)
                        bitmap.recycle()
                        bitmap = cropped
                    }
                }

                // 2. ROTATION
                val rotationInt = rotation.toInt() % 360
                if (rotationInt != 0) {
                    val matrix = android.graphics.Matrix()
                    matrix.postRotate(rotationInt.toFloat())
                    val rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
                    bitmap.recycle()
                    bitmap = rotated
                }

                // 3. BRIGHTNESS & CONTRAST (ColorMatrix)
                if (brightness != 0.0 || contrast != 0.0) {
                    val contrastFactor = (1.0 + contrast / 100.0).toFloat()
                    val brightnessOffset = (brightness / 100.0 * 255.0).toFloat()
                    val translate = (1.0f - contrastFactor) * 128f

                    val cm = android.graphics.ColorMatrix(floatArrayOf(
                        contrastFactor, 0f, 0f, 0f, translate + brightnessOffset,
                        0f, contrastFactor, 0f, 0f, translate + brightnessOffset,
                        0f, 0f, contrastFactor, 0f, translate + brightnessOffset,
                        0f, 0f, 0f, 1f, 0f
                    ))

                    val paint = android.graphics.Paint()
                    paint.colorFilter = android.graphics.ColorMatrixColorFilter(cm)
                    val temp = bitmap.copy(Bitmap.Config.ARGB_8888, true)
                    val canvas = android.graphics.Canvas(temp)
                    canvas.drawBitmap(bitmap, 0f, 0f, paint)
                    bitmap.recycle()
                    bitmap = temp
                }

                // 4. SHARPNESS (3x3 convolution kernel)
                if (sharpness > 0) {
                    val amount = (sharpness / 100.0).toFloat()
                    val center = 1.0f + 4.0f * amount
                    val side = -amount
                    val kernel = floatArrayOf(
                        0f, side, 0f,
                        side, center, side,
                        0f, side, 0f
                    )

                    val width = bitmap.width
                    val height = bitmap.height
                    val srcPixels = IntArray(width * height)
                    bitmap.getPixels(srcPixels, 0, width, 0, 0, width, height)
                    val dstPixels = IntArray(width * height)
                    // Copy edge pixels
                    System.arraycopy(srcPixels, 0, dstPixels, 0, srcPixels.size)

                    for (y in 1 until height - 1) {
                        for (x in 1 until width - 1) {
                            var r = 0f; var g = 0f; var b = 0f
                            for (ky in -1..1) {
                                for (kx in -1..1) {
                                    val pixel = srcPixels[(y + ky) * width + (x + kx)]
                                    val k = kernel[(ky + 1) * 3 + (kx + 1)]
                                    r += ((pixel shr 16) and 0xFF) * k
                                    g += ((pixel shr 8) and 0xFF) * k
                                    b += (pixel and 0xFF) * k
                                }
                            }
                            val a = (srcPixels[y * width + x] shr 24) and 0xFF
                            dstPixels[y * width + x] = (a shl 24) or
                                (r.toInt().coerceIn(0, 255) shl 16) or
                                (g.toInt().coerceIn(0, 255) shl 8) or
                                b.toInt().coerceIn(0, 255)
                        }
                    }
                    bitmap.setPixels(dstPixels, 0, width, 0, 0, width, height)
                }

                // 5. GRAYSCALE or THRESHOLD
                if (threshold > 0) {
                    val width = bitmap.width
                    val height = bitmap.height
                    val pixels = IntArray(width * height)
                    bitmap.getPixels(pixels, 0, width, 0, 0, width, height)

                    for (i in pixels.indices) {
                        val pixel = pixels[i]
                        val a = (pixel shr 24) and 0xFF
                        val r = (pixel shr 16) and 0xFF
                        val g = (pixel shr 8) and 0xFF
                        val b = pixel and 0xFF
                        val gray = (0.299 * r + 0.587 * g + 0.114 * b).toInt()
                        val bw = if (gray >= threshold) 255 else 0
                        pixels[i] = (a shl 24) or (bw shl 16) or (bw shl 8) or bw
                    }
                    bitmap.setPixels(pixels, 0, width, 0, 0, width, height)
                } else if (grayscale) {
                    val cm = android.graphics.ColorMatrix()
                    cm.setSaturation(0f)
                    val paint = android.graphics.Paint()
                    paint.colorFilter = android.graphics.ColorMatrixColorFilter(cm)
                    val temp = bitmap.copy(Bitmap.Config.ARGB_8888, true)
                    val canvas = android.graphics.Canvas(temp)
                    canvas.drawBitmap(bitmap, 0f, 0f, paint)
                    bitmap.recycle()
                    bitmap = temp
                }

                // 6. Save result
                val savedUrl = saveBitmap(bitmap, outputFormat, quality)
                bitmap.recycle()

                if (savedUrl != null) {
                    val resultMap = Arguments.createMap().apply {
                        putString("imageUrl", savedUrl)
                    }
                    promise.resolve(resultMap)
                } else {
                    promise.reject("PROCESS_FAILED", "Failed to save processed image")
                }
            } catch (e: Exception) {
                promise.reject("PROCESS_FAILED", "Failed to process image: ${e.message}", e)
            }
        }
    }

    // MARK: - cleanupTempFiles

    override fun cleanupTempFiles(promise: Promise) {
        scope.launch {
            try {
                if (tempDir.exists()) {
                    tempDir.deleteRecursively()
                }
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("CLEANUP_FAILED", "Failed to cleanup temp files: ${e.message}", e)
            }
        }
    }

    // MARK: - Event Emitter

    override fun addListener(eventType: String) {}
    override fun removeListeners(count: Double) {}

    // MARK: - Helpers

    private fun saveBitmap(bitmap: Bitmap, format: String = "jpeg", quality: Int = 90): String? {
        return try {
            val ext = if (format == "png") "png" else "jpg"
            val file = File(tempDir, "${UUID.randomUUID()}.$ext")

            FileOutputStream(file).use { out ->
                val compressFormat = if (format == "png") Bitmap.CompressFormat.PNG else Bitmap.CompressFormat.JPEG
                bitmap.compress(compressFormat, quality, out)
            }

            "file://${file.absolutePath}"
        } catch (e: Exception) {
            null
        }
    }

    // MARK: - Activity Result Handling

    private inner class ScanActivityListener : BaseActivityEventListener() {
        override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
            if (requestCode != SCAN_REQUEST_CODE) return

            val promise = scanPromise ?: return
            scanPromise = null

            if (resultCode == Activity.RESULT_CANCELED) {
                promise.reject("SCANNER_CANCELLED", "Document scanner was cancelled")
                return
            }

            val result = GmsDocumentScanningResult.fromActivityResultIntent(data)
            if (result == null) {
                promise.reject("SCANNER_FAILED", "Failed to get scanner result")
                return
            }

            scope.launch {
                try {
                    val urls = mutableListOf<String>()
                    val pages = result.getPages() ?: emptyList()

                    for (page in pages) {
                        val imageUri = page.getImageUri()
                        val inputStream = reactApplicationContext.contentResolver.openInputStream(imageUri)
                        val bitmap = BitmapFactory.decodeStream(inputStream)
                        inputStream?.close()

                        if (bitmap != null) {
                            val savedUrl = saveBitmap(bitmap)
                            if (savedUrl != null) {
                                urls.add(savedUrl)
                            }
                            bitmap.recycle()
                        }
                    }

                    val resultMap = Arguments.createMap().apply {
                        putArray("imageUrls", Arguments.createArray().apply {
                            urls.forEach { pushString(it) }
                        })
                        putInt("pageCount", urls.size)
                    }

                    promise.resolve(resultMap)
                } catch (e: Exception) {
                    promise.reject("SCANNER_FAILED", "Failed to process scanned documents: ${e.message}", e)
                }
            }
        }
    }

    companion object {
        const val NAME = NativeNeuroscanSpec.NAME
        private const val SCAN_REQUEST_CODE = 9001
    }
}
