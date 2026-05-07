// ── TensorFlow.js MobileNet embedding engine ──
// Extracts 1024-dim feature vectors from images using MobileNet V2.
// Uses a singleton pattern with lazy initialization.
// Handles WebGL context loss gracefully with automatic recovery.

import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';
import { MODEL_VERSION, MODEL_INPUT_SIZE } from '../constants';

/** The embedding engine interface — implement this to swap models */
export interface IEmbeddingEngine {
  initialize(): Promise<void>;
  getEmbedding(imageElement: HTMLImageElement): Promise<Float32Array>;
  classifyImage(imageElement: HTMLImageElement, topK?: number): Promise<{ className: string; probability: number }[]>;
  isReady(): boolean;
  dispose(): void;
  getModelVersion(): string;
}

class MobileNetEmbeddingEngine implements IEmbeddingEngine {
  private model: mobilenet.MobileNet | null = null;
  private ready = false;
  private loading = false;
  private loadPromise: Promise<void> | null = null;
  private inferenceCount = 0;

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
      
      // Aggressively free WebGL textures to prevent "Failed to link vertex and fragment shaders"
      tf.env().set('WEBGL_DELETE_TEXTURE_THRESHOLD', 0);
      
      console.log(`[EmbeddingEngine] TF.js backend: ${tf.getBackend()}`);

      // Load MobileNet v2 with alpha=1.0
      this.model = await mobilenet.load({
        version: 2,
        alpha: 1.0,
      });

      // Warm up with a dummy tensor to avoid first-inference latency
      const warmupTensor = tf.zeros([1, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE, 3]);
      const warmupResult = this.model.infer(warmupTensor as tf.Tensor3D, true);
      warmupResult.dispose();
      warmupTensor.dispose();

      this.ready = true;
      this.inferenceCount = 0;
      console.log('[EmbeddingEngine] MobileNet V2 loaded and warmed up');
    } catch (err) {
      console.error('[EmbeddingEngine] Failed to load model:', err);
      throw err;
    } finally {
      this.loading = false;
    }
  }

  /**
   * Check if the WebGL context is still alive.
   * After CONTEXT_LOST_WEBGL, all GPU operations silently fail.
   */
  private isWebGLContextLost(): boolean {
    try {
      const backend = tf.getBackend();
      if (backend !== 'webgl') return false;

      // Try a trivial GPU operation — if context is lost, this will throw or return garbage
      const test = tf.scalar(1);
      const val = test.dataSync()[0];
      test.dispose();
      return val !== 1;
    } catch {
      return true;
    }
  }

  /**
   * Recover from WebGL context loss by switching to CPU backend
   * or reinitializing WebGL.
   */
  private async recoverFromContextLoss(): Promise<void> {
    console.warn('[EmbeddingEngine] WebGL context lost or exhausted — recovering...');

    // Try to properly dispose the old model if it exists to free any hanging GPU resources
    if (this.model) {
      try {
        // mobilenet.MobileNet doesn't expose a public dispose(), but it wraps a GraphModel
        const graphModel = (this.model as any).model;
        if (graphModel && typeof graphModel.dispose === 'function') {
          graphModel.dispose();
        }
      } catch {
        // Ignore dispose errors during panic
      }
    }

    // Dispose everything
    this.model = null;
    this.ready = false;
    this.loadPromise = null;
    this.inferenceCount = 0;

    try {
      // Clear all tensors in the TF engine
      tf.engine().disposeVariables();
      
      // Try to reinitialize WebGL
      await tf.setBackend('webgl');
      await tf.ready();
      console.log('[EmbeddingEngine] WebGL recovered');
    } catch {
      // Fall back to CPU — slower but never loses context
      console.warn('[EmbeddingEngine] WebGL recovery failed, falling back to CPU');
      await tf.setBackend('cpu');
      await tf.ready();
    }

    // Reload the model on the new backend
    await this._load();
  }

  /**
   * Periodically flush GPU memory to prevent context loss.
   * WebGL accumulates texture/buffer state internally.
   */
  private async maybeFlushGPU(): Promise<void> {
    this.inferenceCount++;

    // Every 20 inferences, force a memory cleanup
    if (this.inferenceCount % 20 === 0) {
      // tf.engine().endScope() / startScope() forces cleanup of tracked tensors
      // But we also need to yield to the browser to let WebGL GC run
      await tf.nextFrame();

      const memInfo = tf.memory();
      console.log(
        `[EmbeddingEngine] Memory check (after ${this.inferenceCount} inferences): ` +
        `${memInfo.numTensors} tensors, ${(memInfo.numBytes / 1024 / 1024).toFixed(1)}MB`
      );
    }
  }

  async getEmbedding(imageElement: HTMLImageElement): Promise<Float32Array> {
    if (!this.model || !this.ready) {
      await this.initialize();
    }

    // Check for context loss before inference
    if (this.isWebGLContextLost()) {
      await this.recoverFromContextLoss();
    }

    try {
      const result = tf.tidy(() => {
        // MobileNet's infer() with embedding=true returns the penultimate layer (1024-dim)
        const embedding = this.model!.infer(imageElement, true) as tf.Tensor;

        // Flatten and L2-normalize for cosine similarity (dot product = cosine sim after normalization)
        const flattened = embedding.flatten();
        const norm = flattened.norm();
        const normalized = flattened.div(norm);

        // Use dataSync to extract the data — this is synchronous but safe inside tidy()
        return normalized.dataSync() as Float32Array;
      });

      await this.maybeFlushGPU();
      return result;
    } catch (err) {
      const msg = ((err as Error).message || '').toLowerCase();
      // Detect WebGL/Shader errors in the exception message
      if (msg.includes('webgl') || msg.includes('context') || msg.includes('texture') || msg.includes('shader') || msg.includes('memory')) {
        console.warn('[EmbeddingEngine] WebGL error during embedding, recovering:', msg);
        await this.recoverFromContextLoss();
        // Retry once after recovery
        return tf.tidy(() => {
          const embedding = this.model!.infer(imageElement, true) as tf.Tensor;
          const flattened = embedding.flatten();
          const norm = flattened.norm();
          const normalized = flattened.div(norm);
          return normalized.dataSync() as Float32Array;
        });
      }
      throw err;
    }
  }

  async classifyImage(
    imageElement: HTMLImageElement,
    topK = 5
  ): Promise<{ className: string; probability: number }[]> {
    if (!this.model || !this.ready) {
      await this.initialize();
    }

    try {
      const predictions = await this.model!.classify(imageElement, topK);
      await this.maybeFlushGPU();
      return predictions.map((p) => ({
        className: p.className,
        probability: p.probability,
      }));
    } catch (err) {
      const msg = ((err as Error).message || '').toLowerCase();
      if (msg.includes('webgl') || msg.includes('context') || msg.includes('texture') || msg.includes('shader') || msg.includes('memory')) {
        console.warn('[EmbeddingEngine] WebGL error during classification, recovering:', msg);
        await this.recoverFromContextLoss();
        const predictions = await this.model!.classify(imageElement, topK);
        return predictions.map((p) => ({
          className: p.className,
          probability: p.probability,
        }));
      }
      throw err;
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  dispose(): void {
    this.model = null;
    this.ready = false;
    this.loadPromise = null;
    this.inferenceCount = 0;
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
