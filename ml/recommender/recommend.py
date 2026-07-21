from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import torch

from model import ModelConfig, TravelRecommender


def time_bucket(hour: int) -> str:
    if 5 <= hour < 11:
        return "morning"
    if 11 <= hour < 14:
        return "lunch"
    if 14 <= hour < 18:
        return "afternoon"
    if 18 <= hour < 22:
        return "evening"
    return "night"


def haversine_km(lat1: float, lon1: float, lat2: float | None, lon2: float | None) -> float:
    if lat2 is None or lon2 is None:
        return 999.0
    radius = 6371.0088
    a_lat, b_lat = math.radians(lat1), math.radians(float(lat2))
    d_lat = math.radians(float(lat2) - lat1)
    d_lon = math.radians(float(lon2) - lon1)
    a = math.sin(d_lat / 2) ** 2 + math.cos(a_lat) * math.cos(b_lat) * math.sin(d_lon / 2) ** 2
    return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", default="ml/recommender/artifacts")
    parser.add_argument("--age-bucket", default="unknown")
    parser.add_argument("--companion-type", default="unknown")
    parser.add_argument("--child-age-bucket", default="unknown")
    parser.add_argument("--group-age-bucket", default="unknown")
    parser.add_argument("--month", default="unknown")
    parser.add_argument("--season", default="unknown")
    parser.add_argument("--rainy-season", type=float, default=0.0)
    parser.add_argument("--hour", type=int, default=14)
    parser.add_argument("--lat", type=float, required=True)
    parser.add_argument("--lon", type=float, required=True)
    parser.add_argument("--top-k", type=int, default=10)
    parser.add_argument("--max-distance-km", type=float, default=80.0)
    args = parser.parse_args()

    model_dir = Path(args.model_dir)
    metadata = json.loads((model_dir / "metadata.json").read_text(encoding="utf-8"))
    checkpoint = torch.load(model_dir / "model.pt", map_location="cpu")
    model = TravelRecommender(ModelConfig(**checkpoint["config"]))
    model.load_state_dict(checkpoint["model_state"])
    model.eval()

    age_idx = metadata["age_to_idx"].get(args.age_bucket, metadata["age_to_idx"].get("unknown", 0))
    time_idx = metadata["time_to_idx"].get(time_bucket(args.hour), metadata["time_to_idx"].get("unknown", 0))
    companion_idx = metadata["companion_to_idx"].get(args.companion_type, metadata["companion_to_idx"].get("unknown", 0))
    child_age_idx = metadata["child_age_to_idx"].get(args.child_age_bucket, metadata["child_age_to_idx"].get("unknown", 1))
    group_age_idx = metadata["group_age_to_idx"].get(args.group_age_bucket, metadata["group_age_to_idx"].get("unknown", 0))
    month_idx = metadata["month_to_idx"].get(str(args.month), metadata["month_to_idx"].get("unknown", 0))
    season_idx = metadata["season_to_idx"].get(args.season, metadata["season_to_idx"].get("unknown", 0))
    category_to_idx = metadata["category_to_idx"]

    rows = []
    with torch.no_grad():
        for place in metadata["places"]:
            place_idx = metadata["place_to_idx"][place["id"]]
            category_idx = category_to_idx.get(place.get("category") or "place", 0)
            distance = haversine_km(args.lat, args.lon, place.get("lat"), place.get("lon"))
            numeric = torch.tensor(
                [[
                    min(distance, 999.0) / 999.0,
                    float(place.get("popularity", 0.0)),
                    float(place.get("coord_known", 0.0)),
                    float(args.rainy_season),
                ]],
                dtype=torch.float32,
            )
            score = torch.sigmoid(
                model(
                    torch.tensor([age_idx]),
                    torch.tensor([time_idx]),
                    torch.tensor([companion_idx]),
                    torch.tensor([child_age_idx]),
                    torch.tensor([group_age_idx]),
                    torch.tensor([month_idx]),
                    torch.tensor([season_idx]),
                    torch.tensor([place_idx]),
                    torch.tensor([category_idx]),
                    numeric,
                )
            ).item()
            if distance > args.max_distance_km:
                continue
            distance_boost = max(0.0, 1.0 - min(distance, args.max_distance_km) / args.max_distance_km)
            final_score = score * (0.35 + distance_boost * 0.55) + float(place.get("popularity", 0.0)) * 0.10
            rows.append({**place, "score": final_score, "model_score": score, "distance_km": distance})

    rows.sort(key=lambda row: row["score"], reverse=True)
    print(json.dumps(rows[: args.top_k], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
