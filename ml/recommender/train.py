from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

from model import ModelConfig, TravelRecommender


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", default="ml/recommender/artifacts/dataset.json")
    parser.add_argument("--out-dir", default="ml/recommender/artifacts")
    parser.add_argument("--epochs", type=int, default=80)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--device", default="auto", choices=["auto", "cuda", "cpu"])
    parser.add_argument("--amp", action="store_true")
    parser.add_argument("--patience", type=int, default=24)
    args = parser.parse_args()

    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)

    dataset = json.loads(Path(args.dataset).read_text(encoding="utf-8"))
    age_to_idx = {value: idx for idx, value in enumerate(dataset["age_buckets"])}
    time_to_idx = {value: idx for idx, value in enumerate(dataset["time_buckets"])}
    companion_to_idx = {value: idx for idx, value in enumerate(dataset["companion_types"])}
    child_age_to_idx = {value: idx for idx, value in enumerate(dataset["child_age_buckets"])}
    group_age_to_idx = {value: idx for idx, value in enumerate(dataset["group_age_buckets"])}
    month_to_idx = {value: idx for idx, value in enumerate(dataset["month_buckets"])}
    season_to_idx = {value: idx for idx, value in enumerate(dataset["season_buckets"])}
    place_to_idx = {place["id"]: idx for idx, place in enumerate(dataset["places"])}
    category_to_idx = {value: idx for idx, value in enumerate(dataset["categories"])}
    place_category = {place["id"]: place.get("category") or "place" for place in dataset["places"]}

    rows = dataset["interactions"]
    random.shuffle(rows)

    age = torch.tensor([age_to_idx.get(row["age_bucket"], 0) for row in rows], dtype=torch.long)
    time = torch.tensor([time_to_idx.get(row["time_bucket"], len(time_to_idx) - 1) for row in rows], dtype=torch.long)
    companion = torch.tensor([companion_to_idx.get(row.get("companion_type", "unknown"), 0) for row in rows], dtype=torch.long)
    child_age = torch.tensor([child_age_to_idx.get(row.get("child_age_bucket", "unknown"), 1) for row in rows], dtype=torch.long)
    group_age = torch.tensor([group_age_to_idx.get(row.get("group_age_bucket", "unknown"), 0) for row in rows], dtype=torch.long)
    month = torch.tensor([month_to_idx.get(str(row.get("month_bucket", "unknown")), 0) for row in rows], dtype=torch.long)
    season = torch.tensor([season_to_idx.get(row.get("season_bucket", "unknown"), 0) for row in rows], dtype=torch.long)
    place = torch.tensor([place_to_idx[row["place_id"]] for row in rows], dtype=torch.long)
    category = torch.tensor([category_to_idx.get(place_category[row["place_id"]], 0) for row in rows], dtype=torch.long)
    place_by_id = {place["id"]: place for place in dataset["places"]}
    numeric = torch.tensor(
        [
            [
                min(float(row.get("distance_km", 999.0)), 999.0) / 999.0,
                float(row.get("popularity", 0.0)),
                float(place_by_id[row["place_id"]].get("coord_known", 0.0)),
                float(row.get("rainy_season", 0.0)),
            ]
            for row in rows
        ],
        dtype=torch.float32,
    )
    labels = torch.tensor([float(row["label"]) for row in rows], dtype=torch.float32)

    split = max(1, int(len(rows) * 0.8))
    train_data = TensorDataset(
        age[:split],
        time[:split],
        companion[:split],
        child_age[:split],
        group_age[:split],
        month[:split],
        season[:split],
        place[:split],
        category[:split],
        numeric[:split],
        labels[:split],
    )
    valid_data = TensorDataset(
        age[split:],
        time[split:],
        companion[split:],
        child_age[split:],
        group_age[split:],
        month[split:],
        season[split:],
        place[split:],
        category[split:],
        numeric[split:],
        labels[split:],
    )
    train_loader = DataLoader(train_data, batch_size=args.batch_size, shuffle=True)
    valid_loader = DataLoader(valid_data, batch_size=args.batch_size)

    config = ModelConfig(
        age_bucket_count=len(age_to_idx),
        time_bucket_count=len(time_to_idx),
        companion_type_count=len(companion_to_idx),
        child_age_bucket_count=len(child_age_to_idx),
        group_age_bucket_count=len(group_age_to_idx),
        month_bucket_count=len(month_to_idx),
        season_bucket_count=len(season_to_idx),
        place_count=len(place_to_idx),
        category_count=len(category_to_idx),
    )
    if args.device == "auto":
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    else:
        device = torch.device(args.device)
    if device.type == "cuda" and not torch.cuda.is_available():
        raise RuntimeError("CUDA was requested but torch.cuda.is_available() is false")

    model = TravelRecommender(config).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=0.003, weight_decay=0.001)
    loss_fn = nn.BCEWithLogitsLoss()
    use_amp = args.amp and device.type == "cuda"
    scaler = torch.amp.GradScaler("cuda", enabled=use_amp)
    print(f"device={device} amp={use_amp}")

    best_state = None
    best_loss = float("inf")
    best_epoch = 0
    bad_epochs = 0

    for epoch in range(1, args.epochs + 1):
        model.train()
        total_loss = 0.0
        for batch in train_loader:
            batch = tuple(item.to(device) for item in batch)
            optimizer.zero_grad()
            with torch.amp.autocast("cuda", enabled=use_amp):
                pred = model(*batch[:-1])
                loss = loss_fn(pred, batch[-1])
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
            total_loss += float(loss.item()) * len(batch[-1])
        model.eval()
        epoch_valid_loss = 0.0
        epoch_total = 0
        with torch.no_grad():
            for batch in valid_loader:
                batch = tuple(item.to(device) for item in batch)
                logits = model(*batch[:-1])
                epoch_valid_loss += float(loss_fn(logits, batch[-1]).item()) * len(batch[-1])
                epoch_total += len(batch[-1])
        epoch_valid_loss /= max(1, epoch_total)
        if epoch_valid_loss < best_loss:
            best_loss = epoch_valid_loss
            best_epoch = epoch
            bad_epochs = 0
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
        else:
            bad_epochs += 1
        if epoch == 1 or epoch % 20 == 0:
            print(
                f"epoch={epoch} train_loss={total_loss / max(1, len(train_data)):.4f} "
                f"valid_loss={epoch_valid_loss:.4f} best={best_loss:.4f}@{best_epoch}"
            )
        if bad_epochs >= args.patience:
            print(f"early_stop epoch={epoch} best_epoch={best_epoch}")
            break

    if best_state is not None:
        model.load_state_dict(best_state)

    model.eval()
    valid_loss = 0.0
    correct = 0
    total = 0
    with torch.no_grad():
        for batch in valid_loader:
            batch = tuple(item.to(device) for item in batch)
            logits = model(*batch[:-1])
            valid_loss += float(loss_fn(logits, batch[-1]).item()) * len(batch[-1])
            preds = (torch.sigmoid(logits) >= 0.5).float()
            correct += int((preds == batch[-1]).sum().item())
            total += len(batch[-1])

    metrics = {
        "rows": len(rows),
        "places": len(place_to_idx),
        "valid_loss": valid_loss / max(1, total),
        "valid_accuracy": correct / max(1, total),
        "best_epoch": best_epoch,
        "device": str(device),
        "cuda_name": torch.cuda.get_device_name(0) if device.type == "cuda" else None,
    }

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    torch.save({"model_state": {k: v.detach().cpu() for k, v in model.state_dict().items()}, "config": config.__dict__}, out_dir / "model.pt")
    (out_dir / "metadata.json").write_text(
        json.dumps(
            {
                "age_to_idx": age_to_idx,
                "time_to_idx": time_to_idx,
                "companion_to_idx": companion_to_idx,
                "child_age_to_idx": child_age_to_idx,
                "group_age_to_idx": group_age_to_idx,
                "month_to_idx": month_to_idx,
                "season_to_idx": season_to_idx,
                "place_to_idx": place_to_idx,
                "category_to_idx": category_to_idx,
                "places": dataset["places"],
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    (out_dir / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
