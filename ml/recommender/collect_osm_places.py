from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import requests


DEFAULT_CITIES = {
    "seoul": (37.41, 126.76, 37.70, 127.18),
    "busan": (35.03, 128.93, 35.30, 129.30),
    "incheon": (37.35, 126.55, 37.65, 126.85),
    "daegu": (35.75, 128.45, 36.00, 128.75),
    "daejeon": (36.24, 127.25, 36.47, 127.52),
    "gwangju": (35.05, 126.75, 35.25, 127.02),
    "ulsan": (35.42, 129.16, 35.70, 129.48),
    "jeju": (33.20, 126.15, 33.58, 126.95),
    "tokyo": (35.50, 139.45, 35.85, 139.95),
    "osaka": (34.55, 135.35, 34.82, 135.65),
    "fukuoka": (33.48, 130.30, 33.68, 130.55),
    "sapporo": (42.95, 141.20, 43.18, 141.55),
    "nagoya": (35.05, 136.75, 35.30, 137.05),
}

ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.ru/api/interpreter",
]

QUERY = """
[out:json][timeout:25];
(
  node["tourism"]({south},{west},{north},{east});
  node["historic"]({south},{west},{north},{east});
  node["leisure"]({south},{west},{north},{east});
  node["amenity"="cafe"]({south},{west},{north},{east});
  node["amenity"="restaurant"]({south},{west},{north},{east});
);
out {limit};
"""


def category(tags: dict[str, str]) -> str:
    if tags.get("amenity") in {"cafe", "restaurant"}:
        return "food"
    if tags.get("leisure") in {"park", "garden"}:
        return "park"
    if tags.get("tourism") == "viewpoint":
        return "viewpoint"
    if tags.get("tourism") == "museum":
        return "museum"
    return "landmark"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="ml/recommender/artifacts/osm_places.jsonl")
    parser.add_argument("--limit-per-city", type=int, default=120)
    parser.add_argument("--endpoint", default="")
    args = parser.parse_args()

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)

    count = 0
    with output.open("w", encoding="utf-8") as handle:
        endpoints = [args.endpoint] if args.endpoint else ENDPOINTS
        for city, (south, west, north, east) in DEFAULT_CITIES.items():
            query = QUERY.format(south=south, west=west, north=north, east=east, limit=args.limit_per_city)
            response = None
            for endpoint in endpoints:
                try:
                    candidate = requests.post(
                        endpoint,
                        data={"data": query},
                        headers={"User-Agent": "infp-travel-recommender/0.1"},
                        timeout=45,
                    )
                    candidate.raise_for_status()
                    response = candidate
                    break
                except requests.RequestException as exc:
                    print(f"{city}: {endpoint} failed: {exc}")
                    continue
            if response is None:
                print(f"{city}: skipped")
                continue
            for item in response.json().get("elements", []):
                tags = item.get("tags") or {}
                name = tags.get("name:ko") or tags.get("name:en") or tags.get("name")
                if not name or item.get("lat") is None or item.get("lon") is None:
                    continue
                row = {
                    "id": f"osm_{item.get('type', 'node')}_{item['id']}",
                    "name": name,
                    "city": city,
                    "category": category(tags),
                    "lat": item["lat"],
                    "lon": item["lon"],
                    "source": "openstreetmap",
                }
                handle.write(json.dumps(row, ensure_ascii=False) + "\n")
                count += 1
            time.sleep(1.0)
    print(f"Wrote {count} OSM places to {output}")


if __name__ == "__main__":
    main()
