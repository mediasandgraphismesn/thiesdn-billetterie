import type { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import zxingReaderWasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';
import type { ReadInputBarcodeFormat } from 'zxing-wasm/reader';
import { enhanceContrastForLowLight } from './qrContrastStretch';
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
let html5QrcodeModulePromise: Promise<typeof import('html5-qrcode')> | null = null;

function loadHtml5QrcodeModule(): Promise<typeof import('html5-qrcode')> {
  if (!html5QrcodeModulePromise) {
    html5QrcodeModulePromise = import('html5-qrcode').catch((err) => {
      html5QrcodeModulePromise = null;
      throw err;
    });
  }
  return html5QrcodeModulePromise;
}

/**
 * Précharge le module html5-qrcode en mémoire sans solliciter la caméra,
 * afin que le clic sur "Démarrer la caméra" reste dans la fenêtre d'activation iOS.
 */
export function preloadScannerEngine(): void {
  if (typeof window === 'undefined') return;
  void loadHtml5QrcodeModule().catch(() => {
    // Préchargement opportuniste silencieux
  });
}

function extractRawCameraErrorText(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err instanceof Error) {
    return `${err.name || ''} ${err.message || ''}`.trim();
  }
  if (err && typeof err === 'object') {
    const record = err as { name?: unknown; message?: unknown };
    return `${String(record.name ?? '')} ${String(record.message ?? '')}`.trim();
  }
  return '';
}

function isCameraPermissionOrContextError(err: unknown): boolean {
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return true;
  }
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return true;
  }
  const text = extractRawCameraErrorText(err).toLowerCase();
  return (
    text.includes('notallowederror') ||
    text.includes('permissiondenied') ||
    text.includes('permission denied') ||
    text.includes('permission dismissed') ||
    text.includes('securityerror') ||
    text.includes('secure context') ||
    text.includes('not supported') ||
    text.includes('denied by user') ||
    text.includes('denied')
  );
}

/**
 * Traduit les erreurs natives (DOMException) et chaînes rejetées par html5-qrcode
 * en message français clair et actionnable pour l'opérateur terrain.
 */
export function formatFriendlyCameraError(err: unknown): string {
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return "L'accès caméra nécessite une connexion sécurisée (HTTPS).";
  }
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return "Ce navigateur ne permet pas l'accès caméra en direct. Utilisez « Uploader une image de QR Code » ci-dessous.";
  }

  const text = extractRawCameraErrorText(err).toLowerCase();

  if (
    text.includes('notallowederror') ||
    text.includes('permissiondenied') ||
    text.includes('permission denied') ||
    text.includes('permission dismissed') ||
    text.includes('denied')
  ) {
    return "Accès caméra refusé. Autorisez l'appareil photo dans les réglages du navigateur (icône cadenas ou Réglages Safari), puis cliquez sur Réessayer ou importez une image.";
  }

  if (
    text.includes('notfounderror') ||
    text.includes('devicesnotfound') ||
    text.includes('requested device not found') ||
    text.includes('no camera')
  ) {
    return "Aucune caméra détectée sur cet appareil. Utilisez « Uploader une image de QR Code » ou la saisie manuelle.";
  }

  if (
    text.includes('notreadableerror') ||
    text.includes('trackstarterror') ||
    text.includes('could not start video source')
  ) {
    return "La caméra est déjà utilisée par une autre application ou momentanément bloquée. Fermez les autres applis caméra et réessayez.";
  }

  if (
    text.includes('overconstrainederror') ||
    text.includes('constraintnotsatisfied') ||
    text.includes('overconstrained')
  ) {
    return "Le capteur vidéo ne supporte pas les contraintes demandées. Cliquez sur Réessayer ou importez une image de QR Code.";
  }

  if (text.includes('securityerror') || text.includes('insecure') || text.includes('secure context')) {
    return "L'accès caméra est bloqué par la politique de sécurité du navigateur (HTTPS requis).";
  }

  return "Impossible d'activer l'appareil photo. Vérifiez les permissions caméra ou importez une image de QR Code ci-dessous.";
}

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
    try {
      video.pause();
    } catch {
      // Ignorer
    }
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

function clearScannerContainer(elementId: string): void {
  stopMediaTracksInsideElement(elementId);
  if (typeof document === 'undefined') return;
  const container = document.getElementById(elementId);
  if (container) {
    container.innerHTML = '';
  }
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

    clearScannerContainer(elementId);
  };

  activeScannerStopHandlers.add(stop);

  try {
    if (activeScannerStopHandlers.size > 1) {
      const otherStoppers = Array.from(activeScannerStopHandlers).filter((fn) => fn !== stop);
      await Promise.allSettled(otherStoppers.map((fn) => fn()));
    }

    // 1. Chargement paresseux (ou déjà préchargé) de html5-qrcode avant toute manipulation DOM
    const tModuleStart = performance.now();
    const { Html5Qrcode: Html5QrcodeClass, Html5QrcodeSupportedFormats: FormatsEnum } =
      await loadHtml5QrcodeModule();
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

    // Nettoyer le conteneur DOM avant injection vidéo (éviter flux ou nœuds résiduels)
    clearScannerContainer(elementId);

    const mappedFormats: Html5QrcodeSupportedFormats[] = formats
      .map((key) => FormatsEnum[key] as Html5QrcodeSupportedFormats)
      .filter((val) => typeof val === 'number');

    // Sur iOS ou appareils sans BarcodeDetector natif, abaisser le scan JS interne à ~fps/décimation
    // afin que le Web Worker (+ WASM ZXing) fasse le gros du travail hors thread principal.
    const html5ScanFps = preferWasm
      ? Math.max(5, Math.round(targetFps / fpsDecimation))
      : targetFps;

    const computeQrBox = (viewfinderWidth: number, viewfinderHeight: number) => {
      const safeMaxW = Math.max(60, viewfinderWidth - 16);
      const safeMaxH = Math.max(60, viewfinderHeight - 16);
      const desiredW = Math.max(
        qrboxRatio.minWidth ?? 160,
        Math.floor(viewfinderWidth * qrboxRatio.widthRatio)
      );
      const desiredH = Math.max(
        qrboxRatio.minHeight ?? 150,
        Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * qrboxRatio.heightRatio)
      );
      return {
        width: Math.min(safeMaxW, Math.max(60, desiredW)),
        height: Math.min(safeMaxH, Math.max(60, desiredH)),
      };
    };

    const createCleanScannerInstance = (): Html5Qrcode => {
      clearScannerContainer(elementId);
      return new Html5QrcodeClass(elementId, {
        formatsToSupport: mappedFormats.length > 0 ? mappedFormats : undefined,
        useBarCodeDetectorIfSupported: true,
        verbose: false,
      });
    };

    const resetAttemptInstance = async (instance: Html5Qrcode | null): Promise<void> => {
      if (instance) {
        try {
          if (instance.isScanning) {
            await instance.stop();
          }
          instance.clear();
        } catch {
          // Ignorer
        }
      }
      clearScannerContainer(elementId);
    };

    // 2. Ouverture immédiate du flux caméra (sans aspectRatio contraignant sur track.applyConstraints)
    html5Qr = createCleanScannerInstance();

    try {
      await html5Qr.start(
        { facingMode: 'environment' },
        {
          fps: html5ScanFps,
          qrbox: computeQrBox,
          videoConstraints: {
            facingMode: 'environment',
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 },
            frameRate: { ideal: targetFps, max: 24 },
          },
        },
        (decodedText) => {
          emitDecode(decodedText, 'html5-native');
        },
        () => {
          // Frames sans QR ignorées silencieusement
        }
      );
    } catch (firstErr) {
      if (stopped || isCameraPermissionOrContextError(firstErr)) {
        throw firstErr;
      }

      // Repli 1 : { facingMode: "environment" } pur sans videoConstraints ni aspectRatio
      await resetAttemptInstance(html5Qr);
      if (stopped) throw firstErr;
      html5Qr = createCleanScannerInstance();

      try {
        await html5Qr.start(
          { facingMode: 'environment' },
          {
            fps: html5ScanFps,
            qrbox: computeQrBox,
          },
          (decodedText) => {
            emitDecode(decodedText, 'html5-native');
          },
          () => {
            // Frames sans QR ignorées silencieusement
          }
        );
      } catch (secondErr) {
        if (stopped || isCameraPermissionOrContextError(secondErr)) {
          throw secondErr;
        }

        // Repli 2 : appareil sans caméra arrière (ex. webcam PC / iPad frontal)
        await resetAttemptInstance(html5Qr);
        if (stopped) throw secondErr;
        html5Qr = createCleanScannerInstance();

        let fallbackCameraTarget: string | MediaTrackConstraints = { facingMode: 'user' };
        try {
          const cameras = await Html5QrcodeClass.getCameras();
          if (cameras && cameras.length > 0) {
            const preferred =
              cameras.find((cam) => /back|rear|environment|arrière/i.test(cam.label || '')) ||
              cameras[0];
            fallbackCameraTarget = preferred.id;
          }
        } catch {
          fallbackCameraTarget = { facingMode: 'user' };
        }

        await html5Qr.start(
          fallbackCameraTarget,
          {
            fps: html5ScanFps,
            qrbox: computeQrBox,
          },
          (decodedText) => {
            emitDecode(decodedText, 'html5-native');
          },
          () => {
            // Frames sans QR ignorées silencieusement
          }
        );
      }
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

    // 3. Démarrage du Web Worker (jsQR basse lumière + ZXing WASM iOS) une fois le flux vidéo ouvert
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
      maxResolution: '640x480 / flux natif',
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
    const message = formatFriendlyCameraError(err);
    onError?.(message, err);
    throw new Error(message);
  }
}

const IMAGE_SCAN_ZXING_FORMATS: ReadInputBarcodeFormat[] = [
  'QRCode',
  'Code128',
  'Code39',
  'EAN-13',
  'EAN-8',
  'DataMatrix',
];

function loadImageFileElement(file: File): Promise<{ img: HTMLImageElement; cleanup: () => void }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, cleanup: () => URL.revokeObjectURL(objectUrl) });
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Impossible de charger ce fichier image."));
    };
    img.src = objectUrl;
  });
}

/**
 * Décode un QR Code ou Code-Barres à partir d'une image ou capture d'écran (secours si caméra HS).
 * 1) Arrête tout flux caméra actif (contrainte html5-qrcode)
 * 2) Tente Html5Qrcode.scanFile() dans un conteneur hors-écran isolé
 * 3) Bascule automatiquement sur Canvas + jsQR (contraste basse lumière) puis ZXing WASM
 */
export async function scanTicketImageFile(file: File): Promise<string> {
  if (!file || typeof document === 'undefined') {
    throw new Error('Fichier image invalide.');
  }

  if (activeScannerStopHandlers.size > 0) {
    await stopAllActiveScanners();
  }

  const { Html5Qrcode: Html5QrcodeClass, Html5QrcodeSupportedFormats: FormatsEnum } =
    await loadHtml5QrcodeModule();

  const tempId = `thiesdn-qr-file-scan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const tempContainer = document.createElement('div');
  tempContainer.id = tempId;
  tempContainer.style.position = 'fixed';
  tempContainer.style.left = '-9999px';
  tempContainer.style.top = '-9999px';
  tempContainer.style.width = '400px';
  tempContainer.style.height = '400px';
  tempContainer.style.pointerEvents = 'none';
  tempContainer.style.opacity = '0';
  document.body.appendChild(tempContainer);

  const formatsToSupport = (
    ['QR_CODE', 'CODE_128', 'CODE_39', 'EAN_13', 'EAN_8', 'DATA_MATRIX'] as ScannerFormatKey[]
  )
    .map((key) => FormatsEnum[key] as Html5QrcodeSupportedFormats)
    .filter((val) => typeof val === 'number');

  const fileScanner = new Html5QrcodeClass(tempId, {
    formatsToSupport: formatsToSupport.length > 0 ? formatsToSupport : undefined,
    useBarCodeDetectorIfSupported: true,
    verbose: false,
  });

  try {
    const decoded = await fileScanner.scanFile(file, false);
    if (decoded && decoded.trim()) {
      return decoded.trim();
    }
  } catch {
    // Repli automatique ci-dessous via jsQR + contraste basse lumière + ZXing WASM
  } finally {
    try {
      fileScanner.clear();
    } catch {
      // Ignorer
    }
    tempContainer.remove();
  }

  const { img, cleanup } = await loadImageFileElement(file);
  try {
    const maxDim = 1280;
    const rawW = img.naturalWidth || img.width;
    const rawH = img.naturalHeight || img.height;
    if (!rawW || !rawH) {
      throw new Error("Dimensions de l'image invalides.");
    }
    const scale = Math.min(1, maxDim / Math.max(rawW, rawH));
    const width = Math.max(1, Math.round(rawW * scale));
    const height = Math.max(1, Math.round(rawH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('Contexte graphique indisponible.');
    }

    ctx.drawImage(img, 0, 0, width, height);
    const imgData = ctx.getImageData(0, 0, width, height);

    const { default: jsQR } = await import('jsqr');
    const directMatch = jsQR(imgData.data, width, height, {
      inversionAttempts: 'attemptBoth',
    });
    if (directMatch?.data?.trim()) {
      return directMatch.data.trim();
    }

    const boosted = enhanceContrastForLowLight(imgData.data);
    const lowLightMatch = jsQR(boosted, width, height, {
      inversionAttempts: 'attemptBoth',
    });
    if (lowLightMatch?.data?.trim()) {
      return lowLightMatch.data.trim();
    }

    const zxing = await import('zxing-wasm/reader');
    zxing.prepareZXingModule({
      overrides: {
        locateFile: (path: string, prefix: string) =>
          path.endsWith('.wasm') ? zxingReaderWasmUrl : `${prefix}${path}`,
      },
    });

    const results = await zxing.readBarcodes(imgData, {
      formats: IMAGE_SCAN_ZXING_FORMATS,
      tryHarder: true,
      tryInvert: true,
      tryRotate: true,
      maxNumberOfSymbols: 1,
    });
    const first = results.find((r) => r.isValid && Boolean(r.text?.trim()));
    if (first?.text?.trim()) {
      return first.text.trim();
    }

    throw new Error(
      "Aucun QR Code ou code-barres lisible détecté sur cette image. Essayez une photo plus nette ou utilisez la saisie manuelle."
    );
  } finally {
    cleanup();
  }
}
