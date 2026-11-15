import type { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import zxingReaderWasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';
import type { WorkerDecodeRequest, WorkerDecodeResponse } from '../workers/qrScannerWorker';

export type ScannerFormatKey =
  | 'QR_CODE'
  | 'CODE_128'
  | 'CODE_39'
  | 'EAN_13'
  | 'EAN_8'
  | 'DATA_MATRIX';

export type DecodeSource = 'html5-native' | 'worker-jsqr' | 'worker-jsqr-lowlight' | 'worker-wasm';

export interface ScannerMetrics {
  moduleLoadMs: number;
  workerBootMs: number;
  cameraStartMs: number;
  fps: number;
  fpsDecimation: number;
  maxResolution: string;
  torchSupported: boolean;
  wasmFallbackActive: boolean;
  engineLabel: string;
}

export interface OptimizedScannerOptions {
  elementId: string;
  formats?: ScannerFormatKey[];
  /** FPS cible limité entre 15 et 24 FPS pour préserver le CPU/batterie */
  fps?: number;
  /** Décimation des frames : 1 frame décodée sur N frames vidéo (défaut: 3) */
  fpsDecimation?: number;
  aspectRatio?: number;
  debounceMs?: number;
  qrboxRatio?: {
    widthRatio: number;
    heightRatio: number;
    minWidth?: number;
    minHeight?: number;
  };
  onDecode: (decodedText: string, source: DecodeSource) => void;
  onError?: (friendlyMessage: string, rawError?: unknown) => void;
  onReady?: (metrics: ScannerMetrics) => void;
}

export interface OptimizedScannerHandle {
  stop: () => Promise<void>;
  setTorch: (enabled: boolean) => Promise<boolean>;
  isTorchSupported: () => boolean;
  getMetrics: () => ScannerMetrics | null;
}

const activeScannerStopHandlers = new Set<() => Promise<void>>();
let lifecycleListenersRegistered = false;

/**
 * Arrête toutes les instances caméra actives (changement de page, mise en arrière-plan ou fermeture).
 */
export async function stopAllActiveScanners(): Promise<void> {
  const stoppers = Array.from(activeScannerStopHandlers);
  await Promise.allSettled(stoppers.map((fn) => fn()));
}

function registerGlobalLifecycleGuards(): void {
  if (lifecycleListenersRegistered || typeof window === 'undefined') return;
  lifecycleListenersRegistered = true;

  const stopAll = () => {
    void stopAllActiveScanners();
  };

  window.addEventListener('pagehide', stopAll);
  window.addEventListener('beforeunload', stopAll);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      void stopAllActiveScanners();
    }
  });
}

function detectIosOrMissingNativeDetector(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIosDevice =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const hasNativeBarcodeDetector = 'BarcodeDetector' in window;
  return isIosDevice || !hasNativeBarcodeDetector;
}

function stopMediaTracksInsideElement(elementId: string): void {
  if (typeof document === 'undefined') return;
  const container = document.getElementById(elementId);
  if (!container) return;
  const videos = container.querySelectorAll('video');
  videos.forEach((video) => {
    const stream = video.srcObject as MediaStream | null;
    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignorer
        }
      });
      video.srcObject = null;
    }
  });
}

/**
 * Démarre un scanner optimisé :
 * 1. Import dynamique de `html5-qrcode` uniquement à la demande
 * 2. Résolution contrainte 640x480 idéale / 720p max + 15-24 FPS max
 * 3. Décimation (`fpsDecimation = 3`) vers Web Worker (`jsQR` + contraste basse lumière + `zxing-wasm` iOS)
 * 4. Contrôle de la torche et nettoyage strict de toutes les pistes vidéo
 */
export async function startOptimizedScanner(
  options: OptimizedScannerOptions
): Promise<OptimizedScannerHandle> {
  registerGlobalLifecycleGuards();

  const {
    elementId,
    formats = ['QR_CODE', 'CODE_128', 'CODE_39', 'EAN_13', 'EAN_8', 'DATA_MATRIX'],
    fps: rawFps = 18,
    fpsDecimation: rawDecimation = 3,
    aspectRatio = 1.0,
    debounceMs = 2500,
    qrboxRatio = { widthRatio: 0.78, heightRatio: 0.72, minWidth: 160, minHeight: 150 },
    onDecode,
    onError,
    onReady,
  } = options;

  const targetFps = Math.min(24, Math.max(15, Math.round(rawFps)));
  const fpsDecimation = Math.max(1, Math.round(rawDecimation));
  const preferWasm = detectIosOrMissingNativeDetector();

  const tTotalStart = performance.now();
  let stopped = false;
  let html5Qr: Html5Qrcode | null = null;
  let worker: Worker | null = null;
  let rafId: number | null = null;
  let workerBootMs = 0;
  let currentMetrics: ScannerMetrics | null = null;
  let torchSupported = false;
  let torchActive = false;

  const lastDecoded = { text: '', timestamp: 0 };

  const emitDecode = (rawText: string, source: DecodeSource) => {
    if (stopped) return;
    const trimmed = rawText.trim();
    if (!trimmed) return;
    const now = Date.now();
    if (lastDecoded.text === trimmed && now - lastDecoded.timestamp < debounceMs) {
      return;
    }
    lastDecoded.text = trimmed;
    lastDecoded.timestamp = now;
    onDecode(trimmed, source);
  };

  const stop = async (): Promise<void> => {
    if (stopped) return;
    stopped = true;
    activeScannerStopHandlers.delete(stop);

    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    if (worker) {
      try {
        worker.terminate();
      } catch {
        // Ignorer
      }
      worker = null;
    }

    if (html5Qr) {
      if (torchActive) {
        try {
          const torch = html5Qr.getRunningTrackCameraCapabilities().torchFeature();
          if (torch.isSupported()) {
            await torch.apply(false);
          }
        } catch {
          // Ignorer
        }
        torchActive = false;
      }

      try {
        if (html5Qr.isScanning) {
          await html5Qr.stop();
        }
        html5Qr.clear();
      } catch {
        // Ignorer les erreurs si le nœud DOM a été démonté entre temps
      }
      html5Qr = null;
    }

    stopMediaTracksInsideElement(elementId);
  };

  activeScannerStopHandlers.add(stop);

  try {
    // 1. Chargement paresseux du moteur caméra html5-qrcode
    const tModuleStart = performance.now();
    const { Html5Qrcode: Html5QrcodeClass, Html5QrcodeSupportedFormats: FormatsEnum } = await import(
      'html5-qrcode'
    );
    const moduleLoadMs = Math.max(1, Math.round(performance.now() - tModuleStart));

    if (stopped) {
      return {
        stop,
        setTorch: async () => false,
        isTorchSupported: () => false,
        getMetrics: () => null,
      };
    }

    const domElement = document.getElementById(elementId);
    if (!domElement) {
      throw new Error(`Conteneur scanner introuvable (#${elementId}).`);
    }

    const mappedFormats: Html5QrcodeSupportedFormats[] = formats
      .map((key) => FormatsEnum[key] as Html5QrcodeSupportedFormats)
      .filter((val) => typeof val === 'number');

    // 2. Initialisation du Web Worker en parallèle du démarrage caméra
    if (typeof Worker !== 'undefined') {
      try {
        worker = new Worker(new URL('../workers/qrScannerWorker.ts', import.meta.url), {
          type: 'module',
        });

        let requestSeq = 0;
        let workerBusy = false;
        let workerCallCount = 0;

        worker.onmessage = (msgEvent: MessageEvent<WorkerDecodeResponse>) => {
          const msg = msgEvent.data;
          if (msg.type === 'ready') {
            workerBootMs = msg.workerBootMs;
            return;
          }
          if (msg.type === 'result') {
            workerBusy = false;
            if (msg.text && msg.engine) {
              emitDecode(msg.text, msg.engine);
            }
          }
        };

        worker.onerror = () => {
          workerBusy = false;
        };

        const initMsg: WorkerDecodeRequest = {
          type: 'init',
          wasmUrl: zxingReaderWasmUrl,
          preferWasm,
        };
        worker.postMessage(initMsg);

        // Boucle rAF décimée (fpsDecimation = 3 => 1 frame sur 3 envoyée au Worker)
        const offscreenCanvas = document.createElement('canvas');
        const offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
        let frameCounter = 0;

        const scheduleWorkerScan = () => {
          if (stopped || !worker || !offscreenCtx) return;

          frameCounter += 1;
          if (frameCounter % fpsDecimation === 0 && !workerBusy) {
            const video = domElement.querySelector('video');
            if (
              video &&
              video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
              video.videoWidth > 0 &&
              video.videoHeight > 0
            ) {
              // Borner le traitement Canvas à 640x480 maximum pour la vitesse
              const scale = Math.min(1, 640 / video.videoWidth, 480 / video.videoHeight);
              const w = Math.max(160, Math.round(video.videoWidth * scale));
              const h = Math.max(120, Math.round(video.videoHeight * scale));

              if (offscreenCanvas.width !== w || offscreenCanvas.height !== h) {
                offscreenCanvas.width = w;
                offscreenCanvas.height = h;
              }

              offscreenCtx.drawImage(video, 0, 0, w, h);
              const imgData = offscreenCtx.getImageData(0, 0, w, h);
              requestSeq += 1;
              workerCallCount += 1;
              workerBusy = true;

              const decodeMsg: WorkerDecodeRequest = {
                type: 'decode',
                id: requestSeq,
                width: w,
                height: h,
                buffer: imgData.data.buffer,
                preferWasm,
                enhanceLowLight: workerCallCount % 2 === 0,
                tryBarcodes: preferWasm || workerCallCount % 3 === 0,
                wasmUrl: zxingReaderWasmUrl,
              };
              worker.postMessage(decodeMsg, [imgData.data.buffer]);
            }
          }

          if (!stopped) {
            rafId = requestAnimationFrame(scheduleWorkerScan);
          }
        };

        rafId = requestAnimationFrame(scheduleWorkerScan);
      } catch {
        // Fallback : Html5Qrcode reste pleinement opérationnel si Worker bloqué
      }
    }

    // 3. Ouverture du flux vidéo avec résolution bridée (640x480 idéal / 720p max) et FPS limité
    html5Qr = new Html5QrcodeClass(elementId, {
      formatsToSupport: mappedFormats.length > 0 ? mappedFormats : undefined,
      useBarCodeDetectorIfSupported: true,
      verbose: false,
    });

    const videoConstraints: MediaTrackConstraints = {
      facingMode: 'environment',
      width: { ideal: 640, max: 1280 },
      height: { ideal: 480, max: 720 },
      frameRate: { ideal: targetFps, max: 24 },
    };

    // Sur iOS ou appareils sans BarcodeDetector natif, abaisser le scan JS interne à ~fps/décimation
    // afin que le Web Worker (+ WASM ZXing) fasse le gros du travail hors thread principal.
    const html5ScanFps = preferWasm
      ? Math.max(5, Math.round(targetFps / fpsDecimation))
      : targetFps;

    const scanConfig = {
      fps: html5ScanFps,
      videoConstraints,
      aspectRatio,
      qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
        const boxW = Math.max(
          qrboxRatio.minWidth ?? 160,
          Math.floor(viewfinderWidth * qrboxRatio.widthRatio)
        );
        const boxH = Math.max(
          qrboxRatio.minHeight ?? 150,
          Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * qrboxRatio.heightRatio)
        );
        return { width: boxW, height: boxH };
      },
    };

    try {
      await html5Qr.start(
        { facingMode: 'environment' },
        scanConfig,
        (decodedText) => {
          emitDecode(decodedText, 'html5-native');
        },
        () => {
          // Frames sans QR ignorées silencieusement
        }
      );
    } catch (startErr) {
      // Secours pour capteurs Android anciens rejetant max/frameRate stricts
      const fallbackConstraints: MediaTrackConstraints = {
        facingMode: 'environment',
        width: { ideal: 640 },
        height: { ideal: 480 },
      };
      if (stopped) throw startErr;
      await html5Qr.start(
        { facingMode: 'environment' },
        {
          ...scanConfig,
          videoConstraints: fallbackConstraints,
        },
        (decodedText) => {
          emitDecode(decodedText, 'html5-native');
        },
        () => {
          // Frames sans QR ignorées silencieusement
        }
      );
    }

    if (stopped) {
      await stop();
      return {
        stop,
        setTorch: async () => false,
        isTorchSupported: () => false,
        getMetrics: () => null,
      };
    }

    try {
      const torch = html5Qr.getRunningTrackCameraCapabilities().torchFeature();
      torchSupported = torch.isSupported();
    } catch {
      torchSupported = false;
    }

    const cameraStartMs = Math.max(1, Math.round(performance.now() - tTotalStart));
    currentMetrics = {
      moduleLoadMs,
      workerBootMs,
      cameraStartMs,
      fps: targetFps,
      fpsDecimation,
      maxResolution: '640x480 / max 720p',
      torchSupported,
      wasmFallbackActive: preferWasm,
      engineLabel: preferWasm
        ? 'Worker jsQR + ZXing WASM (iOS)'
        : 'BarcodeDetector + Worker jsQR',
    };

    onReady?.(currentMetrics);

    return {
      stop,
      isTorchSupported: () => torchSupported,
      getMetrics: () => currentMetrics,
      setTorch: async (enabled: boolean): Promise<boolean> => {
        if (!html5Qr || stopped) return false;
        try {
          const torch = html5Qr.getRunningTrackCameraCapabilities().torchFeature();
          if (!torch.isSupported()) return false;
          await torch.apply(enabled);
          torchActive = enabled;
          return true;
        } catch {
          try {
            await html5Qr.applyVideoConstraints({
              advanced: [{ torch: enabled } as MediaTrackConstraintSet],
            });
            torchActive = enabled;
            return true;
          } catch {
            return false;
          }
        }
      },
    };
  } catch (err: unknown) {
    await stop();
    const message =
      err instanceof Error && err.message
        ? err.message
        : "Impossible d'activer l'appareil photo. Vérifiez les permissions de votre navigateur.";
    onError?.(message, err);
    throw err;
  }
}
