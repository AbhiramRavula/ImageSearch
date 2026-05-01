// ── TensorFlow.js MobileNet embedding engine ──
// Extracts 1024-dim feature vectors from images using MobileNet V2.
// Uses a singleton pattern with lazy initialization.

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-wasm';
import * as mobilenet from '@tensorflow-models/mobilenet';
import { MODEL_VERSION, MODEL_INPUT_SIZE } from '../constants';

/** The embedding engine interface — implement this to swap models */
export interface IEmbeddingEngine {
  initialize(): Promise<void>;
  getEmbedding(imageElement: HTMLImageElement): Promise<Float32Array>;
  isReady(): boolean;
  dispose(): void;
  getModelVersion(): string;
}

class MobileNetEmbeddingEngine implements IEmbeddingEngine {
  private model: mobilenet.MobileNet | null = null;
  private ready = false;
  private loading = false;
  private loadPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.ready) return;
    if (this.loadPromise) {
      await this.loadPromise;
      return;
    }

    this.loading = true;
    this.loadPromise = this._load();
    await this.loadPromise;
  }

  private async _load(): Promise<void> {
    try {
      // Set backend — prefer webgl, fall back to cpu
      await tf.ready();
      console.log(`[EmbeddingEngine] TF.js backend initially: ${tf.getBackend()}`);

      // Load MobileNet v2 with alpha=1.0
      this.model = await mobilenet.load({
        version: 2,
        alpha: 1.0,
      });

      // Warm up with a dummy tensor to avoid first-inference latency
      try {
        const warmupTensor = tf.zeros([1, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE, 3]);
        const warmupResult = this.model.infer(warmupTensor as tf.Tensor3D, true);
        warmupResult.dispose();
        warmupTensor.dispose();
      } catch (warmupErr) {
        console.warn('[EmbeddingEngine] WebGL warmup failed, falling back to WASM backend...', warmupErr);
        try {
          await tf.setBackend('wasm');
        } catch {
          console.warn('[EmbeddingEngine] WASM backend failed, falling back to CPU...');
          await tf.setBackend('cpu');
        }
        const warmupTensor = tf.zeros([1, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE, 3]);
        const warmupResult = this.model.infer(warmupTensor as tf.Tensor3D, true);
        warmupResult.dispose();
        warmupTensor.dispose();
      }

      this.ready = true;
      console.log(`[EmbeddingEngine] MobileNet V2 ready on ${tf.getBackend()} backend`);
    } catch (err) {
      console.error('[EmbeddingEngine] Failed to load model:', err);
      throw err;
    } finally {
      this.loading = false;
    }
  }

  async getEmbedding(imageElement: HTMLImageElement): Promise<Float32Array> {
    if (!this.model || !this.ready) {
      await this.initialize();
    }

    try {
      return this._infer(imageElement);
    } catch (err: any) {
      // If context is lost or shaders fail to link during search, fallback to WASM/CPU and retry
      if (tf.getBackend() === 'webgl' && (err.message?.includes('context') || err.message?.includes('shader') || err.message?.includes('WebGL'))) {
        console.warn('[EmbeddingEngine] WebGL context lost or failed during inference. Falling back.', err);
        try {
          await tf.setBackend('wasm');
        } catch {
          await tf.setBackend('cpu');
        }
        return this._infer(imageElement);
      }
      throw err;
    }
  }

  private _infer(imageElement: HTMLImageElement): Float32Array {
    return tf.tidy(() => {
      // MobileNet's infer() with embedding=true returns the penultimate layer (1024-dim)
      const embedding = this.model!.infer(imageElement, true) as tf.Tensor;

      // Flatten and L2-normalize for cosine similarity (dot product = cosine sim after normalization)
      const flattened = embedding.flatten();
      const norm = flattened.norm();
      const normalized = flattened.div(norm);

      return normalized.dataSync() as Float32Array;
    });
  }

  isReady(): boolean {
    return this.ready;
  }

  dispose(): void {
    this.model = null;
    this.ready = false;
    this.loadPromise = null;
  }

  getModelVersion(): string {
    return MODEL_VERSION;
  }
}

/** Singleton instance */
let engineInstance: MobileNetEmbeddingEngine | null = null;

export function getEmbeddingEngine(): IEmbeddingEngine {
  if (!engineInstance) {
    engineInstance = new MobileNetEmbeddingEngine();
  }
  return engineInstance;
}
