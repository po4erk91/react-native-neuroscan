#import "Neuroscan.h"

#ifdef __cplusplus
#import <react/renderer/core/EventEmitter.h>
#endif

#import <VisionKit/VisionKit.h>

// Import Swift-generated header
#if __has_include("react_native_neuroscan/react_native_neuroscan-Swift.h")
#import "react_native_neuroscan/react_native_neuroscan-Swift.h"
#elif __has_include("react-native-neuroscan/react-native-neuroscan-Swift.h")
#import "react-native-neuroscan/react-native-neuroscan-Swift.h"
#else
#import "Neuroscan-Swift.h"
#endif

@implementation Neuroscan {
    NeuroScanImpl *_impl;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _impl = [[NeuroScanImpl alloc] init];
    }
    return self;
}

+ (NSString *)moduleName {
    return @"Neuroscan";
}

// MARK: - scanDocument

- (void)scanDocument:(JS::NativeNeuroscan::SpecScanDocumentOptions &)options
             resolve:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject {
    NSInteger maxPages = options.maxPages().has_value() ? options.maxPages().value() : 0;
    BOOL enableAutoCapture = options.enableAutoCapture().has_value() ? options.enableAutoCapture().value() : YES;

    [_impl scanDocumentWithMaxPages:maxPages
                  enableAutoCapture:enableAutoCapture
                           resolver:^(NSDictionary *result) {
        resolve(result);
    } rejecter:^(NSString *code, NSString *message, NSError *error) {
        reject(code, message, error);
    }];
}

// MARK: - processImage

- (void)processImage:(JS::NativeNeuroscan::SpecProcessImageOptions &)options
             resolve:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject {
    NSString *imageUrl = options.imageUrl();
    BOOL grayscale = options.grayscale().has_value() ? options.grayscale().value() : NO;
    double contrast = options.contrast().has_value() ? options.contrast().value() : 0;
    double brightness = options.brightness().has_value() ? options.brightness().value() : 0;
    double sharpness = options.sharpness().has_value() ? options.sharpness().value() : 0;
    double rotation = options.rotation().has_value() ? options.rotation().value() : 0;
    double cropX = options.cropX().has_value() ? options.cropX().value() : -1;
    double cropY = options.cropY().has_value() ? options.cropY().value() : -1;
    double cropWidth = options.cropWidth().has_value() ? options.cropWidth().value() : -1;
    double cropHeight = options.cropHeight().has_value() ? options.cropHeight().value() : -1;
    double threshold = options.threshold().has_value() ? options.threshold().value() : 0;
    NSString *outputFormat = options.outputFormat() ?: @"jpeg";
    double quality = options.quality().has_value() ? options.quality().value() : 90;

    [_impl processImageWithImageUrl:imageUrl
                          grayscale:grayscale
                           contrast:contrast
                         brightness:brightness
                          sharpness:sharpness
                           rotation:rotation
                              cropX:cropX
                              cropY:cropY
                          cropWidth:cropWidth
                         cropHeight:cropHeight
                          threshold:threshold
                       outputFormat:outputFormat
                            quality:quality
                           resolver:^(NSDictionary *result) {
        resolve(result);
    } rejecter:^(NSString *code, NSString *message, NSError *error) {
        reject(code, message, error);
    }];
}

// MARK: - cleanupTempFiles

- (void)cleanupTempFiles:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject {
    [_impl cleanupTempFilesWithResolver:^(NSNumber *result) {
        resolve(result);
    } rejecter:^(NSString *code, NSString *message, NSError *error) {
        reject(code, message, error);
    }];
}

// MARK: - Event Emitter

- (void)addListener:(NSString *)eventType {
    // Required for RN event emitter
}

- (void)removeListeners:(double)count {
    // Required for RN event emitter
}

// MARK: - TurboModule

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
    return std::make_shared<facebook::react::NativeNeuroscanSpecJSI>(params);
}

@end
