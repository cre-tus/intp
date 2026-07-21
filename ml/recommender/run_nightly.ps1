param(
    [string]$Python = "C:\mlvenv\Scripts\python.exe",
    [int]$Cycles = 1,
    [int]$Epochs = 300,
    [int]$BatchSize = 256,
    [string]$ArtifactDir = "ml/recommender/artifacts"
)

$ErrorActionPreference = "Stop"
$env:PYTHONIOENCODING = "utf-8"

for ($i = 1; $i -le $Cycles; $i++) {
    Write-Host "[$i/$Cycles] collecting OSM seed places"
    & $Python ml/recommender/collect_osm_places.py `
        --output "$ArtifactDir/osm_places.jsonl" `
        --limit-per-city 40

    Write-Host "[$i/$Cycles] building dataset from service DB"
    & $Python ml/recommender/build_dataset.py `
        --output "$ArtifactDir/dataset.json" `
        --osm-seed "$ArtifactDir/osm_places.jsonl"

    Write-Host "[$i/$Cycles] training CUDA model"
    & $Python ml/recommender/train.py `
        --dataset "$ArtifactDir/dataset.json" `
        --out-dir "$ArtifactDir" `
        --epochs $Epochs `
        --batch-size $BatchSize `
        --device cuda `
        --amp `
        --patience 40
}

Write-Host "Done. Artifacts are in $ArtifactDir"
