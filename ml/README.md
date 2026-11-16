# LeafCheckup model pipeline

```bash
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
# Pretrained ImageNet weights (timm releases on GitHub)
curl -LO https://github.com/rwightman/pytorch-image-models/releases/download/v0.1-weights/efficientnet_b0_ra-3dd342df.pth
curl -LO https://github.com/rwightman/pytorch-image-models/releases/download/v0.1-weights/densenet121_ra-50efcf5c.pth

python data.py --data ridge_gourd=<Processed_Leaves> --data brinjal=<Brinjal_Dataset>   # leak-free split -> artifacts/split.json (datasets listed in crops.json)
python train.py --weights efficientnet_b0_ra-3dd342df.pth      # ~14 epochs -> model.pt, report.json, calib.pt
python export.py --version effb0-2026.11                        # ONNX (+INT8 attempt), head.json
python ood_eval.py && python ood.py                             # compare OOD detectors, ship Mahalanobis-PCA128
python baseline_paper.py --rg <Processed_Leaves> --weights densenet121_ra-50efcf5c.pth
python card.py                                                  # evaluation facts for the website
cp artifacts/export/{model.onnx,head.json,ood.bin} ../apps/web/public/models/<version>/
```
Bump `MODEL_VERSION` in `apps/web/src/lib/model/model-version.ts` for every new model so caches invalidate.

## Why the split matters

Both datasets were published with 15–16 offline variants per photo. Splitting after augmentation puts variants of the same leaf in train and test. `data.py` keeps originals only, groups by source leaf, merges near-duplicate photos (dHash ≤ 4) into one group, and removes photos that appear under two different labels:

- `healthy_189_v1.jpg` ≡ `MV_599_v1.jpg`
- `LMI_406_v1.jpg` ≡ `MV_549_v1.jpg`
- `Little_Leaf_007_Original.jpg` ≡ `Phomopsis_Blight_052_Original.jpg`
- `Little_Leaf_011_Original.jpg` ≡ `Phomopsis_Blight_003_Original.jpg`

Fix these in a v2 of the datasets.

## Results (held-out test, 217 leaves)

| | Accuracy | Macro F1 |
|---|---|---|
| EfficientNet-B0 fine-tuned (LeafCheckup), both crops, 217 leaves | 94.9% (CI 91.7–97.7) | 0.942 |
| EfficientNet-B0 fine-tuned (LeafCheckup), ridge gourd, 88 leaves | **98.9%** | **0.984** |
| DenseNet121 + XGBoost (paper method), ridge gourd, same 88 leaves | 92.0% | 0.890 |
| DenseNet121 + XGBoost, paper protocol (augment then split; 545/545 test leaves also in train) | 91.5% | 0.895 |
