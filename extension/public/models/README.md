# Model Files

This directory contains ONNX model files used by PhishShield.

## Required Files

### model_a.onnx (URL Model for Browser)
- **Purpose**: Local inference in the extension (Tier 1+2 features only)
- **Size**: ~200KB (expected)
- **Status**: ⚠️ NOT YET GENERATED
- **How to generate**: Train in `ml/notebooks/` and export using `skl2onnx` (see roadmap Week 0)
- **Source**: `ml/models/model_a.onnx` after training

### Training Status
- [ ] URL model (model_a.onnx) - Train and export from scikit-learn
- [x] Email model (backend only) - Already exists as `ml/models/email_rf_model.onnx`

## Installation

Once trained, copy the model file here:
```bash
cp ml/models/model_a.onnx extension/public/models/
```

The extension will automatically:
1. Load from `chrome-extension://...` at runtime (via `chrome.runtime.getURL()`)
2. Run ONNX inference locally without any network calls
3. Fail gracefully if the model is missing (returns neutral score of 0.5)
