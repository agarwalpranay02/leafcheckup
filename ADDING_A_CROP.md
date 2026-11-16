# Adding a crop

LeafCheckup is built so that a new crop takes one dataset entry, one block of field-guide content and a retrain. The site's crop lists, counts, headings, FAQ answer, disclaimer, model card, app manifest and sharing image all update by themselves.

## What you need

- **Real field photos**, one folder per condition, including a healthy folder. Aim for at least 150 different leaves per condition. Lab photos on plain backgrounds (PlantVillage style) train well but fail on real farms, so prefer field data.
- One leaf per photo, filling most of the frame.
- The dataset's licence and DOI, so the site can credit it.

## 1. Register the dataset in `ml/crops.json`

Append a block at the **end** of `datasets`. The order fixes the model's output positions, so never insert in the middle.

```json
{
  "crop": "tomato",
  "name": "Tomato leaf dataset",
  "doi": "10.xxxx/xxxx",
  "layout": "folders",
  "classes": [
    { "id": "tomato__healthy", "folder": "Healthy" },
    { "id": "tomato__early_blight", "folder": "Early_Blight" },
    { "id": "tomato__leaf_curl", "folder": "Leaf_Curl" }
  ]
}
```

- `crop` is a lowercase id with underscores. Every class id starts with `<crop>__`.
- `"layout": "folders"` reads every image in each folder (subfolders included).
- If the dataset ships several edited copies of each photo (rotations, filters, crops), use `"layout": "variants"` like the two existing datasets. It keeps only the original photo of each leaf, which stops copies of one leaf landing in both training and testing and inflating the accuracy.

## 2. Build the split and retrain

From `ml/`:

```bash
python data.py --data ridge_gourd=<Processed_Leaves> --data brinjal=<Brinjal_Dataset> --data tomato=<Tomato_Dataset>
python train.py --weights efficientnet_b0_ra-3dd342df.pth
python export.py --version effb0-2027.01
python ood.py && python card.py
mkdir -p ../apps/web/public/models/effb0-2027.01
cp artifacts/export/{model.onnx,head.json,ood.bin} ../apps/web/public/models/effb0-2027.01/
```

`data.py` prints how many near-duplicates it merged and lists photos filed under two different labels, which it removes. Check that list: it usually means a mislabelled photo in the source dataset.

Then set `MODEL_VERSION` in `apps/web/src/lib/model/model-version.ts` to the new version, and copy `card.json` into the same folder, so visitors' phones download the new model.

## 3. Add the field guide in `apps/web/src/lib/diseases.ts`

1. Add the crop to `CROPS`:
   ```ts
   tomato: { en: "Tomato", local: "tamatar", scientific: "Solanum lycopersicum" },
   ```
2. Add one entry to `CONDITIONS` per class: the same `id` as in `crops.json`, a URL `slug`, `name`, `short`, `severity` (`none` for healthy, `watch` or `act`), symptoms, look-alikes, management advice and at least one https source from an agricultural university, ICAR or a state department.
3. Add a sample photo per class at `public/samples/<id>.jpg` (from your test split), and a heatmap at `public/samples/heat/<id>.png` for disease classes.
4. Credit the dataset under Licences in `src/app/[locale]/legal/[doc]/page.tsx`, add it to `RESEARCH.datasets` in `src/lib/site.ts`, and update the training-data row of the model card.

## 4. Check

```bash
cd apps/web
npm test          # fails if a model class has no guide entry, or a guide entry has no crop
npm run build && npm start &
npx playwright test
```

The unit tests check that the field guide matches the model's classes exactly. The end-to-end tests diagnose every sample photo, so a new crop is tested automatically as soon as its sample photos exist.
