# Non‑LLM ML Enhancements for Anti‑Distraction (Trainable on Gaming GPUs)

This document proposes classical/compact ML models that complement LLM agents. They focus on on‑device or locally trainable approaches that are practical to train on a single consumer GPU (e.g., RTX 3060–4090) and run efficiently in a browser extension context (background SW or WASM/JS).

## Objectives

- Improve precision/recall of distraction detection without sending content to remote services.
- Personalize blocking with light, privacy‑preserving models.
- Keep inference fast (<10 ms typical) and memory‑light; model sizes in KB–MB.

## Candidate models and use cases

- URL/Title classifier (shallow)
  - Model: Logistic Regression or Linear SVM over TF‑IDF of URL path segments + title n‑grams.
  - Training: scikit‑learn or LibLinear; minutes on CPU/GPU; incremental online updates.
  - Use: First‑pass “distract vs work vs neutral” prior to LLM; low‑latency gate.

- Host‑profile embedding + kNN
  - Model: Sentence‑BERT or MiniLM to embed titles; approximate kNN (FAISS) per user dataset.
  - Training: None or light fine‑tuning; index built locally; fits in RAM.
  - Use: Personal similarity to past allowed/blocked items; boosts policy confidence.

- Time‑of‑day/week rhythm model
  - Model: Gradient Boosted Trees (XGBoost/LightGBM) on features: day, hour, prior outcomes, session length.
  - Training: Small tabular dataset; seconds on CPU/GPU.
  - Use: Predict “risk of distraction now” to adjust strictness and cooldowns.

- Session intent predictor
  - Model: Compact Transformer or LSTM on recent action sequence (tab switches, host sequence, time gaps).
  - Training: PyTorch/Lightning with small sequence length (<=64); <1h on gaming GPU.
  - Use: Detect “doom‑loop” patterns; trigger proactive blocks/nudges.

- Per‑host budget forecaster
  - Model: Prophet or ARIMA (classical) on daily minutes per host.
  - Training: CPU; fast.
  - Use: Anticipate overrun risk; schedule stricter windows.

- Clickbait/feed detector (DOM features)
  - Model: Random Forest or MobileNet‑tiny on thumbnail/text cues (if images enabled locally).
  - Training: Public datasets + small local fine‑tune; transfer learning on GPU.
  - Use: Drive Search‑only/Minimal mode DOM rules automatically.

## Data and features

- Inputs (local‑first, no raw DOM exfiltration):
  - URL: host, path segments, query params (redacted keys), referrer type.
  - Title text (normalized), language code.
  - Timestamp features: hour, day, days since created, minutes since last focus.
  - Policy context: strict mode, budgets, prior decision, appeal outcome.
  - Optional thumbnails (hashed) if user opts‑in for visual models.

- Feature extraction
  - TF‑IDF with hashing trick; character n‑grams for robustness.
  - Categorical encodings for host top‑K; one‑hot bins for time features.
  - Rolling aggregates: per‑host visit count last 1h/24h/7d, overruns.

## Training recipes (consumer GPU)

- Classic linear/GBDT models
  - scikit‑learn/LightGBM with CPU multithreading; no GPU required.
  - Export via ONNX for in‑browser inference with onnxruntime‑web.

- Small deep models
  - PyTorch + Lightning; train small text encoder (e.g., DistilTiny BERT) on titles; freeze most layers.
  - Mixed‑precision (fp16) on RTX 3060+; early stopping, weight decay.
  - Export to ONNX; quantize (int8) with static calibration on local corpus.

- Similarity/kNN
  - Use FAISS for index build; export centroid/prototypes and serve with cosine sim in JS.

## Inference and deployment

- Runtime options
  - JS/WASM: tfjs, onnxruntime‑web, or pure-JS linear models for minimal footprint.
  - MV3 constraints: run inference in background; persist small artifacts in `chrome.storage.local`.

- Model format
  - Prefer ONNX for portability; fall back to JSON weights for linear models.
  - Version models; include checksum and schemaVersion in metadata.

- Privacy
  - All training artifacts remain local by default; optional export/import via user action.
  - Federated or batched telemetry behind explicit flag; differentially private noise when aggregating.

## Integration touchpoints

- SenseAgent
  - Adds engineered features (n‑grams, time bins, rolling aggregates) and language detection.

- DistractionClassifierAgent
  - First stage: non‑LLM model outputs label+score instantly.
  - If score is uncertain, optionally consult LLM; else proceed deterministically.

- PolicyAgent
  - Consumes ML scores to set friction level, budgets, search‑only mode.
  - Updates per‑host `StrictnessProfile` based on predictions and outcomes.

- EnforcementAgent
  - Uses feed/clickbait detector signals to choose DOM rule packs (minimal/search‑only).

## Evaluation

- Metrics
  - Precision/recall on distract vs work; AUROC; calibration error.
  - Decision quality: user overrides, appeal allow rate, time saved per day.

- Validation
  - Rolling time‑split; shadow deploy non‑LLM model before enforcement.
  - Per‑user personalization tracked separately; no cross‑user mixing by default.

## Roadmap (ML)

- Phase A: Implement linear URL/Title classifier + time features (no GPU required); shadow deploy.
- Phase B: Add LightGBM risk model and kNN personalization; integrate into PolicyAgent.
- Phase C: Optional compact Transformer fine‑tune on local titles; quantize for browser inference.
- Phase D: Feed/clickbait detector (transfer learning); drive Minimal/Search‑only DOM rule selection.

## References & tooling

- scikit‑learn, LightGBM, XGBoost, FAISS, PyTorch Lightning, onnxruntime‑web, tfjs.
- Quantization: ONNX Runtime quantization, Intel Neural Compressor.
