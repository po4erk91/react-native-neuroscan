import React, { useState, useCallback } from 'react';
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  SafeAreaView,
  Alert,
  Dimensions,
  Switch,
  ActivityIndicator,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { NeuroScan } from 'react-native-neuroscan';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Screen = 'home' | 'results' | 'editor';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [scannedUrls, setScannedUrls] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  // Editor state
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Filter state
  const [grayscale, setGrayscale] = useState(false);
  const [contrast, setContrast] = useState(0);
  const [brightness, setBrightness] = useState(0);
  const [sharpness, setSharpness] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [bwMode, setBwMode] = useState(false);
  const [threshold, setThreshold] = useState(128);

  const handleScan = useCallback(async () => {
    try {
      setIsScanning(true);
      const result = await NeuroScan.scanDocument({
        maxPages: 0,
        enableAutoCapture: true,
      });
      setScannedUrls(result.imageUrls);
      setScreen('results');
    } catch (error: any) {
      if (error?.code !== 'SCANNER_CANCELLED') {
        Alert.alert('Error', error?.message || 'Failed to scan document');
      }
    } finally {
      setIsScanning(false);
    }
  }, []);

  const handleCleanup = useCallback(async () => {
    try {
      await NeuroScan.cleanupTempFiles();
      setScannedUrls([]);
      setProcessedUrl(null);
      setScreen('home');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to cleanup');
    }
  }, []);

  const handleDone = useCallback(() => {
    setScannedUrls([]);
    setProcessedUrl(null);
    setScreen('home');
  }, []);

  const openEditor = useCallback((index: number) => {
    setSelectedIndex(index);
    setProcessedUrl(null);
    // Reset filters
    setGrayscale(false);
    setContrast(0);
    setBrightness(0);
    setSharpness(0);
    setRotation(0);
    setBwMode(false);
    setThreshold(128);
    setScreen('editor');
  }, []);

  const handleApplyFilters = useCallback(async () => {
    if (!scannedUrls[selectedIndex]) return;
    try {
      setIsProcessing(true);
      const result = await NeuroScan.processImage({
        imageUrl: scannedUrls[selectedIndex]!,
        grayscale: !bwMode ? grayscale : false,
        contrast,
        brightness,
        sharpness,
        rotation,
        threshold: bwMode ? threshold : 0,
      });
      setProcessedUrl(result.imageUrl);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to process image');
    } finally {
      setIsProcessing(false);
    }
  }, [scannedUrls, selectedIndex, grayscale, contrast, brightness, sharpness, rotation, bwMode, threshold]);

  const handleResetFilters = useCallback(() => {
    setGrayscale(false);
    setContrast(0);
    setBrightness(0);
    setSharpness(0);
    setRotation(0);
    setBwMode(false);
    setThreshold(128);
    setProcessedUrl(null);
  }, []);

  const handleRotate = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  // ====== EDITOR SCREEN ======
  if (screen === 'editor') {
    const displayUrl = processedUrl || scannedUrls[selectedIndex];
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setScreen('results')}>
            <Text style={styles.backButton}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Edit Page {selectedIndex + 1}</Text>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.editorContent}>
          {/* Preview */}
          <View style={styles.previewContainer}>
            {displayUrl && (
              <Image
                source={{ uri: displayUrl }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            )}
            {isProcessing && (
              <View style={styles.processingOverlay}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.processingText}>Processing...</Text>
              </View>
            )}
          </View>

          {/* Filter Controls */}
          <View style={styles.controlsSection}>
            {/* Rotation */}
            <View style={styles.controlRow}>
              <Text style={styles.controlLabel}>Rotation: {rotation}</Text>
              <TouchableOpacity style={styles.rotateButton} onPress={handleRotate}>
                <Text style={styles.rotateButtonText}>Rotate 90</Text>
              </TouchableOpacity>
            </View>

            {/* Brightness */}
            <View style={styles.sliderRow}>
              <Text style={styles.controlLabel}>Brightness: {brightness.toFixed(0)}</Text>
              <Slider
                style={styles.slider}
                minimumValue={-100}
                maximumValue={100}
                step={1}
                value={brightness}
                onValueChange={setBrightness}
                minimumTrackTintColor="#007AFF"
                maximumTrackTintColor="#ccc"
              />
            </View>

            {/* Contrast */}
            <View style={styles.sliderRow}>
              <Text style={styles.controlLabel}>Contrast: {contrast.toFixed(0)}</Text>
              <Slider
                style={styles.slider}
                minimumValue={-100}
                maximumValue={100}
                step={1}
                value={contrast}
                onValueChange={setContrast}
                minimumTrackTintColor="#007AFF"
                maximumTrackTintColor="#ccc"
              />
            </View>

            {/* Sharpness */}
            <View style={styles.sliderRow}>
              <Text style={styles.controlLabel}>Sharpness: {sharpness.toFixed(0)}</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={100}
                step={1}
                value={sharpness}
                onValueChange={setSharpness}
                minimumTrackTintColor="#007AFF"
                maximumTrackTintColor="#ccc"
              />
            </View>

            {/* Grayscale toggle */}
            <View style={styles.switchRow}>
              <Text style={styles.controlLabel}>Grayscale</Text>
              <Switch
                value={grayscale}
                onValueChange={(val) => {
                  setGrayscale(val);
                  if (val) setBwMode(false);
                }}
                disabled={bwMode}
              />
            </View>

            {/* B&W Document Mode toggle */}
            <View style={styles.switchRow}>
              <Text style={styles.controlLabel}>B&W Document</Text>
              <Switch
                value={bwMode}
                onValueChange={(val) => {
                  setBwMode(val);
                  if (val) setGrayscale(false);
                }}
              />
            </View>

            {/* Threshold slider (visible when B&W is on) */}
            {bwMode && (
              <View style={styles.sliderRow}>
                <Text style={styles.controlLabel}>Threshold: {threshold}</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={255}
                  step={1}
                  value={threshold}
                  onValueChange={setThreshold}
                  minimumTrackTintColor="#007AFF"
                  maximumTrackTintColor="#ccc"
                />
              </View>
            )}
          </View>
        </ScrollView>

        {/* Bottom buttons */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.scanButton, isProcessing && styles.disabledButton]}
            onPress={handleApplyFilters}
            disabled={isProcessing}
          >
            <Text style={styles.scanButtonText}>Apply</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleResetFilters}>
            <Text style={styles.secondaryButtonText}>Reset</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ====== RESULTS SCREEN ======
  if (screen === 'results') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>
            Scanned Pages ({scannedUrls.length})
          </Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {scannedUrls.map((url, index) => (
            <TouchableOpacity
              key={url}
              style={styles.pageCard}
              onPress={() => openEditor(index)}
              activeOpacity={0.8}
            >
              <View style={styles.pageLabelRow}>
                <Text style={styles.pageLabel}>Page {index + 1}</Text>
                <Text style={styles.editHint}>Tap to edit</Text>
              </View>
              <Image
                source={{ uri: url }}
                style={styles.pageImage}
                resizeMode="contain"
              />
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.scanButton} onPress={handleScan}>
            <Text style={styles.scanButtonText}>Scan More</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleCleanup}>
            <Text style={styles.secondaryButtonText}>Cleanup & Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleDone}>
            <Text style={styles.secondaryButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ====== HOME SCREEN ======
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.homeContent}>
        <Text style={styles.appTitle}>NeuroScan</Text>
        <Text style={styles.subtitle}>Native Document Scanner</Text>

        <TouchableOpacity
          style={[styles.scanButton, styles.bigScanButton, isScanning && styles.disabledButton]}
          onPress={handleScan}
          disabled={isScanning}
        >
          <Text style={styles.scanButtonText}>
            {isScanning ? 'Opening Scanner...' : 'Scan Document'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  homeContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  appTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  backButton: {
    fontSize: 17,
    color: '#007AFF',
    fontWeight: '500',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  editorContent: {
    padding: 16,
    paddingBottom: 32,
  },
  pageCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pageLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  pageLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  editHint: {
    fontSize: 13,
    color: '#007AFF',
  },
  pageImage: {
    width: SCREEN_WIDTH - 32,
    height: (SCREEN_WIDTH - 32) * 1.4,
    backgroundColor: '#f0f0f0',
  },
  // Editor styles
  previewContainer: {
    position: 'relative',
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  previewImage: {
    width: SCREEN_WIDTH - 32,
    height: (SCREEN_WIDTH - 32) * 1.2,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 10,
  },
  controlsSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sliderRow: {
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  controlLabel: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  slider: {
    width: '100%',
    height: 40,
    marginTop: 4,
  },
  rotateButton: {
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  rotateButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  // Bottom bar
  bottomBar: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  scanButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  bigScanButton: {
    paddingVertical: 18,
    paddingHorizontal: 60,
    flex: 0,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#333',
    fontSize: 15,
    fontWeight: '500',
  },
  disabledButton: {
    opacity: 0.5,
  },
});
