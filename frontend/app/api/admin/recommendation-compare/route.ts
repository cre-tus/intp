import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SeedPlace = { name: string; category?: string; lat: number; lon: number };
type SeedTrip = { trip_id?: string; places?: SeedPlace[] };
type StayLearningSample = { plan_id: string; plan_title: string; day: number; route: string[]; place_name: string; start_time: string; next_place_name: string; next_start_time: string; estimated_transit_minutes: number; observed_stay_minutes: number };
type Recommendation = SeedPlace & { score?: number; model_score?: number; distance_km?: number; distance_factor?: number; cluster_score?: number; cluster_advantage?: number; cluster_neighbor_count?: number; cluster_category_count?: number; day_cluster_qualified?: boolean; nearby_day_frequency_limit?: number; nearby_region_min_places?: number; nearby_region_min_attractions?: number; travel_time_penalty?: number; return_to_lodging_minutes?: number; reason?: string; learned_stay_minutes?: number; stay_sample_count?: number; stay_learning_samples?: StayLearningSample[]; transit_only?: boolean; source_category?: string; source_place_type?: string; ml_category?: string; category_trip_frequency_limit?: number; visit_time_sample_count?: number; preferred_start_minute?: number; preferred_end_minute?: number; preferred_visit_buckets?: string[]; category_visit_time_bucket_counts?: Record<string, number>; category_visit_time_sample_count?: number; schedule_start?: string; schedule_end?: string; stay_minutes?: number; travel_from_previous_minutes?: number; parent_place?: string; included_in_parent_stay?: boolean };
type GtfsLeg = { gtfs_transfer_count: number; gtfs_transit_minutes: number; gtfs_walk_km: number; gtfs_available: number };
type Sections = { before: Recommendation[]; between: Recommendation[]; after: Recommendation[] };
type TravelScope = "tokyo" | "greater_tokyo" | "kanto" | "japan";
type Features = { ageBucket: string; companionType: string; childAgeBucket: string; groupAgeBucket: string; month: string; season: string; rainySeason: boolean; includeNearbyTrips: boolean; hour: number; category: string; travelScope: TravelScope; maxDistanceKm: number; days: number };
type DayPreference = { day: number; category: string; nearby: boolean; nearbyDestination?: SeedPlace };
type DailyPlan = { day: number; label: string; items: Recommendation[]; nearbyDay?: boolean; arrivalDay?: boolean; arrivalTime?: string; departureDay?: boolean; departureTime?: string };
type TrainingStatus = { status: "idle" | "running" | "complete" | "failed"; phase?: string; startedAt?: string; finishedAt?: string; error?: string };
type NearbyDestination = SeedPlace & { plan_day_count?: number; place_count?: number; attraction_count?: number; travelTimeLabel?: string };
type NearbyDayProfile = { schedule_limit?: number; nearby_day_rate?: number; expected_count?: number; destinations?: NearbyDestination[] };
type TransitStop = { name?: string; distanceMeters?: number };
type AirportOption = SeedPlace & { visitCount: number; popularity?: number };
type TrainingPlanStats = { operating: number; pending: number; candidateTotal: number };
type MlStatus = { ok: boolean; trainedPlaces: number; trainedCategories: number; standardPlacesPerDay: number; nearbyDayFrequencyByTripDays: Record<string, NearbyDayProfile>; airportOptions: AirportOption[]; trainingPlanStats: TrainingPlanStats; lastTrainedAt: string | null; training: TrainingStatus };

const ML_URL = process.env.ML_RECOMMENDER_URL ?? "http://127.0.0.1:8091";
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_TEXT_MODEL ?? process.env.OLLAMA_MODEL ?? "qwen3-vl:8b-instruct";
const OLLAMA_NUM_THREAD = Math.min(Math.max(Number(process.env.OLLAMA_NUM_THREAD ?? 8), 1), 16);

export async function GET(request: NextRequest) {
    if (!await isAdminRequest(request)) return NextResponse.json({ message: "관리자 권한이 필요합니다." }, { status: 403 });
    try {
        return NextResponse.json(await loadMlStatus());
    } catch (error) {
        const message = error instanceof Error ? error.message : "ML 모델 상태를 불러오지 못했습니다.";
        return NextResponse.json({ ok: false, trainedPlaces: 0, trainedCategories: 0, standardPlacesPerDay: 4, nearbyDayFrequencyByTripDays: {}, airportOptions: [], trainingPlanStats: { operating: 0, pending: 0, candidateTotal: 0 }, lastTrainedAt: null, training: { status: "idle" }, message }, { status: 503 });
    }
}

export async function POST(request: NextRequest) {
    if (!await isAdminRequest(request)) return NextResponse.json({ message: "관리자 권한이 필요합니다." }, { status: 403 });
    try {
        const body = await request.json() as { action?: string; mode?: "multiday" | "point_to_point"; from?: SeedPlace; to?: SeedPlace; hotel?: SeedPlace; arrivalAirport?: SeedPlace; departureAirport?: SeedPlace; nearbyDestination?: SeedPlace; dayPreferences?: DayPreference[]; features?: Partial<Features>; limit?: number };
        if (body.action === "train") return NextResponse.json(await startMlTraining(), { status: 202 });
        const mlStatus = await loadMlStatus().catch(() => ({ ok: true, trainedPlaces: 0, trainedCategories: 0, standardPlacesPerDay: 4, nearbyDayFrequencyByTripDays: {}, airportOptions: [], trainingPlanStats: { operating: 0, pending: 0, candidateTotal: 0 }, lastTrainedAt: null, training: { status: "idle" as const } }));
        const hotel = validInputPlace(body.hotel);
        const requestedNearbyDestination = validInputPlace(body.nearbyDestination);
        const datasetAirport = (value?: SeedPlace) => mlStatus.airportOptions.find((airport) => value && airport.name === value.name && Math.abs(airport.lat - value.lat) < 0.00001 && Math.abs(airport.lon - value.lon) < 0.00001) ?? null;
        const pointToPoint = body.mode === "point_to_point";
        const defaultAirport = mlStatus.airportOptions[0] ?? null;
        if (!pointToPoint && !defaultAirport) throw new Error("현재 학습 데이터셋에 선택 가능한 공항이 없습니다.");
        const arrivalAirport = datasetAirport(body.arrivalAirport) ?? defaultAirport;
        const departureAirport = datasetAirport(body.departureAirport) ?? defaultAirport;

        const from = pointToPoint ? validInputPlace(body.from) : arrivalAirport;
        const to = pointToPoint ? validInputPlace(body.to) : departureAirport;
        if (!from || !to) throw new Error(pointToPoint ? "출발지와 도착지를 선택하세요." : "입국 공항과 출국 공항을 선택하세요.");
        const maxLimit = pointToPoint ? 20 : 15;
        const limit = Math.min(Math.max(body.limit ?? 5, 1), maxLimit);
        const features = normalizeFeatures(body.features);
        const dayPreferences = normalizeDayPreferences(body.dayPreferences, features.days);
        const nearbyOrigin = hotel ?? { name: "Tokyo Station", lat: 35.681236, lon: 139.767125 };
        const learnedDestinations = Array.from(Object.values(mlStatus.nearbyDayFrequencyByTripDays)
            .flatMap((profile) => profile.destinations ?? [])
            .reduce((regions, destination) => {
                const key = destination.name.trim().toLocaleLowerCase();
                const current = regions.get(key);
                if (!current || Number(destination.plan_day_count ?? 0) > Number(current.plan_day_count ?? 0)) regions.set(key, destination);
                return regions;
            }, new globalThis.Map<string, NearbyDestination>())
            .values())
            .filter((destination) => distanceKm(nearbyOrigin, destination) >= 25 && distanceKm(nearbyOrigin, destination) <= 180)
            .sort((a, b) => Number(b.plan_day_count ?? 0) - Number(a.plan_day_count ?? 0));
        const explicitNearbyDestinations = dayPreferences
            .filter((preference) => preference.nearby)
            .map((preference) => validInputPlace(preference.nearbyDestination))
            .filter((place): place is SeedPlace => place !== null);
        const nearbyDestination = requestedNearbyDestination ?? explicitNearbyDestinations[0] ?? (features.includeNearbyTrips ? validInputPlace(learnedDestinations[0]) : null);

        const trips = await loadTrips();
        const allPlaces = uniquePlaces(trips.flatMap((trip) => trip.places ?? []));

        const started = Date.now();
        const center = hotel ?? { lat: (from.lat + to.lat) / 2, lon: (from.lon + to.lon) / 2 };
        const candidateCount = pointToPoint
            ? limit * 6
            : Math.min(240, limit * Math.max(features.days, 2) * 4);
        const categoryCounts = dayPreferences.reduce<Record<string, number>>((counts, preference) => {
            if (preference.category !== "any") counts[preference.category] = (counts[preference.category] ?? 0) + 1;
            return counts;
        }, {});
        const categoryTotal = Object.values(categoryCounts).reduce((sum, count) => sum + count, 0);
        const tripCategoryPreferences = Object.fromEntries(Object.entries(categoryCounts).map(([category, count]) => [category, count / Math.max(1, categoryTotal)]));
        const baseParams = { lat: String(center.lat), lon: String(center.lon), top_k: String(candidateCount), max_distance_km: String(features.maxDistanceKm), age_bucket: features.ageBucket, companion_type: features.companionType, child_age_bucket: features.childAgeBucket, group_age_bucket: features.groupAgeBucket, month: features.month, season: features.season, rainy_season: features.rainySeason ? "1" : "0", hour: String(features.hour), selected_category: features.category, strict_category: pointToPoint ? "1" : "0", days: String(features.days), trip_category_preferences: JSON.stringify(tripCategoryPreferences) };

        const fetchModelAt = async (modelType: string, requestCenter: { lat: number; lon: number }, requestDistanceKm: number, topK = candidateCount, strictCategory?: boolean, requestBase = baseParams) => {
            try {
                const params = new URLSearchParams({ ...requestBase, lat: String(requestCenter.lat), lon: String(requestCenter.lon), max_distance_km: String(requestDistanceKm), top_k: String(topK), model_type: modelType, strict_category: strictCategory === undefined ? requestBase.strict_category : strictCategory ? "1" : "0" });
                const resp = await fetch(`${ML_URL}/recommend?${params}`, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
                if (!resp.ok) return [];
                const payload = await resp.json() as { items?: Recommendation[] };
                return (payload.items ?? []).filter((item) => item.name);
            } catch {
                return [];
            }
        };
        const fetchModel = async (modelType: string) => {
            const requestedCategories = Array.from(new Set([features.category, ...dayPreferences.map((preference) => preference.category)]))
                .filter((category) => category !== "any");
            // GNN inference is considerably heavier than MLP/cosine inference. Running
            // its base, strict-category and nearby queries concurrently can exhaust the
            // worker timeout and turn every response into an empty candidate list.
            // Always secure the base catalog first, then serialize GNN supplements.
            let primary = await fetchModelAt(modelType, center, features.maxDistanceKm);
            if (modelType === "gnn" && primary.length === 0) {
                primary = await fetchModelAt(modelType, center, features.maxDistanceKm, Math.max(40, Math.min(candidateCount, 120)));
            }
            const fetchCategory = (category: string) => {
                    const params = { ...baseParams, selected_category: category };
                    return fetchModelAt(modelType, center, features.maxDistanceKm, Math.max(40, features.days * 8), true, params);
            };
            let exactCategories: Recommendation[][];
            let nearbyCatalogs: Recommendation[][];
            if (modelType === "gnn") {
                exactCategories = [];
                for (const category of requestedCategories) exactCategories.push(await fetchCategory(category));
                nearbyCatalogs = [];
                for (const destination of explicitNearbyDestinations) {
                    nearbyCatalogs.push(await fetchModelAt(modelType, destination, 30, Math.min(1000, Math.max(200, mlStatus.trainedPlaces))));
                }
            } else {
                [exactCategories, nearbyCatalogs] = await Promise.all([
                    Promise.all(requestedCategories.map(fetchCategory)),
                    Promise.all(explicitNearbyDestinations.map((destination) => fetchModelAt(modelType, destination, 30, Math.min(1000, Math.max(200, mlStatus.trainedPlaces))))),
                ]);
            }
            const combinedPrimary = uniquePlaces([...exactCategories.flat(), ...primary]) as Recommendation[];
            const explicitNearby = nearbyCatalogs.flatMap((catalog, index) => catalog.filter((item) => distanceKm(item, explicitNearbyDestinations[index]) <= 15));
            if (explicitNearby.length > 0) return uniquePlaces([...combinedPrimary, ...explicitNearby]) as Recommendation[];
            if (!features.includeNearbyTrips || !nearbyDestination) return combinedPrimary;
            // GNN may rank many 15-30 km candidates above the selected city's local POIs.
            // Retrieve the full trained catalog, then spatially constrain the explicit region;
            // model scores still rank candidates within that region.
            const nearbyCatalog = await fetchModelAt(modelType, nearbyDestination, 30, Math.min(1000, Math.max(200, mlStatus.trainedPlaces)));
            const nearby = nearbyCatalog.filter((item) => distanceKm(item, nearbyDestination) <= 15);
            return uniquePlaces([...combinedPrimary, ...nearby]) as Recommendation[];
        };

        const [cosineItems, mlpItems, gnnItems] = await Promise.all([
            fetchModel("cosine"),
            fetchModel("mlp"),
            fetchModel("gnn"),
        ]);

        const [cosineSec, mlpSec, gnnSec] = await Promise.all([
            pointToPoint ? Promise.resolve(pointToPointCandidates(cosineItems, from, to, limit)) : classify(cosineItems, from, to, limit, features.days, hotel, features.category, features.includeNearbyTrips, nearbyDestination, dayPreferences),
            pointToPoint ? Promise.resolve(pointToPointCandidates(mlpItems, from, to, limit)) : classify(mlpItems, from, to, limit, features.days, hotel, features.category, features.includeNearbyTrips, nearbyDestination, dayPreferences),
            pointToPoint ? Promise.resolve(pointToPointCandidates(gnnItems, from, to, limit)) : classify(gnnItems, from, to, limit, features.days, hotel, features.category, features.includeNearbyTrips, nearbyDestination, dayPreferences),
        ]);
        const totalMs = Date.now() - started;

        return NextResponse.json({
            query: { from, to, hotel, features, mode: body.mode ?? "multiday" },
            cosine: { model: "Cosine Vector Baseline", durationMs: totalMs, sections: cosineSec },
            ml: { model: "Travel Recommender MLP", durationMs: totalMs, sections: mlpSec },
            gnn: { model: "GNN + MLP Hybrid Model", durationMs: totalMs, sections: gnnSec },
            dataset: { trips: trips.length, places: allPlaces.length, trainedPlaces: mlStatus.trainedPlaces, trainedCategories: mlStatus.trainedCategories }
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "비교 실행 중 오류가 발생했습니다.";
        return NextResponse.json({ message }, { status: 500 });
    }
}

function pointToPointCandidates(items: Recommendation[], from: SeedPlace, to: SeedPlace, limit: number): Sections {
    const directDistance = Math.max(distanceKm(from, to), 0.5);
    const dx = to.lon - from.lon;
    const dy = to.lat - from.lat;
    const length2 = dx * dx + dy * dy || 1;

    const eligible = items
        .filter((item) => {
            if (item.transit_only) return false;
            if (isNonVisitArea(item)) return false;
            if (normalize(item.name) === normalize(from.name) || normalize(item.name) === normalize(to.name)) return false;
            return true;
        })
        .map((item) => {
            const progress = ((item.lon - from.lon) * dx + (item.lat - from.lat) * dy) / length2;
            const detourKm = Math.max(0, distanceKm(from, item) + distanceKm(item, to) - directDistance);
            const detourPenalty = 1 / (1 + detourKm / Math.max(directDistance, 1));
            return {
                ...item,
                progress,
                detourKm,
                score: typeof item.score === "number" ? item.score * detourPenalty : item.score,
                reason: `A→후보→B 단일 경유 후보 · 추가 이동 약 ${detourKm.toFixed(1)}km`,
            };
        });
    const onSegment = eligible.filter((item) => item.progress >= 0 && item.progress <= 1);
    const candidates = (onSegment.length >= limit ? onSegment : eligible)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, limit);

    return { before: [], between: candidates, after: [] };
}

const NON_VISIT_AREA_TYPES = new Set([
    "administrative", "borough", "city", "city_block", "county", "district",
    "hamlet", "island", "municipality", "neighbourhood", "province", "quarter",
    "region", "state", "suburb", "town", "village", "construction",
]);

function isNonVisitArea(item: Recommendation): boolean {
    const category = (item.category ?? "place").trim().toLowerCase();
    const sourceCategory = (item.source_category ?? "").trim().toLowerCase();
    const sourceType = (item.source_place_type ?? "").trim().toLowerCase();
    const mlCategory = (item.ml_category ?? "").trim().toLowerCase();
    return sourceCategory === "boundary"
        || mlCategory.startsWith("boundary/")
        || NON_VISIT_AREA_TYPES.has(sourceType)
        || (category === "place" && ((sourceCategory === "place" && ["", "unknown"].includes(sourceType)) || sourceCategory === "landuse"))
        || (category === "place" && ["place/unknown", "derived/place"].includes(mlCategory));
}

async function loadMlStatus(): Promise<MlStatus> {
    const response = await fetch(`${ML_URL.replace(/\/$/, "")}/health`, { cache: "no-store", signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new Error(`ML 모델 상태 응답 오류 (${response.status})`);
    const payload = await response.json() as Partial<MlStatus>;
    const status: MlStatus = {
        ok: payload.ok === true,
        trainedPlaces: Math.max(0, Number(payload.trainedPlaces ?? 0)),
        trainedCategories: Math.max(0, Number(payload.trainedCategories ?? 0)),
        standardPlacesPerDay: Math.min(15, Math.max(1, Number(payload.standardPlacesPerDay ?? 4))),
        nearbyDayFrequencyByTripDays: payload.nearbyDayFrequencyByTripDays ?? {},
        airportOptions: payload.airportOptions ?? [],
        trainingPlanStats: payload.trainingPlanStats ?? { operating: 0, pending: 0, candidateTotal: 0 },
        lastTrainedAt: payload.lastTrainedAt ?? null,
        training: payload.training ?? { status: "idle" },
    };
    return await labelNearbyDestinationsWithGtfs(status);
}

const ADMINISTRATIVE_REGION_NAMES = new Set([
    "도쿄", "요코하마", "가마쿠라", "에노시마", "가와사키", "사이타마", "치바",
    "하코네·오다와라", "닛코", "가와고에", "타카오", "가마쿠라·에노시마", "지치부·나가토로", "요코스카",
    "시즈오카·후지산",
]);

const FAMOUS_NEARBY_DESTINATIONS: Array<NearbyDestination & { bounds: [number, number, number, number] }> = [
    { name: "요코하마", lat: 35.455, lon: 139.635, travelTimeLabel: "약 30~40분", bounds: [35.38, 35.60, 139.45, 139.75] },
    { name: "가마쿠라·에노시마", lat: 35.310, lon: 139.520, travelTimeLabel: "약 1시간~1시간 10분", bounds: [35.28, 35.37, 139.46, 139.59] },
    { name: "가와고에", lat: 35.925, lon: 139.485, travelTimeLabel: "약 40~60분", bounds: [35.86, 35.96, 139.40, 139.55] },
    { name: "하코네·오다와라", lat: 35.240, lon: 139.100, travelTimeLabel: "약 1시간~1시간 30분", bounds: [35.17, 35.31, 138.96, 139.23] },
    { name: "가와구치코", lat: 35.517, lon: 138.755, travelTimeLabel: "약 2시간", bounds: [35.47, 35.55, 138.70, 138.83] },
    { name: "닛코", lat: 36.758, lon: 139.598, travelTimeLabel: "약 2시간", bounds: [36.68, 36.84, 139.45, 139.68] },
    { name: "다카오산", lat: 35.625, lon: 139.243, travelTimeLabel: "약 50~60분", bounds: [35.60, 35.68, 139.18, 139.32] },
    { name: "지치부·나가토로", lat: 36.045, lon: 139.100, travelTimeLabel: "약 1시간 30분~2시간", bounds: [35.90, 36.14, 138.90, 139.22] },
    { name: "오쿠타마", lat: 35.809, lon: 139.096, travelTimeLabel: "약 2시간", bounds: [35.75, 35.86, 138.98, 139.16] },
    { name: "미타케산", lat: 35.783, lon: 139.149, travelTimeLabel: "약 1시간 30분~2시간", bounds: [35.77, 35.82, 139.13, 139.20] },
    { name: "아타미", lat: 35.103, lon: 139.078, travelTimeLabel: "신칸센 약 40~50분", bounds: [35.07, 35.14, 139.04, 139.12] },
    { name: "이즈반도", lat: 34.910, lon: 138.930, travelTimeLabel: "약 2시간 이상", bounds: [34.55, 35.07, 138.75, 139.20] },
    { name: "사와라", lat: 35.897, lon: 140.499, travelTimeLabel: "약 1시간 30분", bounds: [35.87, 35.93, 140.47, 140.53] },
    { name: "나리타", lat: 35.783, lon: 140.318, travelTimeLabel: "약 1시간", bounds: [35.72, 35.84, 140.25, 140.42] },
    { name: "미우라반도", lat: 35.178, lon: 139.630, travelTimeLabel: "약 1시간 30분", bounds: [35.12, 35.32, 139.60, 139.75] },
    { name: "노코기리산", lat: 35.160, lon: 139.840, travelTimeLabel: "약 2시간", bounds: [35.14, 35.20, 139.82, 139.88] },
    { name: "츠쿠바산", lat: 36.225, lon: 140.106, travelTimeLabel: "약 1시간 30분~2시간", bounds: [36.17, 36.28, 140.05, 140.18] },
    { name: "가루이자와", lat: 36.348, lon: 138.635, travelTimeLabel: "신칸센 약 1시간", bounds: [36.30, 36.40, 138.55, 138.70] },
    { name: "시즈오카·후지산", lat: 35.100, lon: 138.610, travelTimeLabel: "신칸센·현지 이동 약 1시간 30분~2시간", bounds: [34.85, 35.55, 138.10, 139.00] },
];

async function labelNearbyDestinationsWithGtfs(status: MlStatus): Promise<MlStatus> {
    const destinations = Object.values(status.nearbyDayFrequencyByTripDays)
        .flatMap(profile => profile.destinations ?? []);
    const labels = new Map<string, string>();
    destinations.forEach(destination => {
        const region = famousTravelRegion(destination.lat, destination.lon);
        if (region) labels.set(coordinateKey(destination), region);
    });
    const unresolved = destinations.filter(destination =>
        !labels.has(coordinateKey(destination))
        && !ADMINISTRATIVE_REGION_NAMES.has(destination.name.trim())
    );
    await Promise.all(unresolved.map(async destination => {
        const stop = await nearestGtfsStop(destination.lat, destination.lon);
        if (!stop?.name || Number(stop.distanceMeters ?? Number.POSITIVE_INFINITY) > 5_000) return;
        labels.set(coordinateKey(destination), stationRegionName(stop.name));
    }));
    return {
        ...status,
        nearbyDayFrequencyByTripDays: Object.fromEntries(
            Object.entries(status.nearbyDayFrequencyByTripDays).map(([days, profile]) => [days, {
                ...profile,
                destinations: Array.from([
                    ...(profile.destinations ?? []).map(destination => ({
                        ...destination,
                        name: labels.get(coordinateKey(destination)) ?? destination.name,
                    })),
                    ...FAMOUS_NEARBY_DESTINATIONS.map(({ bounds: _bounds, ...destination }) => ({
                        ...destination,
                        plan_day_count: destination.plan_day_count ?? 0,
                    })),
                ].reduce((items, destination) => {
                    const current = items.get(destination.name);
                    if (!current || Number(destination.plan_day_count ?? 0) > Number(current.plan_day_count ?? 0)) {
                        items.set(destination.name, destination);
                    }
                    return items;
                }, new Map<string, NearbyDestination>()).values()),
            }]),
        ),
    };
}

async function nearestGtfsStop(lat: number, lon: number): Promise<TransitStop | null> {
    const params = new URLSearchParams({ lat: String(lat), lon: String(lon), radiusMeters: "5000", limit: "1" });
    for (const baseUrl of backendBaseUrls()) {
        try {
            const response = await fetch(`${baseUrl}/api/routes/stops/nearby?${params}`, {
                cache: "no-store",
                signal: AbortSignal.timeout(3_000),
            });
            if (!response.ok) continue;
            const payload = await response.json() as { stops?: TransitStop[] };
            if (payload.stops?.[0]) return payload.stops[0];
        } catch { /* try the next backend address */ }
    }
    return null;
}

function famousTravelRegion(lat: number, lon: number): string | null {
    return FAMOUS_NEARBY_DESTINATIONS.find(({ bounds: [minLat, maxLat, minLon, maxLon] }) =>
        lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon
    )?.name ?? null;
}

function stationRegionName(rawName: string): string {
    const name = rawName.trim().replace(/\s+/g, " ");
    if (/(역|駅|station)$/i.test(name)) return `${name} 인근`;
    return `${name}역 인근`;
}

function coordinateKey(place: Pick<SeedPlace, "lat" | "lon">): string {
    return `${place.lat.toFixed(5)},${place.lon.toFixed(5)}`;
}

function backendBaseUrls(): string[] {
    return [process.env.BACKEND_INTERNAL_URL, "http://backend:8080", "http://localhost:8080"]
        .filter((value): value is string => Boolean(value));
}

async function startMlTraining(): Promise<MlStatus & { started: boolean }> {
    const token = process.env.ML_TRAIN_TOKEN;
    if (!token) throw new Error("ML 학습 토큰이 설정되지 않았습니다.");
    const response = await fetch(`${ML_URL.replace(/\/$/, "")}/train`, {
        method: "POST",
        headers: { "X-ML-Admin-Token": token },
        cache: "no-store",
        signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`ML 학습 시작 오류 (${response.status})`);
    return await response.json() as MlStatus & { started: boolean };
}

async function isAdminRequest(request: NextRequest) {
    const cookie = request.headers.get("cookie");
    if (!cookie) return false;
    for (const baseUrl of backendBaseUrls()) {
        try {
            const response = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie }, cache: "no-store", signal: AbortSignal.timeout(3_000) });
            if (!response.ok) continue;
            const me = await response.json() as { role?: string };
            return me.role === "ADMIN";
        } catch { /* try the next backend address */ }
    }
    return false;
}

async function loadTrips(): Promise<SeedTrip[]> {
    const candidates = [path.join(process.cwd(), "..", "ml", "recommender", "seeds", "contextual_trip_seeds.json"), path.join(process.cwd(), "ml", "recommender", "seeds", "contextual_trip_seeds.json")];
    for (const file of candidates) {
        try { return JSON.parse(await readFile(file, "utf8")) as SeedTrip[]; } catch { /* try next path */ }
    }
    throw new Error("추천 데이터셋을 읽을 수 없습니다.");
}

function normalize(value: string) { return value.toLocaleLowerCase().replace(/[\s·・_'’\-()]/g, ""); }
function validInputPlace(place?: SeedPlace): SeedPlace | null { return place?.name?.trim() && Number.isFinite(place.lat) && Number.isFinite(place.lon) ? { name: place.name.trim(), category: place.category, lat: Number(place.lat), lon: Number(place.lon) } : null; }
function isInJapan(place: SeedPlace) { const inJapanBounds = place.lat >= 24 && place.lat <= 46 && place.lon >= 122 && place.lon <= 146; const inKoreaBounds = place.lat >= 33 && place.lat <= 39 && place.lon >= 124 && place.lon <= 129.1; return inJapanBounds && !inKoreaBounds; }
function normalizeFeatures(value?: Partial<Features>): Features {
    const requestedScope = value?.travelScope ?? "greater_tokyo";
    const travelScope: TravelScope = ["tokyo", "greater_tokyo", "kanto", "japan"].includes(requestedScope)
        ? requestedScope as TravelScope
        : "greater_tokyo";
    const scopeDistanceKm: Record<TravelScope, number> = {
        tokyo: 35,
        greater_tokyo: 90,
        kanto: 220,
        japan: 1500,
    };
    return { ageBucket: value?.ageBucket ?? "unknown", companionType: value?.companionType ?? "unknown", childAgeBucket: value?.childAgeBucket ?? "unknown", groupAgeBucket: value?.groupAgeBucket ?? "unknown", month: value?.month ?? "unknown", season: value?.season ?? "unknown", rainySeason: Boolean(value?.rainySeason), includeNearbyTrips: Boolean(value?.includeNearbyTrips), hour: Math.min(Math.max(Number(value?.hour ?? 14), 0), 23), category: value?.category ?? "any", travelScope, maxDistanceKm: scopeDistanceKm[travelScope], days: Math.min(Math.max(Number(value?.days ?? 1), 1), 14) };
}
function normalizeDayPreferences(values: DayPreference[] | undefined, days: number): DayPreference[] {
    const byDay = new globalThis.Map((values ?? []).map((value) => [Number(value.day), value]));
    return Array.from({ length: days }, (_, index) => {
        const day = index + 1;
        const value = byDay.get(day);
        return {
            day,
            category: typeof value?.category === "string" && value.category ? value.category : "any",
            nearby: Boolean(value?.nearby),
            nearbyDestination: validInputPlace(value?.nearbyDestination) ?? undefined,
        };
    });
}
function uniquePlaces(places: SeedPlace[]) { return Array.from(new Map(places.filter((p) => p.name && Number.isFinite(p.lat) && Number.isFinite(p.lon)).map((p) => [normalize(p.name), p])).values()); }
function findPlace(places: SeedPlace[], query: string) { const q = normalize(query); return places.find((p) => normalize(p.name) === q) ?? places.find((p) => normalize(p.name).includes(q) || q.includes(normalize(p.name))); }

function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) { const toRad = (value: number) => value * Math.PI / 180; const dLat = toRad(b.lat - a.lat); const dLon = toRad(b.lon - a.lon); const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2; return 6371.0088 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)); }

function isThemePark(item: Recommendation): boolean {
    const cat = (item.category ?? "").toLowerCase();
    const name = (item.name ?? "").toLowerCase();
    // Long-stay scheduling is category-driven. A loose name match must never turn a PLACE/SHOPPING row into a theme park.
    if (cat !== "theme_park" && !cat.includes("amusement")) return false;
    if ((item.stay_sample_count ?? 0) > 0) return (item.learned_stay_minutes ?? 0) >= 180;
    return (
        name.includes("디즈니") ||
        name.includes("disney") ||
        name.includes("유니버설") ||
        name.includes("universal") ||
        name.includes("지브리") ||
        name.includes("해리포터") ||
        name.includes("후지큐") ||
        name.includes("산리오") ||
        name.includes("키자니아") ||
        name.includes("레고랜드")
    );
}

function isTokyoDisneyland(item: SeedPlace): boolean {
    const name = normalize(item.name);
    return name.includes("도쿄디즈니랜드") || name.includes("tokyodisneyland");
}

function isTokyoDisneylandEmbeddedVenue(item: SeedPlace): boolean {
    const name = normalize(item.name);
    return [
        "셔우드가든", "sherwoodgarden",
        "hungrybearrestaurant", "헝그리베어레스토랑",
        "퀸오브하트의뱅큇홀", "queenofheartsbanquethall",
    ].some((token) => name.includes(token));
}

function attachTokyoDisneylandVenues(items: Recommendation[], embedded: Recommendation[]): Recommendation[] {
    const parentIndex = items.findIndex(isTokyoDisneyland);
    if (parentIndex < 0 || embedded.length === 0) return items;
    const parent = items[parentIndex];
    const children = embedded.map((item) => ({
        ...item,
        schedule_start: parent.schedule_start,
        schedule_end: parent.schedule_end,
        stay_minutes: 0,
        travel_from_previous_minutes: 0,
        parent_place: parent.name,
        included_in_parent_stay: true,
        reason: `도쿄디즈니랜드 내부 시설 · ${parent.name} 체류시간에 포함`,
    }));
    return [...items.slice(0, parentIndex + 1), ...children, ...items.slice(parentIndex + 1)];
}

function formatMinute(value: number): string {
    return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function categoryTimeAdjustment(item: Recommendation, minute: number): number {
    if (!["viewpoint", "shopping"].includes(item.category ?? "")) return 0;
    const counts = item.category_visit_time_bucket_counts ?? {};
    const sampleCount = Number(item.category_visit_time_sample_count ?? 0);
    if (sampleCount < 10) return 0;
    const hour = Math.floor(minute / 60);
    const bucket = hour >= 5 && hour < 11 ? "morning"
        : hour < 14 ? "lunch"
        : hour < 18 ? "afternoon"
        : hour < 22 ? "evening"
        : "night";
    const observedRate = Number(counts[bucket] ?? 0) / sampleCount;
    // Relative to an even 20% distribution: learned popular periods receive an
    // advantage and rare periods a penalty, capped so route feasibility still wins.
    return Math.max(-0.30, Math.min(0.30, (observedRate - 0.20) * 1.25));
}

function defaultStayMinutes(item: Recommendation): number {
    const category = (item.category ?? "place").toLowerCase();
    const defaults: Record<string, number> = { aquarium: 150, restaurant: 70, cafe: 55, information: 20, shopping: 90, museum: 110, park: 90, landmark: 80, viewpoint: 80, place: 80, sports: 120, theme_park: 300, zoo: 180 };
    return Math.min(720, Math.max(20, item.learned_stay_minutes ?? defaults[category] ?? 80));
}

function categoryVisitWindow(item: Recommendation): { start: number; end: number } {
    const category = (item.category ?? "place").toLowerCase();
    const defaults: Record<string, [number, number]> = {
        aquarium: [9 * 60, 19 * 60], restaurant: [7 * 60, 23 * 60], cafe: [8 * 60, 22 * 60], information: [9 * 60, 17 * 60], kid_museum: [9 * 60, 18 * 60],
        landmark: [9 * 60, 21 * 60], museum: [9 * 60, 18 * 60], park: [8 * 60, 19 * 60],
        place: [9 * 60, 20 * 60], shopping: [10 * 60, 21 * 60], sports: [9 * 60, 21 * 60],
        theme_park: [9 * 60, 21 * 60], viewpoint: [9 * 60, 22 * 60], zoo: [9 * 60, 17 * 60],
    };
    const [start, end] = defaults[category] ?? defaults.place;
    return { start, end };
}

function visitWindow(item: Recommendation): { start: number; end: number; closingEnd: number; learned: boolean } {
    const categoryWindow = categoryVisitWindow(item);
    const sampleCount = Number(item.visit_time_sample_count ?? 0);
    const learnedStart = Number(item.preferred_start_minute);
    const learnedEnd = Number(item.preferred_end_minute);
    if (sampleCount >= 3 && Number.isFinite(learnedStart) && Number.isFinite(learnedEnd) && learnedEnd > learnedStart) {
        return { start: learnedStart, end: learnedEnd, closingEnd: categoryWindow.end, learned: true };
    }
    return { ...categoryWindow, closingEnd: categoryWindow.end, learned: false };
}

async function loadGtfsLegs(origin: SeedPlace, items: Recommendation[]): Promise<GtfsLeg[]> {
    if (items.length === 0) return [];
    const points: SeedPlace[] = [origin, ...items];
    try {
        const response = await fetch(`${ML_URL.replace(/\/$/, "")}/travel-times`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ legs: items.map((_, index) => ({ fromLat: points[index].lat, fromLon: points[index].lon, toLat: points[index + 1].lat, toLon: points[index + 1].lon })) }),
            cache: "no-store",
            signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) return [];
        return ((await response.json()) as { items?: GtfsLeg[] }).items ?? [];
    } catch {
        return [];
    }
}

async function scheduleChronologically(items: Recommendation[], origin: SeedPlace, endMinute = 21 * 60, dense = false, maxItems = items.length, limitedCategory?: string, categorySlots = Number.POSITIVE_INFINITY, startMinute = 9 * 60, returnDestination?: SeedPlace, destinationArrivalBufferMinutes = 0): Promise<{ scheduled: Recommendation[]; overflow: Recommendation[] }> {
    const scheduled: Recommendation[] = [];
    const overflow: Recommendation[] = [];
    // This generated order is also the order rendered on the route map.
    const orderedItems = orderForTravelEfficiency(items, origin, limitedCategory, startMinute);
    const gtfsLegs = await loadGtfsLegs(origin, orderedItems);
    let cursor = startMinute;
    let previous: SeedPlace = origin;
    let scheduledCategoryCount = 0;
    let scheduledRestaurantCount = 0;
    for (let index = 0; index < orderedItems.length; index++) {
        let item = orderedItems[index];
        let sequenceReordered = false;
        const previousScheduledCategory = scheduled.at(-1)?.category;
        if (item.category && previousScheduledCategory === item.category) {
            // Earlier candidates may have failed their time window after the initial
            // route ordering. Re-rank against the actually confirmed itinerary and
            // insert a different category when one remains. This is still a penalty
            // policy: the same category is allowed when no feasible alternative exists.
            const alternativeIndex = orderedItems.findIndex((candidate, candidateIndex) =>
                candidateIndex > index && candidate.category !== previousScheduledCategory
            );
            if (alternativeIndex > index) {
                const [alternative] = orderedItems.splice(alternativeIndex, 1);
                orderedItems.splice(index, 0, alternative);
                item = alternative;
                sequenceReordered = true;
            }
        }
        if (scheduled.length >= maxItems) { overflow.push(item); continue; }
        if (item.category === "restaurant" && scheduledRestaurantCount >= 3) {
            overflow.push(item);
            continue;
        }
        if (limitedCategory && item.category === limitedCategory && scheduledCategoryCount >= categorySlots) {
            overflow.push(item);
            continue;
        }
        let gtfs = sequenceReordered ? (await loadGtfsLegs(previous, [item]))[0] : gtfsLegs[index];
        // Once an earlier candidate overflows, the actual previous stop differs from
        // the preloaded consecutive leg. Refresh that leg so the timetable remains exact.
        if (index > 0 && previous !== orderedItems[index - 1]) {
            gtfs = (await loadGtfsLegs(previous, [item]))[0];
        }
        const fallbackMinutes = Math.max(10, Math.ceil(distanceKm(previous, item) / 25 * 60 + 8));
        // Maximum mode still keeps a realistic buffer: GTFS estimate + 15%, at least 5 minutes.
        const travelMinutes = gtfs?.gtfs_available
            ? Math.max(10, Math.ceil(gtfs.gtfs_transit_minutes * 1.15 + 5))
            : fallbackMinutes;
        const remoteEntryExempt = index === 0 && item.day_cluster_qualified === true;
        const excessTravelMinutes = Math.max(0, travelMinutes - 30);
        const travelTimePenalty = remoteEntryExempt ? 0 : excessTravelMinutes * 0.008 + Math.max(0, travelMinutes - 60) * 0.006;
        const repeatsPreviousCategory = Boolean(item.category && scheduled.at(-1)?.category === item.category);
        const consecutiveCategoryPenalty = repeatsPreviousCategory
            ? (["restaurant", "cafe"].includes(item.category ?? "") ? 0.8 : 0.45)
            : 0;
        const window = visitWindow(item);
        let start = Math.max(cursor + travelMinutes, window.start);
        if (item.category === "restaurant" && scheduledRestaurantCount === 0 && start < 11 * 60) start = 11 * 60;
        if (item.category === "restaurant" && scheduledRestaurantCount === 1 && start < 17 * 60) start = 17 * 60;
        if (isThemePark(item)) start = Math.max(start, 10 * 60);
        const stayMinutes = defaultStayMinutes(item);
        const end = start + stayMinutes;
        const missedLearnedStartWindow = window.learned && start >= window.end;
        let destinationTravelMinutes = 0;
        if (returnDestination && destinationArrivalBufferMinutes > 0) {
            const destinationLeg = (await loadGtfsLegs(item, [returnDestination as Recommendation]))[0];
            destinationTravelMinutes = destinationLeg?.gtfs_available
                ? Math.max(10, Math.ceil(destinationLeg.gtfs_transit_minutes * 1.15 + 5))
                : Math.max(10, Math.ceil(distanceKm(item, returnDestination) / 25 * 60 + 8));
        }
        const mustLeaveBy = endMinute - destinationTravelMinutes - destinationArrivalBufferMinutes;
        if (missedLearnedStartWindow || end > Math.min(mustLeaveBy, window.closingEnd)) {
            overflow.push(item);
            continue;
        }
        const scheduledRestaurantHours = scheduled
            .filter((candidate) => candidate.category === "restaurant")
            .map((candidate) => Number(candidate.schedule_start?.slice(0, 2) ?? -1));
        const isLunchRestaurant = item.category === "restaurant" && start >= 11 * 60 && start < 15 * 60;
        const isDinnerRestaurant = item.category === "restaurant" && start >= 17 * 60 && start < 21 * 60;
        const hasLunchRestaurant = scheduledRestaurantHours.some((hour) => hour >= 11 && hour < 15);
        const mealCombinationAdvantage = isDinnerRestaurant && hasLunchRestaurant
            ? 0.45
            : isLunchRestaurant
                ? 0.30
                : isDinnerRestaurant
                    ? 0.25
                    : item.category === "restaurant" && scheduledRestaurantCount < 2
                        ? 0.08
                        : 0;
        const cafeSequenceAdjustment = item.category !== "cafe"
            ? 0
            : scheduled.at(-1)?.category === "restaurant"
                ? 0.30
                : scheduledRestaurantCount === 0
                    ? -0.35
                    : 0;
        const learnedCategoryTimeAdjustment = categoryTimeAdjustment(item, start);
        scheduled.push({ ...item, score: Math.max(0, (item.score ?? 0) - travelTimePenalty - consecutiveCategoryPenalty + mealCombinationAdvantage + cafeSequenceAdjustment + learnedCategoryTimeAdjustment), travel_time_penalty: travelTimePenalty, schedule_start: formatMinute(start), schedule_end: formatMinute(end), stay_minutes: stayMinutes, travel_from_previous_minutes: travelMinutes, reason: `${item.reason ?? "추천 후보"}${consecutiveCategoryPenalty > 0 ? ` · 동일 카테고리 연속 패널티 ${consecutiveCategoryPenalty.toFixed(2)}` : ""}${mealCombinationAdvantage > 0 ? ` · ${isLunchRestaurant ? "점심" : isDinnerRestaurant ? "저녁" : "식사"} 식당 구성 어드밴티지 +${mealCombinationAdvantage.toFixed(2)}` : ""}${cafeSequenceAdjustment > 0 ? ` · 식후 카페 어드밴티지 +${cafeSequenceAdjustment.toFixed(2)}` : cafeSequenceAdjustment < 0 ? ` · 식전 카페 패널티 ${Math.abs(cafeSequenceAdjustment).toFixed(2)}` : ""}${learnedCategoryTimeAdjustment !== 0 ? ` · 사용자 일정 시간대 ${learnedCategoryTimeAdjustment > 0 ? "어드밴티지 +" : "패널티 "}${learnedCategoryTimeAdjustment.toFixed(2)}` : ""} · ${window.learned ? `학습 방문시간 ${item.preferred_visit_buckets?.join("/") ?? ""}` : "카테고리 기본 방문시간"}` });
        if (limitedCategory && item.category === limitedCategory) scheduledCategoryCount += 1;
        if (item.category === "restaurant") scheduledRestaurantCount += 1;
        cursor = end;
        previous = item;
    }
    const restaurantIndexes = scheduled.flatMap((item, index) => item.category === "restaurant" ? [index] : []);
    const restaurantStartHours = restaurantIndexes.map((index) => Number(scheduled[index].schedule_start?.slice(0, 2) ?? -1));
    const breakfastAndLunchOnly = restaurantIndexes.length >= 2
        && restaurantStartHours.some((hour) => hour >= 0 && hour < 11)
        && restaurantStartHours.some((hour) => hour >= 11 && hour < 15)
        && !restaurantStartHours.some((hour) => hour >= 17);
    if (breakfastAndLunchOnly) {
        for (const index of restaurantIndexes) {
            scheduled[index] = {
                ...scheduled[index],
                score: Math.max(0, (scheduled[index].score ?? 0) - 0.25),
                reason: `${scheduled[index].reason ?? "추천 후보"} · 저녁 식당 누락 패널티 0.25`,
            };
        }
    }
    if (scheduled.length > 0) {
        const returnTarget = returnDestination ?? origin;
        const returnLeg = (await loadGtfsLegs(previous, [returnTarget as Recommendation]))[0];
        const fallbackReturn = Math.max(10, Math.ceil(distanceKm(previous, returnTarget) / 25 * 60 + 8));
        const returnMinutes = returnLeg?.gtfs_available
            ? Math.max(10, Math.ceil(returnLeg.gtfs_transit_minutes * 1.15 + 5))
            : fallbackReturn;
        const lastIndex = scheduled.length - 1;
        scheduled[lastIndex] = {
            ...scheduled[lastIndex],
            return_to_lodging_minutes: returnMinutes,
            reason: `${scheduled[lastIndex].reason ?? "추천 후보"} · 일정 종료 후 ${returnTarget.name} 이동 ${returnMinutes}분`,
        };
    }
    return { scheduled, overflow };
}

function orderForTravelEfficiency(items: Recommendation[], origin: SeedPlace, limitedCategory?: string, startMinute = 9 * 60): Recommendation[] {
    const remaining = [...items];
    const ordered: Recommendation[] = [];
    let previous: SeedPlace = origin;
    let cursor = startMinute;
    let orderedRestaurantCount = 0;
    while (remaining.length > 0) {
        let bestIndex = 0;
        let bestCost = Number.POSITIVE_INFINITY;
        for (const [index, item] of remaining.entries()) {
            const estimatedTravel = Math.max(10, Math.ceil(distanceKm(previous, item) / 25 * 60 + 8));
            let feasibleStart = Math.max(cursor + estimatedTravel, visitWindow(item).start);
            if (item.category === "restaurant" && orderedRestaurantCount === 0 && feasibleStart < 11 * 60) feasibleStart = 11 * 60;
            if (item.category === "restaurant" && orderedRestaurantCount === 1 && feasibleStart < 17 * 60) feasibleStart = 17 * 60;
            const remoteEntryExempt = ordered.length === 0 && item.day_cluster_qualified === true;
            const longTravelPenalty = remoteEntryExempt ? 0 : Math.max(0, estimatedTravel - 30) * 4;
            const repeatsPreviousCategory = Boolean(item.category && previous.category === item.category);
            const consecutiveCategoryPenalty = repeatsPreviousCategory
                ? (["restaurant", "cafe"].includes(item.category ?? "") ? 100_000 : 2_000)
                : 0;
            const categoryPriority = limitedCategory && item.category === limitedCategory ? -45 : 0;
            const preferenceBonus = (item.score ?? 0) * 90;
            const lunchTimingCost = Math.abs(feasibleStart - 12 * 60);
            const dinnerTimingCost = Math.abs(feasibleStart - 18 * 60 - 30);
            const mealCompositionCost = item.category !== "restaurant"
                ? 0
                : orderedRestaurantCount === 0
                    ? lunchTimingCost * 0.7 - 240
                    : orderedRestaurantCount === 1
                        ? dinnerTimingCost * 0.8 - 320
                        : 180;
            const cafeSequenceCost = item.category !== "cafe"
                ? 0
                : previous.category === "restaurant"
                    ? -260
                    : orderedRestaurantCount === 0
                        ? 320
                        : 0;
            const learnedCategoryTimeCost = -categoryTimeAdjustment(item, feasibleStart) * 500;
            const cost = feasibleStart + longTravelPenalty + consecutiveCategoryPenalty + categoryPriority + mealCompositionCost + cafeSequenceCost + learnedCategoryTimeCost - preferenceBonus;
            if (cost < bestCost) { bestCost = cost; bestIndex = index; }
        }
        const [selected] = remaining.splice(bestIndex, 1);
        const estimatedTravel = Math.max(10, Math.ceil(distanceKm(previous, selected) / 25 * 60 + 8));
        cursor = Math.max(cursor + estimatedTravel, visitWindow(selected).start) + defaultStayMinutes(selected);
        previous = selected;
        ordered.push(selected);
        if (selected.category === "restaurant") orderedRestaurantCount += 1;
    }
    return ordered;
}

function takeBestDayCluster(remaining: Recommendation[], origin: SeedPlace, targetPerDay: number, dense: boolean, remoteMode: "required" | "local" | "any" = "any", targetDestination?: SeedPlace | null, minimumRegionPlaces = 6, minimumAttractions = 2): Recommendation[] {
    if (remaining.length === 0) return [];
    const takeCount = dense ? targetPerDay * 3 : targetPerDay * 2;
    let best: { members: Recommendation[]; score: number; remoteQualified: boolean } | null = null;
    for (const anchor of remaining) {
        if (remoteMode === "required" && targetDestination && distanceKm(anchor, targetDestination) > 15) continue;
        const radiusKm = remoteMode === "required" ? 15 : (anchor.cluster_score ?? 0) >= 0.70 ? 10 : 6;
        const members = remaining
            .filter((item) => {
                if (distanceKm(anchor, item) > radiusKm) return false;
                // A selected nearby-region day must be made from that region itself.
                // Checking only the anchor allowed high-score Tokyo/Kawasaki places to
                // leak into a Yokohama day when the anchor sat near the region edge.
                return remoteMode !== "required"
                    || !targetDestination
                    || distanceKm(item, targetDestination) <= 15;
            })
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
            .slice(0, takeCount);
        const categories = new Set(members.map((item) => item.category ?? "place"));
        const touristCount = members.filter((item) => !["restaurant", "cafe", "information", "hotel", "place"].includes(item.category ?? "place")).length;
        const outboundKm = distanceKm(origin, anchor);
        // A remote area must be capable of filling a meaningful part of the day.
        if (outboundKm > 25 && (members.length < Math.min(minimumRegionPlaces, takeCount) || touristCount < Math.min(minimumAttractions, targetPerDay) || categories.size < 2)) continue;
        const preference = members.reduce((sum, item) => sum + (item.score ?? 0), 0);
        const graphValue = Math.max(0, ...members.map((item) => item.cluster_score ?? 0));
        const hasEnoughDestinationContent = touristCount >= Math.min(minimumAttractions, targetPerDay)
            && members.length >= Math.min(minimumRegionPlaces, takeCount)
            && categories.size >= 2;
        // An explicitly selected learned region is already the user's day-trip intent.
        // Do not reject Yokohama merely because a southern-Tokyo hotel or Haneda is <25 km away.
        const remoteQualified = targetDestination
            ? hasEnoughDestinationContent
            : outboundKm > 25 && graphValue >= 0.70 && members.length >= Math.min(minimumRegionPlaces, takeCount) && categories.size >= 2;
        if (remoteMode === "required" && !remoteQualified) continue;
        const diversityBonus = Math.min(categories.size, 4) * 0.12;
        const outboundPenalty = Math.min(outboundKm, 120) * 0.006;
        const localRangePenalty = remoteMode === "local" ? Math.max(0, outboundKm - 25) * 0.08 : 0;
        const cohesionPenalty = members.reduce((sum, item) => sum + distanceKm(anchor, item), 0)
            / Math.max(1, members.length) * 0.025;
        const score = preference + graphValue * 0.7 + diversityBonus - outboundPenalty - localRangePenalty - cohesionPenalty;
        if (!best || score > best.score) best = { members, score, remoteQualified };
    }
    if (!best && remoteMode === "required") return [];
    const selected = best?.members ?? remaining.slice(0, takeCount);
    const selectedSet = new Set(selected);
    for (let index = remaining.length - 1; index >= 0; index--) {
        if (selectedSet.has(remaining[index])) remaining.splice(index, 1);
    }
    return selected.map((item) => best?.remoteQualified ? { ...item, day_cluster_qualified: true } : item);
}

async function classify(items: Recommendation[], from: SeedPlace, to: SeedPlace, limit: number, days: number = 1, hotel?: SeedPlace | null, selectedCategory = "any", includeNearbyTrips = false, nearbyDestination?: SeedPlace | null, dayPreferences: DayPreference[] = []): Promise<Sections & { dailyPlans?: DailyPlan[] }> {
    const directDist = distanceKm(from, to);
    const isRoundTrip = directDist < 0.2;
    const maxDetourRatio = directDist < 3.0 ? 2.2 : 1.8;
    const dx = to.lon - from.lon; const dy = to.lat - from.lat; const length2 = dx * dx + dy * dy || 1;
    const filtered: Recommendation[] = [];
    const disneylandEmbedded = items.filter(isTokyoDisneylandEmbeddedVenue);
    // A trip may contain at most one theme-park destination. If an endpoint is already
    // a theme park, do not add another one from the recommendation candidates.
    let themeParkIncluded = selectedCategory === "theme_park" ? false : isThemePark(from) || isThemePark(to);

    for (const item of items) {
        if (item.transit_only) continue;
        if (isTokyoDisneylandEmbeddedVenue(item)) continue;
        if (normalize(item.name) === normalize(from.name) || normalize(item.name) === normalize(to.name) || (hotel && normalize(item.name) === normalize(hotel.name))) continue;
        let adjustedItem = item;
        if (!isRoundTrip) {
            const d1 = distanceKm(from, item);
            const d2 = distanceKm(to, item);
            const detourRatio = (d1 + d2) / Math.max(directDist, 0.5);
            if (detourRatio > maxDetourRatio && directDist < 8.0) {
                const detourPenalty = Math.min(0.9, (detourRatio - maxDetourRatio) * 0.35);
                adjustedItem = {
                    ...adjustedItem,
                    score: Math.max(0, (adjustedItem.score ?? 0) - detourPenalty),
                    reason: `${adjustedItem.reason ?? "추천 후보"} · 짧은 구간 우회 패널티 ${detourPenalty.toFixed(3)}`,
                };
            }
        }
        if (isThemePark(item)) {
            if (selectedCategory !== "theme_park" && themeParkIncluded) {
                const themeParkPenalty = 0.85;
                adjustedItem = {
                    ...adjustedItem,
                    score: Math.max(0, (adjustedItem.score ?? 0) - themeParkPenalty),
                    reason: `${adjustedItem.reason ?? "추천 후보"} · 추가 테마파크 패널티 ${themeParkPenalty.toFixed(2)}`,
                };
            }
            themeParkIncluded = true;
        }
        filtered.push(adjustedItem);
    }
    const learnedFrequencyLimit = selectedCategory === "any"
        ? 0
        : Math.max(1, Number(filtered[0]?.category_trip_frequency_limit ?? 1));
    // All exact-category matches remain as alternatives. Only successful placements
    // consume the learned frequency quota; zoo/aquarium never consume theme-park slots.
    const scheduleCandidates = filtered;

    if (days > 1) {
        const dailyPlans: DailyPlan[] = [];
        const remaining = [...scheduleCandidates];
        const targetPerDay = Math.min(Math.max(limit, 2), 15);
        const learnedNearbyDays = includeNearbyTrips
            ? Math.min(Math.max(0, days - 2), Math.max(days >= 3 ? 1 : 0, Number(filtered[0]?.nearby_day_frequency_limit ?? 0)))
            : 0;
        const minimumRegionPlaces = Math.max(4, Number(filtered[0]?.nearby_region_min_places ?? 6));
        const minimumAttractions = Math.max(2, Number(filtered[0]?.nearby_region_min_attractions ?? 2));
        const nearbyDaySlots = new Set(Array.from({ length: learnedNearbyDays }, (_, index) =>
            Math.max(0, Math.min(days - 2, Math.round((index + 1) * days / (learnedNearbyDays + 1)) - 1))
        ));
        let selectedCategoryUsed = 0;

        for (let d = 0; d < days; d++) {
            const dense = limit >= 10;
            const isLastDay = d === days - 1;
            const dayPreference = dayPreferences.find((preference) => preference.day === d + 1);
            const dayCategory = dayPreference?.category ?? selectedCategory;
            const explicitDayConditions = dayPreferences.length > 0;
            const preferredNearbyDestination = validInputPlace(dayPreference?.nearbyDestination) ?? nearbyDestination;
            if (isLastDay) {
                const departureOrigin = hotel ?? from;
                if (dense) {
                    const departureRaw: Recommendation[] = [];
                    for (let index = remaining.length - 1; index >= 0 && departureRaw.length < targetPerDay * 3; index--) {
                        if (distanceKm(departureOrigin, remaining[index]) <= 15) departureRaw.unshift(...remaining.splice(index, 1));
                    }
                    const dailyCategorySlots = dayCategory === "theme_park" ? 1 : Number.POSITIVE_INFINITY;
                    const { scheduled, overflow } = await scheduleChronologically(departureRaw, departureOrigin, 12 * 60, true, targetPerDay, dayCategory === "any" ? undefined : dayCategory, dailyCategorySlots, 9 * 60, to, 120);
                    remaining.unshift(...overflow);
                    dailyPlans.push({
                        day: d + 1,
                        label: `Day ${d + 1} · 출국일 (12:00)`,
                        items: scheduled.map((item, idx) => ({
                            ...item,
                            reason: `${hotel ? `숙소(${hotel.name}) 연계 · ` : ""}출국 전 최대 일정 #${idx + 1}`,
                        })),
                        departureDay: true,
                        departureTime: "12:00"
                    });
                    continue;
                }
                const departureCandidates = remaining.filter(item => !isThemePark(item));
                const { scheduled } = await scheduleChronologically(departureCandidates, departureOrigin, 12 * 60, false, 1, dayCategory === "any" ? undefined : dayCategory, dayCategory === "theme_park" ? 1 : Number.POSITIVE_INFINITY, 9 * 60, to, 120);
                const selectedDeparture = new Set(scheduled.map(item => `${normalize(item.name)}:${item.lat.toFixed(5)},${item.lon.toFixed(5)}`));
                for (let index = remaining.length - 1; index >= 0; index--) {
                    const item = remaining[index];
                    if (selectedDeparture.has(`${normalize(item.name)}:${item.lat.toFixed(5)},${item.lon.toFixed(5)}`)) remaining.splice(index, 1);
                }
                const dayItems = scheduled.map(item => ({
                    ...item,
                    reason: hotel
                        ? `숙소(${hotel.name}) 체크아웃 후 출국 전 오전 간소 일정`
                        : "12:00 출국 전 오전 간소 일정"
                }));
                dailyPlans.push({
                    day: d + 1,
                    label: `Day ${d + 1} · 출국일 (12:00)`,
                    items: dayItems,
                    departureDay: true,
                    departureTime: "12:00"
                });
                continue;
            }
            if (remaining.length === 0) {
                dailyPlans.push({ day: d + 1, label: `Day ${d + 1}`, items: [] });
                continue;
            }
            const origin = d === 0 ? from : hotel ?? from;
            const remoteDay = explicitDayConditions ? Boolean(dayPreference?.nearby) : nearbyDaySlots.has(d);
            let dayRaw = takeBestDayCluster(remaining, origin, targetPerDay, dense, remoteDay ? "required" : "local", remoteDay ? preferredNearbyDestination : null, minimumRegionPlaces, minimumAttractions);
            if (dayRaw.length === 0 && !remoteDay) dayRaw = takeBestDayCluster(remaining, origin, targetPerDay, dense, "any", null, minimumRegionPlaces, minimumAttractions);
            const slotsLeft = explicitDayConditions || dayCategory === "any" ? Number.POSITIVE_INFINITY : Math.max(0, learnedFrequencyLimit - selectedCategoryUsed);
            const dailyCategorySlots = dayCategory === "theme_park" ? Math.min(1, slotsLeft) : slotsLeft;
            const arrivalDay = d === 0;
            // Fixed 10:00 arrival + 90 minutes for immigration, baggage and airport exit.
            const dayStartMinute = arrivalDay ? 11 * 60 + 30 : 9 * 60;
            const returnDestination = arrivalDay && hotel ? hotel : origin;
            const { scheduled, overflow } = await scheduleChronologically(dayRaw, origin, 21 * 60, dense, targetPerDay, dayCategory === "any" ? undefined : dayCategory, dailyCategorySlots, dayStartMinute, returnDestination);
            selectedCategoryUsed += scheduled.filter((item) => item.category === dayCategory).length;
            remaining.unshift(...overflow);
            if (!explicitDayConditions && selectedCategory !== "any" && selectedCategoryUsed >= learnedFrequencyLimit) {
                for (let index = remaining.length - 1; index >= 0; index--) {
                    if (remaining[index].category === selectedCategory) remaining.splice(index, 1);
                }
            }
            const dayItems = attachTokyoDisneylandVenues(scheduled.map((item, idx) => {
                const notice = isThemePark(item) ? " (🎢 테마파크 체류 반영)" : "";
                return {
                    ...item,
                    reason: hotel
                        ? `숙소(${hotel.name}) 연계 · Day ${d + 1} 추천 #${idx + 1}${notice}`
                        : `Day ${d + 1} 추천 일정 #${idx + 1}${notice}`
                };
            }), disneylandEmbedded);
            const actualRemoteDay = remoteDay && scheduled.some((item) => item.day_cluster_qualified);
            const regionAnchor = scheduled.find((item) => item.day_cluster_qualified) ?? scheduled[0];
            dailyPlans.push({
                day: d + 1,
                label: arrivalDay
                    ? `Day ${d + 1} · 입국일 (10:00)`
                    : actualRemoteDay && regionAnchor
                    ? `Day ${d + 1} · ${preferredNearbyDestination?.name ?? "근교"} 일정${dayCategory !== "any" ? ` · ${dayCategory}` : ""}`
                    : `Day ${d + 1}${dayCategory !== "any" ? ` · ${dayCategory}` : ""}`,
                items: dayItems,
                nearbyDay: remoteDay,
                arrivalDay,
                arrivalTime: arrivalDay ? "10:00" : undefined,
            });
        }

        return {
            before: dailyPlans[0]?.items ?? [],
            between: dailyPlans.slice(1, -1).flatMap((dp) => dp.items),
            after: dailyPlans[dailyPlans.length - 1]?.items ?? [],
            dailyPlans
        };
    }

    const sections: Sections = { before: [], between: [], after: [] };
    for (const item of scheduleCandidates) {
        const t = ((item.lon - from.lon) * dx + (item.lat - from.lat) * dy) / length2;
        const key = t < 0 ? "before" : t > 1 ? "after" : "between";
        if (sections[key].length < limit) sections[key].push({ ...item, reason: key === "between" ? "두 지점 사이의 효율적인 동선 후보" : key === "before" ? "출발지 인근 후보" : "도착지 인근 후보" });
    }
    for (const key of ["before", "between", "after"] as const) {
        sections[key] = attachTokyoDisneylandVenues(sections[key], disneylandEmbedded).slice(0, limit);
    }
    if ((isTokyoDisneyland(from) || isTokyoDisneyland(to)) && !sections.between.some((item) => item.included_in_parent_stay)) {
        sections.between = attachTokyoDisneylandVenues([from as Recommendation], disneylandEmbedded).slice(1, limit + 1);
    }
    return sections;
}

async function askLocalLlm(from: SeedPlace, to: SeedPlace, trips: SeedTrip[], places: SeedPlace[], features: Features, limit: number): Promise<Sections> {
    const related = trips.filter((trip) => (trip.places ?? []).some((p) => [from.name, to.name].some((name) => normalize(p.name).includes(normalize(name)) || normalize(name).includes(normalize(p.name))))).slice(0, 12);
    const datasetContext = (related.length ? related : trips.slice(0, 4)).map((trip) => (trip.places ?? []).slice(0, 16).map((p) => p.name).join(" → ")).join("\n");
    const midpoint = { lat: (from.lat + to.lat) / 2, lon: (from.lon + to.lon) / 2 };
    const nearby = places.filter((place) => distanceKm(midpoint, place) <= features.maxDistanceKm);
    const candidates = nearby.filter((place) => features.category === "any" || place.category === features.category).sort((a, b) => distanceKm(midpoint, a) - distanceKm(midpoint, b)).slice(0, 60);
    const candidatePool = candidates.length ? candidates : nearby.slice(0, 60);
    if (candidatePool.length === 0) return { before: [], between: [], after: [] };
    const candidateContext = candidatePool.map((place, index) => `${index + 1} | ${place.name} | ${place.category ?? "place"} | ${place.lat},${place.lon}`).join("\n");
    const prompt = `여행 일정 데이터셋을 참고해 ${from.name}에서 ${to.name}로 이동하는 추천을 만든다. 조건: 연령=${features.ageBucket}, 동행=${features.companionType}, 자녀=${features.childAgeBucket}, 그룹=${features.groupAgeBucket}, 월=${features.month}, 계절=${features.season}, 우기=${features.rainySeason}, 시간=${features.hour}시, 카테고리=${features.category}, 반경=${features.maxDistanceKm}km. before는 출발지 직전, between은 두 지점 사이, after는 도착지 직후다. 빈 배열만 반환하면 안 된다. 후보가 있는 한 영역별 최대 ${limit}개를 고르고, 같은 후보를 중복 사용하지 않는다. candidateIndex에는 CANDIDATES 맨 앞 숫자만 넣는다. JSON 형식: {"before":[{"candidateIndex":1,"reason":"조건에 맞는 이유"}],"between":[],"after":[]}\n\nDATASET ROUTES:\n${datasetContext}\n\nCANDIDATES (반드시 여기서 선택):\n${candidateContext}`;
    const response = await fetch(`${OLLAMA_URL.replace(/\/$/, "")}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: OLLAMA_MODEL, stream: false, format: "json", messages: [{ role: "user", content: prompt }], options: { temperature: 0.2, num_thread: OLLAMA_NUM_THREAD } }), signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`로컬 LLM 응답 오류 (${response.status})`);
    const payload = await response.json() as { message?: { content?: string } };
    const hydrate = (content: string): Sections => {
        const parsed = JSON.parse(content || "{}") as Record<keyof Sections, Array<{ candidateIndex?: number; name?: string; reason?: string }>>;
        const section = (key: keyof Sections): Recommendation[] => (parsed[key] ?? []).slice(0, limit).flatMap((item) => { const index = Number(item.candidateIndex); const place = Number.isInteger(index) && index >= 1 ? candidatePool[index - 1] : item.name ? findPlace(candidatePool, item.name) : undefined; return place ? [{ ...place, reason: item.reason }] : []; });
        return { before: section("before"), between: section("between"), after: section("after") };
    };
    let sections = hydrate(payload.message?.content ?? "{}");
    if (sections.before.length + sections.between.length + sections.after.length === 0) {
        const retryPrompt = `다음 후보 번호 중 서로 다른 번호를 최대 ${Math.min(candidatePool.length, limit * 3)}개 골라 before, between, after에 분배해라. 빈 배열만 반환하지 마라. 조건은 ${features.category}, ${features.hour}시다. JSON 형식만 사용: {"before":[{"candidateIndex":1,"reason":"이유"}],"between":[],"after":[]}\n후보:\n${candidateContext}`;
        const retry = await fetch(`${OLLAMA_URL.replace(/\/$/, "")}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: OLLAMA_MODEL, stream: false, format: "json", messages: [{ role: "user", content: retryPrompt }], options: { temperature: 0.1, num_thread: OLLAMA_NUM_THREAD } }), signal: AbortSignal.timeout(120_000) });
        if (retry.ok) { const retryPayload = await retry.json() as { message?: { content?: string } }; sections = hydrate(retryPayload.message?.content ?? "{}"); }
    }
    return sections;
}
