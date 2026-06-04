/**
 * ONNX Runtime wrapper for Model A (local inference)
 * Loads model_a.onnx from extension resources and runs inference
 */

import * as ort from 'onnxruntime-web'

let modelSession: ort.InferenceSession | null = null
let modelLoadPromise: Promise<void> | null = null

/**
 * Load Model A ONNX file asynchronously
 * Singleton pattern: loads once, subsequent calls wait for same promise
 */
export async function loadOnnxModel(): Promise<void> {
  // Return existing load promise if already in progress
  if (modelLoadPromise) return modelLoadPromise

  // Start new load
  modelLoadPromise = (async () => {
    try {
      // Model is bundled in extension/public/models/model_a.onnx
      // chrome-extension:// URL is accessible via web_accessible_resources in manifest
      const modelUrl = chrome.runtime.getURL('models/model_a.onnx')

      // Configure ONNX Runtime for web
      ort.env.wasm.wasmPaths = chrome.runtime.getURL('/')

      // Load and create inference session
      modelSession = await ort.InferenceSession.create(modelUrl, {
        executionProviders: ['wasm', 'cpu']
      })

      console.log('[PhishShield] ✓ Model A loaded successfully')
    } catch (error) {
      console.warn('[PhishShield] ⚠️  Model A not available:', error instanceof Error ? error.message : String(error))
      console.warn('[PhishShield] Extension will run in degraded mode (backend analysis only)')
      console.warn('[PhishShield] To fix: train model_a.onnx and place in extension/public/models/')
      modelLoadPromise = null // Reset so retry is possible
      // Don't throw — allow extension to work without local model
    }
  })()

  await modelLoadPromise
}

/**
 * Run inference on a 11-element feature vector
 * Returns phishing probability (0-1)
 */
export async function runInference(featureVector: number[]): Promise<number> {
  if (!modelSession) {
    throw new Error('Model not loaded. Call loadOnnxModel() first.')
  }

  if (featureVector.length !== 11) {
    throw new Error(`Expected 11 features, got ${featureVector.length}`)
  }

  try {
    // Create input tensor: [1, 11] shape (batch=1, features=11)
    const tensorInput = new ort.Tensor('float32', new Float32Array(featureVector), [
      1,
      11
    ])

    // Run inference
    const results = await modelSession.run({ float_input: tensorInput })

    // Extract probability from output
    // Model outputs: [probability of class 0 (legitimate), probability of class 1 (phishing)]
    // We want class 1 (phishing) probability
    const outputTensor = results['output']
    const outputData = outputTensor.data as Float32Array

    // Return phishing probability (class 1)
    // Assuming output is [batch_size, 2] where [i][1] is phishing probability
    return Math.min(Math.max(outputData[1], 0), 1) // Clamp to [0, 1]
  } catch (error) {
    console.error('[PhishShield] Inference error:', error)
    throw error
  }
}

/**
 * Check if model is loaded
 */
export function isModelLoaded(): boolean {
  return modelSession !== null
}

/**
 * Get model load status (for UI feedback)
 */
export function getModelStatus(): 'idle' | 'loading' | 'loaded' | 'error' {
  if (!modelLoadPromise) return 'idle'
  if (modelSession) return 'loaded'
  // If loading promise exists but no session, it's either loading or errored
  // We can't distinguish without tracking state more explicitly, so return 'loading'
  return 'loading'
}
