# Travel destination recommender initial model

This is an initial PyTorch recommendation pipeline for the current INFP travel service.

It only uses parameters already available in the service model:

- user age bucket from `users.birth`
- visit time bucket from itinerary activity `time`
- companion type such as solo, couple, friends, parents-only, or family with child
- child age bucket such as preschool, elementary, teen, or none
- month, season, and rainy-season context
- place popularity from saved/shared travel plans
- place distance from the user's current or anchor coordinates
- place coordinates from itinerary `lat/lon` or collected public seed data

## Files

- `build_dataset.py`: extracts interactions from MySQL `plans.content_json` and creates training JSON.
- `collect_osm_places.py`: optional public place collector using OpenStreetMap Overpass API.
- `seeds/contextual_trip_seeds.json`: manually curated OCR/image trip contexts such as rainy-season family trips.
- `model.py`: PyTorch ranking model.
- `train.py`: trains the initial model and exports `model.pt`, `metadata.json`, and `metrics.json`.
- `recommend.py`: CLI inference for top-K place recommendation.
- `serve.py`: small HTTP inference server for backend integration.
- `config.example.json`: example settings.

## Quick start

```powershell
cd C:\Users\pinea\IdeaProjects\infp
python -m pip install -r ml/recommender/requirements.txt
python ml/recommender/build_dataset.py --output ml/recommender/artifacts/dataset.json
python ml/recommender/train.py --dataset ml/recommender/artifacts/dataset.json --out-dir ml/recommender/artifacts --device auto --amp
python ml/recommender/recommend.py --model-dir ml/recommender/artifacts --age-bucket 20s --hour 14 --lat 35.6812 --lon 139.7671 --top-k 10
```

Family/rainy-season example:

```powershell
python ml/recommender/recommend.py --model-dir ml/recommender/artifacts --age-bucket 30s --companion-type family_with_young_child --child-age-bucket preschool --month 6 --season rainy --rainy-season 1 --hour 14 --lat 35.6909 --lon 139.7003 --top-k 10
```

Serve recommendations locally:

```powershell
C:\mlvenv\Scripts\python.exe ml/recommender/serve.py --model-dir ml/recommender/artifacts --port 8091
```

Then call:

```text
GET http://127.0.0.1:8091/recommend?age_bucket=20s&hour=14&lat=35.6812&lon=139.7671&top_k=10
```

On Windows, if CUDA PyTorch fails with a long-path error in a deep Python location,
create a short venv and install CUDA wheels there:

```powershell
C:\Users\pinea\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe -m venv C:\mlvenv
C:\mlvenv\Scripts\python.exe -m pip install torch --index-url https://download.pytorch.org/whl/cu126
C:\mlvenv\Scripts\python.exe -m pip install numpy requests pymysql
```

Nightly update:

```powershell
powershell -ExecutionPolicy Bypass -File ml/recommender/run_nightly.ps1 -Python C:\mlvenv\Scripts\python.exe -Cycles 3
```

Current verified artifact shape:

- `dataset.json`: extracted service interactions and collected candidate places
- `model.pt`: CUDA-trained PyTorch checkpoint
- `metadata.json`: feature encoders and place catalog
- `metrics.json`: validation metrics and CUDA device name

If the MySQL database is not reachable or has too little location data, `build_dataset.py`
creates a bootstrap dataset from public city samples so the model can still be trained.

## Production handoff

Run `build_dataset.py` from a backend job or batch container, then serve `recommend.py`
logic from a lightweight Python service or port the scoring function to Java after the
model shape stabilizes.
