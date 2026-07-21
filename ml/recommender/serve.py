from __future__ import annotations

import argparse
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import torch

from model import ModelConfig, TravelRecommender
from recommend import haversine_km, time_bucket


class RecommendationEngine:
    def __init__(self, model_dir: Path):
        self.model_dir = model_dir
        self.metadata = json.loads((model_dir / "metadata.json").read_text(encoding="utf-8"))
        checkpoint = torch.load(model_dir / "model.pt", map_location="cpu")
        self.model = TravelRecommender(ModelConfig(**checkpoint["config"]))
        self.model.load_state_dict(checkpoint["model_state"])
        self.model.eval()

    def recommend(
        self,
        age_bucket: str,
        companion_type: str,
        child_age_bucket: str,
        group_age_bucket: str,
        month: str,
        season: str,
        rainy_season: float,
        hour: int,
        lat: float,
        lon: float,
        top_k: int,
        max_distance_km: float,
    ):
        age_idx = self.metadata["age_to_idx"].get(age_bucket, self.metadata["age_to_idx"].get("unknown", 0))
        time_idx = self.metadata["time_to_idx"].get(time_bucket(hour), self.metadata["time_to_idx"].get("unknown", 0))
        companion_idx = self.metadata["companion_to_idx"].get(companion_type, self.metadata["companion_to_idx"].get("unknown", 0))
        child_age_idx = self.metadata["child_age_to_idx"].get(child_age_bucket, self.metadata["child_age_to_idx"].get("unknown", 1))
        group_age_idx = self.metadata["group_age_to_idx"].get(group_age_bucket, self.metadata["group_age_to_idx"].get("unknown", 0))
        month_idx = self.metadata["month_to_idx"].get(str(month), self.metadata["month_to_idx"].get("unknown", 0))
        season_idx = self.metadata["season_to_idx"].get(season, self.metadata["season_to_idx"].get("unknown", 0))
        category_to_idx = self.metadata["category_to_idx"]
        rows = []
        with torch.no_grad():
            for place in self.metadata["places"]:
                distance = haversine_km(lat, lon, place.get("lat"), place.get("lon"))
                if distance > max_distance_km:
                    continue
                place_idx = self.metadata["place_to_idx"][place["id"]]
                category_idx = category_to_idx.get(place.get("category") or "place", 0)
                numeric = torch.tensor(
                    [[
                        min(distance, 999.0) / 999.0,
                        float(place.get("popularity", 0.0)),
                        float(place.get("coord_known", 0.0)),
                        rainy_season,
                    ]],
                    dtype=torch.float32,
                )
                model_score = torch.sigmoid(
                    self.model(
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
                distance_boost = max(0.0, 1.0 - min(distance, max_distance_km) / max_distance_km)
                score = model_score * (0.35 + distance_boost * 0.55) + float(place.get("popularity", 0.0)) * 0.10
                rows.append({**place, "score": score, "model_score": model_score, "distance_km": distance})
        rows.sort(key=lambda row: row["score"], reverse=True)
        return rows[:top_k]


def parse_float(params: dict[str, list[str]], key: str, default: float | None = None) -> float:
    value = params.get(key, [default])[0]
    if value is None:
        raise ValueError(f"missing {key}")
    return float(value)


def parse_int(params: dict[str, list[str]], key: str, default: int) -> int:
    return int(params.get(key, [default])[0])


def handler_factory(engine: RecommendationEngine):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            parsed = urlparse(self.path)
            if parsed.path not in {"/recommend", "/health"}:
                self.send_response(404)
                self.end_headers()
                return
            if parsed.path == "/health":
                self.respond({"ok": True})
                return
            try:
                params = parse_qs(parsed.query)
                result = engine.recommend(
                    age_bucket=params.get("age_bucket", ["unknown"])[0],
                    companion_type=params.get("companion_type", ["unknown"])[0],
                    child_age_bucket=params.get("child_age_bucket", ["unknown"])[0],
                    group_age_bucket=params.get("group_age_bucket", ["unknown"])[0],
                    month=params.get("month", ["unknown"])[0],
                    season=params.get("season", ["unknown"])[0],
                    rainy_season=parse_float(params, "rainy_season", 0.0),
                    hour=parse_int(params, "hour", 14),
                    lat=parse_float(params, "lat"),
                    lon=parse_float(params, "lon"),
                    top_k=parse_int(params, "top_k", 10),
                    max_distance_km=parse_float(params, "max_distance_km", 80.0),
                )
                self.respond({"items": result})
            except Exception as exc:
                self.send_response(400)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(exc)}, ensure_ascii=False).encode("utf-8"))

        def respond(self, payload: dict) -> None:
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps(payload, ensure_ascii=False).encode("utf-8"))

        def log_message(self, format: str, *args) -> None:
            return

    return Handler


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", default="ml/recommender/artifacts")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8091)
    args = parser.parse_args()

    engine = RecommendationEngine(Path(args.model_dir))
    server = ThreadingHTTPServer((args.host, args.port), handler_factory(engine))
    print(f"Serving travel recommender on http://{args.host}:{args.port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
