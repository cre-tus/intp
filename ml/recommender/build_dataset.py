from __future__ import annotations

import argparse
import json
import math
import os
from collections import Counter
from datetime import date, datetime
from pathlib import Path
from typing import Any


AGE_BUCKETS = ["unknown", "10s", "20s", "30s", "40s", "50s", "60s_plus"]
TIME_BUCKETS = ["morning", "lunch", "afternoon", "evening", "night", "unknown"]
MIN_COMPLETED_DAYS = 2
MIN_COMPLETED_PLACES = 10
COMPANION_TYPES = [
    "unknown",
    "solo",
    "couple",
    "friends",
    "parents_only",
    "family_with_young_child",
    "family_with_child",
    "family_with_teen",
    "multi_generation",
]
CHILD_AGE_BUCKETS = ["none", "unknown", "infant", "toddler", "preschool", "lower_elementary", "upper_elementary", "teen"]
GROUP_AGE_BUCKETS = ["unknown", "10s", "20s", "30s", "40s", "50s", "60s_plus", "mixed"]
SEASON_BUCKETS = ["unknown", "spring", "summer", "rainy", "autumn", "winter"]
MONTH_BUCKETS = ["unknown", *[str(month) for month in range(1, 13)]]
GENERIC_PLACE_NAMES = {"지도 선택 위치", "장소", "장소 미정", "선택 위치"}


BOOTSTRAP_PLACES = [
    ("tokyo_station", "Tokyo Station", "station", 35.681236, 139.767125, "morning"),
    ("shinjuku_gyoen", "Shinjuku Gyoen", "park", 35.685176, 139.710052, "afternoon"),
    ("asakusa_sensoji", "Senso-ji", "landmark", 35.714765, 139.796655, "morning"),
    ("shibuya_sky", "Shibuya Sky", "viewpoint", 35.658447, 139.701646, "evening"),
    ("osaka_castle", "Osaka Castle", "landmark", 34.687315, 135.526201, "afternoon"),
    ("dotonbori", "Dotonbori", "food", 34.668723, 135.501297, "evening"),
    ("fukuoka_canal_city", "Canal City Hakata", "shopping", 33.589757, 130.410465, "afternoon"),
    ("sapporo_odori", "Odori Park", "park", 43.060646, 141.347583, "afternoon"),
    ("nagoya_castle", "Nagoya Castle", "landmark", 35.185565, 136.899019, "morning"),
]


def age_bucket(birth: Any, today: date | None = None) -> str:
    if not birth:
        return "unknown"
    today = today or date.today()
    if isinstance(birth, str):
        try:
            birth = date.fromisoformat(str(birth)[:10])
        except ValueError:
            return "unknown"
    age = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
    if age < 10:
        return "unknown"
    if age >= 60:
        return "60s_plus"
    return f"{age // 10 * 10}s"


def time_bucket(value: Any) -> str:
    if not value or not isinstance(value, str) or ":" not in value:
        return "unknown"
    try:
        hour = int(value.split(":", 1)[0])
    except ValueError:
        return "unknown"
    if 5 <= hour < 11:
        return "morning"
    if 11 <= hour < 14:
        return "lunch"
    if 14 <= hour < 18:
        return "afternoon"
    if 18 <= hour < 22:
        return "evening"
    return "night"


def month_bucket(value: Any) -> str:
    if not value:
        return "unknown"
    if isinstance(value, (datetime, date)):
        return str(value.month)
    try:
        return str(date.fromisoformat(str(value)[:10]).month)
    except ValueError:
        return "unknown"


def season_bucket(month: str, text: str = "") -> str:
    lowered = text.lower()
    if any(keyword in lowered for keyword in ["장마", "rainy", "梅雨"]):
        return "rainy"
    if month in {"6", "7"}:
        return "rainy"
    if month in {"3", "4", "5"}:
        return "spring"
    if month in {"8"}:
        return "summer"
    if month in {"9", "10", "11"}:
        return "autumn"
    if month in {"12", "1", "2"}:
        return "winter"
    return "unknown"


def child_age_bucket_from_age(age: int | None) -> str:
    if age is None:
        return "unknown"
    if age <= 1:
        return "infant"
    if age <= 3:
        return "toddler"
    if age <= 6:
        return "preschool"
    if age <= 9:
        return "lower_elementary"
    if age <= 12:
        return "upper_elementary"
    if age <= 18:
        return "teen"
    return "none"


def infer_trip_context(content: dict[str, Any], row: dict[str, Any]) -> dict[str, Any]:
    text_parts = [
        str(row.get("title") or ""),
        str(row.get("description") or ""),
        str(content.get("title") or ""),
    ]
    for day in content.get("days") or []:
        text_parts.append(str(day.get("dayTitle") or ""))
        for activity in day.get("activities") or []:
            text_parts.append(str(activity.get("location") or ""))
            text_parts.append(str(activity.get("activity") or ""))
    text = " ".join(text_parts)
    inferred_month = month_bucket(row.get("start_date") or first_day_date(content) or row.get("created_at"))
    inferred_season = season_bucket(inferred_month, text)

    saved = content.get("tripContext") or {}
    if isinstance(saved, dict) and any(saved.get(key) for key in ("companionType", "childAgeBucket", "groupAgeBucket")):
        saved_month = str(saved.get("monthBucket") or "unknown")
        trip_month = saved_month if saved_month != "unknown" else inferred_month
        saved_season = saved.get("seasonBucket") or "unknown"
        season = saved_season if saved_season != "unknown" else season_bucket(trip_month, text)
        return {
            "companion_type": saved.get("companionType") or "unknown",
            "child_age_bucket": saved.get("childAgeBucket") or "unknown",
            "group_age_bucket": saved.get("groupAgeBucket") or "unknown",
            "month_bucket": trip_month,
            "season_bucket": season,
            "rainy_season": 1.0 if bool(saved.get("rainySeason")) or season == "rainy" else 0.0,
        }
    lowered = text.lower()

    child_age = None
    age_match = re_search_child_age(text)
    if age_match is not None:
        child_age = age_match

    has_child_keyword = any(keyword in text for keyword in ["아이", "아들", "딸", "자녀", "어린이", "유아", "초등", "키즈"])
    has_family_keyword = any(keyword in text for keyword in ["가족", "부모", "엄마", "아빠", "family", "kids", "child"])
    if child_age is not None or has_child_keyword:
        child_bucket = child_age_bucket_from_age(child_age)
        if child_bucket in {"infant", "toddler", "preschool"}:
            companion_type = "family_with_young_child"
        elif child_bucket in {"lower_elementary", "upper_elementary"}:
            companion_type = "family_with_child"
        elif child_bucket == "teen":
            companion_type = "family_with_teen"
        else:
            companion_type = "family_with_child"
    elif any(keyword in text for keyword in ["친구", "우정", "friends", "friend"]):
        companion_type = "friends"
        child_bucket = "none"
    elif any(keyword in text for keyword in ["커플", "연인", "신혼", "couple"]):
        companion_type = "couple"
        child_bucket = "none"
    elif any(keyword in text for keyword in ["부모끼리", "엄마끼리", "아빠끼리"]):
        companion_type = "parents_only"
        child_bucket = "none"
    elif any(keyword in text for keyword in ["3대", "삼대", "할머니", "할아버지", "multi-generation"]):
        companion_type = "multi_generation"
        child_bucket = "unknown"
    elif has_family_keyword:
        companion_type = "family_with_child"
        child_bucket = "unknown"
    elif any(keyword in lowered for keyword in ["solo", "혼자", "나홀로"]):
        companion_type = "solo"
        child_bucket = "none"
    else:
        companion_type = "unknown"
        child_bucket = "unknown"

    trip_month = inferred_month
    season = inferred_season
    return {
        "companion_type": companion_type,
        "child_age_bucket": child_bucket,
        "group_age_bucket": "mixed" if companion_type.startswith("family_with_") or companion_type == "multi_generation" else age_bucket(row.get("birth")),
        "month_bucket": trip_month,
        "season_bucket": season,
        "rainy_season": 1.0 if season == "rainy" else 0.0,
    }


def re_search_child_age(text: str) -> int | None:
    import re

    match = re.search(r"(\d{1,2})\s*세", text)
    if match:
        age = int(match.group(1))
        if 0 <= age <= 18:
            return age
    return None


def first_day_date(content: dict[str, Any]) -> Any:
    for day in content.get("days") or []:
        if day.get("date"):
            return day.get("date")
    return None


def completed_plan_stats(content: dict[str, Any], activities: list[dict[str, Any]]) -> dict[str, int | bool]:
    completed_days = 0
    for day in content.get("days") or []:
        day_activities = list(iter_plan_activities({"days": [day]}))
        if day_activities:
            completed_days += 1
    place_count = len(activities)
    return {
        "completed_days": completed_days,
        "place_count": place_count,
        "eligible": completed_days >= MIN_COMPLETED_DAYS and place_count >= MIN_COMPLETED_PLACES,
    }


def haversine_km(lat1: float | None, lon1: float | None, lat2: float | None, lon2: float | None) -> float:
    if None in (lat1, lon1, lat2, lon2):
        return 999.0
    radius = 6371.0088
    a_lat, b_lat = math.radians(float(lat1)), math.radians(float(lat2))
    d_lat = math.radians(float(lat2) - float(lat1))
    d_lon = math.radians(float(lon2) - float(lon1))
    a = math.sin(d_lat / 2) ** 2 + math.cos(a_lat) * math.cos(b_lat) * math.sin(d_lon / 2) ** 2
    return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def normalize_place_key(name: str, lat: Any = None, lon: Any = None) -> str:
    base = "".join(ch.lower() if ch.isalnum() else "_" for ch in name.strip())[:80].strip("_")
    if lat is not None and lon is not None:
        return f"{base}_{round(float(lat), 3)}_{round(float(lon), 3)}"
    return base or "unknown_place"


def iter_plan_activities(content: dict[str, Any]):
    for day in content.get("days") or []:
        for activity in day.get("activities") or []:
            if str(activity.get("time", "")).startswith("__"):
                continue
            raw_name = (activity.get("location") or "").strip()
            activity_text = (activity.get("activity") or "").strip()
            if raw_name in GENERIC_PLACE_NAMES and not activity_text:
                continue
            name = activity_text[:80] if raw_name in GENERIC_PLACE_NAMES and activity_text else raw_name
            if not name:
                continue
            yield {
                "name": name,
                "time": activity.get("time") or "",
                "activity": activity_text,
                "lat": activity.get("lat"),
                "lon": activity.get("lon"),
                "place_id": activity.get("placeId") or "",
                "category": infer_category(activity.get("activity") or "", name),
            }


def infer_category(activity: str, name: str) -> str:
    text = f"{activity} {name}".lower()
    rules = [
        ("food", ["식사", "카페", "맛집", "브런치", "coffee", "restaurant", "cafe"]),
        ("shopping", ["쇼핑", "마켓", "몰", "market", "mall", "shop"]),
        ("park", ["공원", "오름", "산책", "park", "garden"]),
        ("landmark", ["성", "타워", "사원", "신사", "temple", "tower", "castle"]),
        ("station", ["역", "공항", "터미널", "station", "airport"]),
    ]
    for category, keywords in rules:
        if any(keyword in text for keyword in keywords):
            return category
    return "place"


def load_osm_seed(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    places = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            if line.strip():
                places.append(json.loads(line))
    return places


def load_trip_seeds(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def fetch_mysql_rows() -> list[dict[str, Any]]:
    import pymysql

    conn = pymysql.connect(
        host=os.getenv("DB_HOST", "127.0.0.1"),
        port=int(os.getenv("DB_PORT", "3308")),
        user=os.getenv("DB_USER", os.getenv("MYSQL_USER", "root")),
        password=os.getenv("DB_PASSWORD", os.getenv("MYSQL_PASSWORD", "infp")),
        database=os.getenv("DB_NAME", os.getenv("MYSQL_DATABASE", "infp")),
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
    )
    with conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT p.id AS plan_id,
                       p.owner_id,
                       p.title,
                       p.description,
                       p.start_date,
                       p.end_date,
                       p.content_json,
                       p.created_at,
                       u.birth
                  FROM plans p
                  JOIN users u ON u.id = p.owner_id
                 WHERE p.content_json IS NOT NULL
                """
            )
            return list(cur.fetchall())


def build_from_rows(rows: list[dict[str, Any]], osm_places: list[dict[str, Any]], trip_seeds: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    place_catalog: dict[str, dict[str, Any]] = {}
    positives: list[dict[str, Any]] = []
    popularity = Counter()
    by_plan_anchor: dict[int, tuple[float | None, float | None]] = {}
    skipped_incomplete_plans = 0
    eligible_service_plans = 0

    for row in rows:
        try:
            content = json.loads(row["content_json"])
        except Exception:
            continue
        context = infer_trip_context(content, row)
        activities = list(iter_plan_activities(content))
        stats = completed_plan_stats(content, activities)
        if not stats["eligible"]:
            skipped_incomplete_plans += 1
            continue
        eligible_service_plans += 1
        coords = [(float(a["lat"]), float(a["lon"])) for a in activities if a.get("lat") is not None and a.get("lon") is not None]
        anchor = (sum(lat for lat, _ in coords) / len(coords), sum(lon for _, lon in coords) / len(coords)) if coords else (None, None)
        by_plan_anchor[int(row["plan_id"])] = anchor
        for activity in activities:
            key = activity.get("place_id") or normalize_place_key(activity["name"], activity.get("lat"), activity.get("lon"))
            place_catalog.setdefault(
                key,
                {
                    "id": key,
                    "name": activity["name"],
                    "category": activity["category"],
                    "lat": activity.get("lat"),
                    "lon": activity.get("lon"),
                },
            )
            popularity[key] += 1
            positives.append(
                {
                    "age_bucket": age_bucket(row.get("birth")),
                    "time_bucket": time_bucket(activity["time"]),
                    **context,
                    "place_id": key,
                    "anchor_lat": anchor[0],
                    "anchor_lon": anchor[1],
                    "label": 1,
                    "source": "service_plan",
                    "completed_days": stats["completed_days"],
                    "place_count": stats["place_count"],
                }
            )

    for place in osm_places:
        key = place.get("id") or normalize_place_key(place["name"], place.get("lat"), place.get("lon"))
        place_catalog.setdefault(
            key,
            {
                "id": key,
                "name": place["name"],
                "category": place.get("category") or "place",
                "lat": place.get("lat"),
                "lon": place.get("lon"),
            },
        )
        popularity[key] += 1

    preferred_time = {
        "food": "lunch",
        "park": "afternoon",
        "viewpoint": "evening",
        "museum": "afternoon",
        "landmark": "morning",
        "shopping": "afternoon",
        "station": "morning",
        "place": "afternoon",
    }
    for place in osm_places:
        key = place.get("id") or normalize_place_key(place["name"], place.get("lat"), place.get("lon"))
        if key not in place_catalog:
            continue
        category = place_catalog[key].get("category") or "place"
        for age in ("unknown", "20s", "30s"):
            positives.append(
                {
                        "age_bucket": age,
                        "time_bucket": preferred_time.get(category, "afternoon"),
                        "companion_type": "unknown",
                        "child_age_bucket": "unknown",
                        "group_age_bucket": age,
                        "month_bucket": "unknown",
                        "season_bucket": "unknown",
                        "rainy_season": 0.0,
                        "place_id": key,
                    "anchor_lat": place_catalog[key].get("lat"),
                    "anchor_lon": place_catalog[key].get("lon"),
                    "label": 0.65,
                    "source": "osm_seed",
                }
            )

    for trip in trip_seeds or []:
        context = {
            "age_bucket": trip.get("age_bucket", "unknown"),
            "companion_type": trip.get("companion_type", "unknown"),
            "child_age_bucket": trip.get("child_age_bucket", "unknown"),
            "group_age_bucket": trip.get("group_age_bucket", "unknown"),
            "month_bucket": str(trip.get("month_bucket", "unknown")),
            "season_bucket": trip.get("season_bucket", "unknown"),
            "rainy_season": float(trip.get("rainy_season", 0.0)),
        }
        anchor_lat = trip.get("anchor_lat")
        anchor_lon = trip.get("anchor_lon")
        for place in trip.get("places") or []:
            key = place.get("id") or normalize_place_key(place["name"], place.get("lat"), place.get("lon"))
            place_catalog.setdefault(
                key,
                {
                    "id": key,
                    "name": place["name"],
                    "category": place.get("category") or "place",
                    "lat": place.get("lat"),
                    "lon": place.get("lon"),
                },
            )
            popularity[key] += 2
            positives.append(
                {
                    **context,
                    "time_bucket": place.get("time_bucket", "unknown"),
                    "place_id": key,
                    "anchor_lat": anchor_lat if anchor_lat is not None else place.get("lat"),
                    "anchor_lon": anchor_lon if anchor_lon is not None else place.get("lon"),
                    "label": float(trip.get("label", 1.0)),
                    "source": trip.get("source", "manual_context_seed"),
                }
            )

    if len(place_catalog) < 5 or len(positives) < 10:
        for idx, (key, name, category, lat, lon, preferred_time) in enumerate(BOOTSTRAP_PLACES):
            place_catalog[key] = {"id": key, "name": name, "category": category, "lat": lat, "lon": lon}
            popularity[key] += 2 + idx % 3
            for age in ["20s", "30s", "40s", "unknown"]:
                positives.append(
                    {
                        "age_bucket": age,
                        "time_bucket": preferred_time,
                        "companion_type": "unknown",
                        "child_age_bucket": "unknown",
                        "group_age_bucket": age,
                        "month_bucket": "unknown",
                        "season_bucket": "unknown",
                        "rainy_season": 0.0,
                        "place_id": key,
                        "anchor_lat": lat,
                        "anchor_lon": lon,
                        "label": 1,
                        "source": "bootstrap",
                    }
                )

    max_pop = max(popularity.values() or [1])
    interactions = []
    all_place_ids = list(place_catalog.keys())
    positive_keys = {
        (
            item["age_bucket"],
            item["time_bucket"],
            item.get("companion_type", "unknown"),
            item.get("child_age_bucket", "unknown"),
            item.get("group_age_bucket", "unknown"),
            item.get("month_bucket", "unknown"),
            item.get("season_bucket", "unknown"),
            item["place_id"],
        )
        for item in positives
    }

    for item in positives:
        place = place_catalog[item["place_id"]]
        distance = haversine_km(item.get("anchor_lat"), item.get("anchor_lon"), place.get("lat"), place.get("lon"))
        interactions.append({**item, "distance_km": distance, "popularity": popularity[item["place_id"]] / max_pop})

    for item in positives:
        anchor_place = place_catalog[item["place_id"]]
        candidates = sorted(
            all_place_ids,
            key=lambda pid: haversine_km(anchor_place.get("lat"), anchor_place.get("lon"), place_catalog[pid].get("lat"), place_catalog[pid].get("lon")),
        )
        added = 0
        for pid in candidates:
            key = (
                item["age_bucket"],
                item["time_bucket"],
                item.get("companion_type", "unknown"),
                item.get("child_age_bucket", "unknown"),
                item.get("group_age_bucket", "unknown"),
                item.get("month_bucket", "unknown"),
                item.get("season_bucket", "unknown"),
                pid,
            )
            if key in positive_keys:
                continue
            place = place_catalog[pid]
            interactions.append(
                {
                    "age_bucket": item["age_bucket"],
                    "time_bucket": item["time_bucket"],
                    "companion_type": item.get("companion_type", "unknown"),
                    "child_age_bucket": item.get("child_age_bucket", "unknown"),
                    "group_age_bucket": item.get("group_age_bucket", "unknown"),
                    "month_bucket": item.get("month_bucket", "unknown"),
                    "season_bucket": item.get("season_bucket", "unknown"),
                    "rainy_season": float(item.get("rainy_season", 0.0)),
                    "place_id": pid,
                    "anchor_lat": item.get("anchor_lat"),
                    "anchor_lon": item.get("anchor_lon"),
                    "label": 0,
                    "source": "negative_sample",
                    "distance_km": haversine_km(item.get("anchor_lat"), item.get("anchor_lon"), place.get("lat"), place.get("lon")),
                    "popularity": popularity[pid] / max_pop,
                }
            )
            added += 1
            if added >= 3:
                break

    categories = sorted({place["category"] for place in place_catalog.values()} | {"place"})
    for key, place in place_catalog.items():
        place["popularity"] = popularity[key] / max_pop
        place["coord_known"] = 1 if place.get("lat") is not None and place.get("lon") is not None else 0
    return {
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "quality_filter": {
            "min_completed_days": MIN_COMPLETED_DAYS,
            "min_completed_places": MIN_COMPLETED_PLACES,
            "eligible_service_plans": eligible_service_plans,
            "skipped_incomplete_plans": skipped_incomplete_plans,
        },
        "age_buckets": AGE_BUCKETS,
        "time_buckets": TIME_BUCKETS,
        "companion_types": COMPANION_TYPES,
        "child_age_buckets": CHILD_AGE_BUCKETS,
        "group_age_buckets": GROUP_AGE_BUCKETS,
        "month_buckets": MONTH_BUCKETS,
        "season_buckets": SEASON_BUCKETS,
        "categories": categories,
        "places": sorted(place_catalog.values(), key=lambda p: p["id"]),
        "interactions": interactions,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="ml/recommender/artifacts/dataset.json")
    parser.add_argument("--osm-seed", default="ml/recommender/artifacts/osm_places.jsonl")
    parser.add_argument("--trip-seed", default="ml/recommender/seeds/contextual_trip_seeds.json")
    parser.add_argument("--skip-db", action="store_true")
    args = parser.parse_args()

    rows: list[dict[str, Any]] = []
    if not args.skip_db:
        try:
            rows = fetch_mysql_rows()
            print(f"Loaded {len(rows)} plans from MySQL")
        except Exception as exc:
            print(f"MySQL unavailable, using bootstrap data: {exc}")

    dataset = build_from_rows(rows, load_osm_seed(Path(args.osm_seed)), load_trip_seeds(Path(args.trip_seed)))
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(dataset, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(dataset['interactions'])} interactions and {len(dataset['places'])} places to {output}")


if __name__ == "__main__":
    main()
