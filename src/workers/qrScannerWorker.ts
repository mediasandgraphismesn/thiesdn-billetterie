import jsQR from 'jsqr';
import type { ReadInputBarcodeFormat } from 'zxing-wasm/reader';
import { enhanceContrastForLowLight } from '../utils/qrContrastStretch';

export type WorkerDecodeRequest =
  | {
      type: 'init';
      wasmUrl?: string;
      preferWasm?: boolean;
    }
  | {
      type: 'decode';
      id: number;
      width: number;
      height: number;
      buffer: ArrayBuffer;
      preferWasm: boolean;
      enhanceLowLight: boolean;
      tryBarcodes: boolean;
      wasmUrl?: string;
    };

export type WorkerDecodeResponse =
  | {
      type: 'ready';
      workerBootMs: number;
    }
  | {
      type: 'result';
      id: number;
      text: string | null;
      format?: string;
      engine?: 'worker-jsqr' | 'worker-jsqr-lowlight' | 'worker-wasm';
      decodeMs: number;
    };

const bootStart = performance.now();

let zxingModuleReady = false;
let zxingModulePromise: Promise<typeof import('zxing-wasm/reader')> | null = null;
let configuredWasmUrl: string | undefined;

const ZXING_FORMATS: ReadInputBarcodeFormat[] = [
  'QRCode',
  'Code128',
  'Code39',
  'EAN-13',
  'EAN-8',
  'DataMatrix',
];

async function getZXingReader(wasmUrl?: string): Promise<typeof import('zxing-wasm/reader')> {
  if (wasmUrl) {
    configuredWasmUrl = wasmUrl;
  }
  if (!zxingModulePromise) {
    zxingModulePromise = import('zxing-wasm/reader').then(async (mod) => {
      if (configuredWasmUrl) {
        mod.prepareZXingModule({
          overrides: {
            locateFile: (path: string, prefix: string) =>
              path.endsWith('.wasm') ? configuredWasmUrl as string : `${prefix}${path}`,
          },
        });
      }
      zxingModuleReady = true;
      return mod;
    });
  }
  return zxingModulePromise;
}

self.onmessage = async (event: MessageEvent<WorkerDecodeRequest>) => {
  const payload = event.data;

  if (payload.type === 'init') {
    if (payload.wasmUrl) {
      configuredWasmUrl = payload.wasmUrl;
    }
    if (payload.preferWasm && !zxingModuleReady) {
      void getZXingReader(payload.wasmUrl).catch(() => {
        // Fallback silencieux si le préchargement WASM échoue hors-ligne non caché
      });
    }
    const response: WorkerDecodeResponse = {
      type: 'ready',
      workerBootMs: Math.max(1, Math.round(performance.now() - bootStart)),
    };
    self.postMessage(response);
    return;
  }

  if (payload.type !== 'decode') return;

  const t0 = performance.now();
  const rgba = new Uint8ClampedArray(payload.buffer);

  // 1. Passe ultra-rapide jsQR standard
  const directMatch = jsQR(rgba, payload.width, payload.height, {
    inversionAttempts: 'attemptBoth',
  });
  if (directMatch?.data) {
    const res: WorkerDecodeResponse = {
      type: 'result',
      id: payload.id,
      text: directMatch.data,
      format: 'QR_CODE',
      engine: 'worker-jsqr',
      decodeMs: Math.round(performance.now() - t0),
    };
    self.postMessage(res);
    return;
  }

  // 2. Passe basse luminosité par étirement de contraste si demandée
  if (payload.enhanceLowLight) {
    const boosted = enhanceContrastForLowLight(rgba);
    const lowLightMatch = jsQR(boosted, payload.width, payload.height, {
      inversionAttempts: 'attemptBoth',
    });
    if (lowLightMatch?.data) {
      const res: WorkerDecodeResponse = {
        type: 'result',
        id: payload.id,
        text: lowLightMatch.data,
        format: 'QR_CODE',
        engine: 'worker-jsqr-lowlight',
        decodeMs: Math.round(performance.now() - t0),
      };
      self.postMessage(res);
      return;
    }
  }

  // 3. Fallback WebAssembly ZXing-C++ (iOS sans BarcodeDetector ou codes-barres 1D Code128/EAN13/Code39)
  if (payload.preferWasm || payload.tryBarcodes) {
    try {
      const zxing = await getZXingReader(payload.wasmUrl);
      const imageData = new ImageData(rgba, payload.width, payload.height);
      const results = await zxing.readBarcodes(imageData, {
        formats: ZXING_FORMATS,
        tryHarder: true,
        tryInvert: true,
        tryRotate: true,
        maxNumberOfSymbols: 1,
      });

      const first = results.find((r) => r.isValid && Boolean(r.text));
      if (first?.text) {
        const res: WorkerDecodeResponse = {
          type: 'result',
          id: payload.id,
          text: first.text,
          format: first.format,
          engine: 'worker-wasm',
          decodeMs: Math.round(performance.now() - t0),
        };
        self.postMessage(res);
        return;
      }
    } catch {
      // Ignorer si WASM non disponible et laisser la boucle continuer sans erreur bloquante
    }
  }

  const emptyRes: WorkerDecodeResponse = {
    type: 'result',
    id: payload.id,
    text: null,
    decodeMs: Math.round(performance.now() - t0),
  };
  self.postMessage(emptyRes);
};
