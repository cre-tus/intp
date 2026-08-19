"use client";

import Header from "@/app/header";
import RequireAuth from "@/components/requireAuth/RequireAuth";
import PlaceSearchModal from "@/components/planner/ActivityField/PlaceSerachModal";
import type { PlaceResult } from "@/components/planner/ActivityField/PlaceSerachInput";
import { api } from "@/service/api";
import { useAuthStore } from "@/stores/authStore";
import { ArrowRight, BrainCircuit, Clock3, Database, LoaderCircle, Map, MapPin, MapPinned, Play, Route, Sparkles, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

type RouteScheduleItem = { name: string; time: string; time_bucket: string };
type StayLearningSample = { plan_id: string; plan_title: string; day: number; route: string[]; route_schedule?: RouteScheduleItem[]; place_name: string; start_time: string; start_time_bucket?: string; next_place_name: string; next_start_time: string; next_start_time_bucket?: string; estimated_transit_minutes: number; observed_stay_minutes: number };
type Place = { name: string; category?: string; lat: number; lon: number; score?: number; model_score?: number; distance_km?: number; distance_factor?: number; cluster_score?: number; cluster_advantage?: number; cluster_neighbor_count?: number; cluster_category_count?: number; travel_time_penalty?: number; return_to_lodging_minutes?: number; reason?: string; learned_stay_minutes?: number; stay_sample_count?: number; stay_learning_samples?: StayLearningSample[]; transit_only?: boolean; schedule_start?: string; schedule_end?: string; stay_minutes?: number; travel_from_previous_minutes?: number };
type DailyPlan = { day: number; label: string; items: Place[]; nearbyDay?: boolean; arrivalDay?: boolean; arrivalTime?: string; departureDay?: boolean; departureTime?: string };
type Sections = { before: Place[]; between: Place[]; after: Place[]; dailyPlans?: DailyPlan[] };
type TrainingStatus = { status: "idle" | "running" | "complete" | "failed"; phase?: string; startedAt?: string; finishedAt?: string; error?: string };
type NearbyDestinationOption = { name: string; lat: number; lon: number; plan_day_count: number; place_count?: number; attraction_count?: number; minimum_place_count?: number; minimum_attraction_count?: number; travelTimeLabel?: string };
type NearbyDayProfile = { schedule_limit?: number; nearby_day_rate?: number; expected_count?: number; destinations?: NearbyDestinationOption[] };
type AirportOption = Place & { visitCount: number; popularity?: number };
type TrainingPlanStats = { operating: number; pending: number; candidateTotal: number };
type ModelStats = { ok: boolean; trainedPlaces: number; trainedCategories: number; standardPlacesPerDay: number; nearbyDayFrequencyByTripDays: Record<string, NearbyDayProfile>; airportOptions: AirportOption[]; trainingPlanStats: TrainingPlanStats; lastTrainedAt: string | null; training: TrainingStatus; started?: boolean };
type ModelSectionData = { model: string; durationMs: number; sections: Sections };
type CompareResult = { query: { from: Place; to: Place; hotel?: Place | null; mode?: "multiday" | "point_to_point" }; cosine: ModelSectionData; ml: ModelSectionData; gnn: ModelSectionData; dataset: { trips: number; places: number; trainedPlaces: number; trainedCategories: number } };
type TravelScope = "tokyo" | "greater_tokyo" | "kanto" | "japan";
type Features = { ageBucket: string; companionType: string; childAgeBucket: string; groupAgeBucket: string; month: string; season: string; rainySeason: boolean; includeNearbyTrips: boolean; hour: number; category: string; travelScope: TravelScope; days: number };
type DayPreference = { day: number; category: string; nearby: boolean; nearbyDestinationKey: string };

const FEATURE_OPTIONS = {
    category: [["any", "전체"], ["restaurant", "식당"], ["cafe", "카페"], ["theme_park", "테마파크"], ["zoo", "동물원"], ["aquarium", "수족관"], ["sports", "스포츠 시설"], ["park", "공원·자연"], ["museum", "박물관·전시"], ["kid_museum", "어린이 체험"], ["shopping", "쇼핑"], ["landmark", "명소"], ["viewpoint", "전망대"], ["hotel", "숙박"]],
    age: [["unknown", "연령 무관"], ["10s", "10대"], ["20s", "20대"], ["30s", "30대"], ["40s", "40대"], ["50s", "50대"], ["60s_plus", "60대 이상"]],
    companion: [["unknown", "동행 무관"], ["solo", "혼자"], ["couple", "커플"], ["friends", "친구"], ["parents_only", "부모님"], ["family_with_young_child", "영유아 가족"], ["family_with_child", "자녀 가족"], ["family_with_teen", "청소년 가족"], ["multi_generation", "다세대 가족"]],
    child: [["unknown", "자녀 연령 무관"], ["none", "자녀 없음"], ["infant", "영아"], ["toddler", "유아"], ["preschool", "미취학"], ["lower_elementary", "초등 저학년"], ["upper_elementary", "초등 고학년"], ["teen", "청소년"]],
    season: [["unknown", "계절 무관"], ["spring", "봄"], ["summer", "여름"], ["rainy", "우기"], ["autumn", "가을"], ["winter", "겨울"]],
} as const;
const CANDIDATE_LIMIT_OPTIONS = [["3", "후보 3곳"], ["4", "후보 4곳"], ["5", "후보 5곳"], ["6", "후보 6곳"], ["8", "후보 8곳"], ["10", "후보 10곳"], ["15", "후보 15곳"], ["20", "후보 20곳"]] as const;
const GROUP_AGE_OPTIONS: readonly (readonly [string, string])[] = [...FEATURE_OPTIONS.age, ["mixed", "혼합 연령"]];
const MONTH_OPTIONS: readonly (readonly [string, string])[] = [["unknown", "월 무관"], ...Array.from({ length: 12 }, (_, i): [string, string] => [String(i + 1), `${i + 1}월`])];
const TRAVEL_SCOPE_OPTIONS: readonly (readonly [TravelScope, string])[] = [
    ["tokyo", "도쿄 도내"],
    ["greater_tokyo", "수도권 근교 (도쿄·가나가와·사이타마·치바)"],
    ["kanto", "간토 전역"],
    ["japan", "다른 현 포함"],
];

const sectionMeta = [
    ["before", "출발지 이전", "첫 여행지 전에 방문할 후보"],
    ["between", "두 여행지 사이", "이동 동선 중간에 넣을 후보"],
    ["after", "도착지 이후", "두 번째 여행지 다음 후보"],
] as const;

const TRAINING_PHASE_LABELS: Record<string, string> = {
    dependencies: "환경 확인",
    place_sync: "장소 동기화",
    dataset: "데이터셋 생성",
    model: "모델 학습",
    evaluation: "성능 평가",
    quality_gate: "품질 검증",
    complete: "완료",
};

export default function RecommendationComparePage() {
    const { me, isLoggedIn, fetchMe } = useAuthStore();
    const [compareMode, setCompareMode] = useState<"multiday" | "point_to_point">("multiday");
    const [from, setFrom] = useState<PlaceResult | null>(null);
    const [to, setTo] = useState<PlaceResult | null>(null);
    const [hotel, setHotel] = useState<PlaceResult | null>(null);
    const [arrivalAirport, setArrivalAirport] = useState<AirportOption | null>(null);
    const [departureAirport, setDepartureAirport] = useState<AirportOption | null>(null);
    const [nearbyDestination, setNearbyDestination] = useState<NearbyDestinationOption | null>(null);
    const [dayPreferences, setDayPreferences] = useState<DayPreference[]>(() => Array.from({ length: 3 }, (_, index) => ({ day: index + 1, category: "any", nearby: false, nearbyDestinationKey: "" })));
    const [limit, setLimit] = useState(4);
    const [searching, setSearching] = useState<"from" | "to" | "hotel" | null>(null);
    const [features, setFeatures] = useState<Features>({ ageBucket: "unknown", companionType: "unknown", childAgeBucket: "unknown", groupAgeBucket: "unknown", month: "unknown", season: "unknown", rainySeason: false, includeNearbyTrips: false, hour: 14, category: "any", travelScope: "greater_tokyo", days: 3 });
    const [result, setResult] = useState<CompareResult | null>(null);
    const [modelStats, setModelStats] = useState<ModelStats | null>(null);
    const [trainStarting, setTrainStarting] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const previousStandardPlaces = useRef(4);
    useEffect(() => { void fetchMe(); }, [fetchMe]);
    useEffect(() => {
        let cancelled = false;
        const refresh = () => void api.get<ModelStats>("/api/admin/recommendation-compare")
            .then(({ data }) => {
                if (cancelled) return;
                setModelStats(data);
                setArrivalAirport((current) => current ?? data.airportOptions?.[0] ?? null);
                setDepartureAirport((current) => current ?? data.airportOptions?.[0] ?? null);
                const learned = Math.min(15, Math.max(1, data.standardPlacesPerDay ?? 4));
                setLimit((current) => current === previousStandardPlaces.current ? learned : current);
                previousStandardPlaces.current = learned;
            })
            .catch(() => { if (!cancelled && !modelStats) setModelStats(null); });
        refresh();
        const timer = window.setInterval(refresh, 5_000);
        return () => { cancelled = true; window.clearInterval(timer); };
    }, []);

    const compare = async (event: FormEvent) => {
        event.preventDefault();
        if (loading) return;
        setLoading(true); setError(""); setResult(null);
        try {
            const data = (await api.post<CompareResult>("/api/admin/recommendation-compare", {
                mode: compareMode,
                from: compareMode === "point_to_point" && from ? { name: from.displayTitle ?? from.title, lat: from.lat, lon: from.lon } : undefined,
                to: compareMode === "point_to_point" && to ? { name: to.displayTitle ?? to.title, lat: to.lat, lon: to.lon } : undefined,
                hotel: hotel ? { name: hotel.displayTitle ?? hotel.title, lat: hotel.lat, lon: hotel.lon } : undefined,
                arrivalAirport: arrivalAirport ? { name: arrivalAirport.name, lat: arrivalAirport.lat, lon: arrivalAirport.lon, category: "station" } : undefined,
                departureAirport: departureAirport ? { name: departureAirport.name, lat: departureAirport.lat, lon: departureAirport.lon, category: "station" } : undefined,
                nearbyDestination: nearbyDestination ? { name: nearbyDestination.name, lat: nearbyDestination.lat, lon: nearbyDestination.lon } : undefined,
                dayPreferences: compareMode === "multiday" ? dayPreferences.map((preference) => {
                    const destination = learnedNearbyDestinations.find((item) => `${item.lat},${item.lon}` === preference.nearbyDestinationKey);
                    return {
                        day: preference.day,
                        category: preference.category,
                        nearby: preference.nearby,
                        nearbyDestination: preference.nearby && destination
                            ? { name: destination.name, lat: destination.lat, lon: destination.lon }
                            : undefined,
                    };
                }) : undefined,
                features: {
                    ...features,
                    days: compareMode === "point_to_point" ? 1 : features.days,
                    hour: compareMode === "point_to_point" ? features.hour : 14,
                },
                limit
            })).data;
            setResult(data);
            setModelStats((current) => ({ ok: true, trainedPlaces: data.dataset.trainedPlaces, trainedCategories: data.dataset.trainedCategories, standardPlacesPerDay: current?.standardPlacesPerDay ?? 4, nearbyDayFrequencyByTripDays: current?.nearbyDayFrequencyByTripDays ?? {}, airportOptions: current?.airportOptions ?? [], trainingPlanStats: current?.trainingPlanStats ?? { operating: 0, pending: 0, candidateTotal: 0 }, lastTrainedAt: current?.lastTrainedAt ?? null, training: current?.training ?? { status: "idle" } }));
        }
        catch (cause) { const data = (cause as { response?: { data?: { message?: string; suggestions?: string[] } } }).response?.data; setError(`${data?.message ?? "비교 결과를 불러오지 못했습니다."}${data?.suggestions?.length ? ` (추천 검색어: ${data.suggestions.join(", ")})` : ""}`); }
        finally { setLoading(false); }
    };

    const trainModel = async () => {
        if (trainStarting || modelStats?.training.status === "running") return;
        setTrainStarting(true); setError("");
        try { setModelStats((await api.post<ModelStats>("/api/admin/recommendation-compare", { action: "train" })).data); }
        catch (cause) { const message = (cause as { response?: { data?: { message?: string } } }).response?.data?.message; setError(message ?? "ML 재학습을 시작하지 못했습니다."); }
        finally { setTrainStarting(false); }
    };

    if (isLoggedIn === null || (isLoggedIn && !me)) return null;
    if (me?.role !== "ADMIN") return <RequireAuth><Header /><main className="mx-auto max-w-3xl px-6 py-10"><section className="rounded-xl border border-gray-200 bg-white p-6"><h1 className="text-2xl font-bold text-gray-950">접근 권한 없음</h1><p className="mt-2 text-sm text-gray-600">추천 모델 비교는 관리자만 사용할 수 있습니다.</p></section></main></RequireAuth>;
    const nearbyOrigin: Place = hotel
        ? { name: hotel.displayTitle ?? hotel.title, lat: hotel.lat, lon: hotel.lon }
        : { name: "Tokyo Station", lat: 35.681236, lon: 139.767125 };
    const learnedNearbyDestinations = Array.from(
        Object.values(modelStats?.nearbyDayFrequencyByTripDays ?? {})
            .flatMap((profile) => profile.destinations ?? [])
            .reduce((regions, destination) => {
                const key = destination.name.trim().toLocaleLowerCase();
                const current = regions.get(key);
                if (!current || destination.plan_day_count > current.plan_day_count) regions.set(key, destination);
                return regions;
            }, new globalThis.Map<string, NearbyDestinationOption>())
            .values()
    )
        .sort((a, b) => b.plan_day_count - a.plan_day_count || a.name.localeCompare(b.name, "ko"))
        .filter((destination) => {
            const distanceKm = routeDistanceKm(nearbyOrigin, destination);
            return distanceKm >= 25 && distanceKm <= 180;
        });
    const resizeDayPreferences = (days: number) => {
        const safeDays = Number.isFinite(days) ? Math.min(14, Math.max(1, days)) : 1;
        setFeatures((value) => ({ ...value, days: safeDays, includeNearbyTrips: false, category: "any" }));
        setDayPreferences((current) => Array.from({ length: safeDays }, (_, index) => current[index] ?? {
            day: index + 1,
            category: "any",
            nearby: false,
            nearbyDestinationKey: "",
        }));
        setNearbyDestination(null);
    };
    const updateDayPreference = (day: number, patch: Partial<DayPreference>) => {
        setDayPreferences((current) => current.map((item) => item.day === day ? { ...item, ...patch } : item));
    };
    const hasIncompleteNearbyDay = dayPreferences.some((item) => item.nearby && !item.nearbyDestinationKey);

    return <RequireAuth><main className="min-h-screen bg-gray-50"><Header /><div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-gray-200 pb-6"><div><div className="mb-2 flex items-center gap-2 text-xs font-bold text-emerald-700"><BrainCircuit size={15} /> RECOMMENDATION LAB</div><h1 className="font-[var(--font-paperlogy)] text-3xl font-bold text-gray-950">여행 추천 모델 비교 (3-Way Comparison)</h1><p className="mt-2 text-sm text-gray-600">동일한 데이터셋을 기준으로 코사인 벡터 유사도, MLP 랭킹, GNN+MLP 하이브리드 3개 모델의 추천 결과를 나란히 비교합니다.</p></div><div className="flex flex-col items-end gap-2"><div className="flex items-center gap-2 text-sm font-semibold text-gray-600"><span className={`h-2 w-2 rounded-full ${modelStats?.training.status === "running" ? "animate-pulse bg-amber-500" : "bg-emerald-500"}`} />{modelStats?.training.status === "running" ? `ML 재학습 중 · ${TRAINING_PHASE_LABELS[modelStats.training.phase ?? ""] ?? "진행 중"}` : "3개 ML 모델 실시간 실행"}</div><div className="flex flex-wrap items-center justify-end gap-2"><div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-right"><div className="flex items-center gap-2 text-sm font-bold text-emerald-800"><Database size={15} /> ML 학습 장소 <span className="text-base text-emerald-950">{(modelStats?.trainedPlaces ?? result?.dataset?.trainedPlaces ?? 520).toLocaleString()}개</span></div><div className="mt-1 space-y-0.5 text-[11px] font-semibold text-emerald-800"><div>현재 학습 후보 일정 <strong>{modelStats?.trainingPlanStats.candidateTotal ?? 0}세트</strong></div><div>운영 모델 {modelStats?.trainingPlanStats.operating ?? 0}세트 · 미반영 {modelStats?.trainingPlanStats.pending ?? 0}세트</div><div className="text-emerald-700">합계 {modelStats?.trainingPlanStats.candidateTotal ?? 0}세트 · 최근 학습 {formatTrainDate(modelStats?.lastTrainedAt)}</div></div></div><button type="button" onClick={() => void trainModel()} disabled={trainStarting || modelStats?.training.status === "running"} className="flex h-12 items-center gap-2 rounded-lg bg-gray-950 px-4 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-400">{trainStarting || modelStats?.training.status === "running" ? <LoaderCircle className="animate-spin" size={16} /> : <BrainCircuit size={16} />}{modelStats?.training.status === "running" ? "학습 중" : "재학습 실행"}</button></div>{modelStats?.training.status === "failed" && <p className="max-w-md text-right text-xs font-semibold text-red-600">최근 학습 실패: {modelStats.training.error ?? "학습 로그를 확인해 주세요."}</p>}</div></header>

        {/* MODE SWITCHER */}
        <div className="mb-6 flex rounded-xl border border-gray-200 bg-white p-1.5 shadow-sm">
            <button
                type="button"
                onClick={() => { setCompareMode("multiday"); setLimit((current) => Math.min(current, 15)); }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold transition ${compareMode === "multiday" ? "bg-gray-950 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"}`}
            >
                <Sparkles size={17} />
                🗓️ 전체 일정 자동 생성 비교 모드 (1~14일)
            </button>
            <button
                type="button"
                onClick={() => setCompareMode("point_to_point")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold transition ${compareMode === "point_to_point" ? "bg-gray-950 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"}`}
            >
                <Route size={17} />
                🗺️ 특정 여행지 간 동선 비교 모드 (Point-to-Point)
            </button>
        </div>

        <form onSubmit={compare} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            {compareMode === "point_to_point" ? (
                <div className="grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                    <PlacePicker label="첫 번째 여행지" place={from} onClick={() => setSearching("from")} />
                    <ArrowRight className="mb-3 hidden text-gray-400 md:block" size={22} />
                    <PlacePicker label="두 번째 여행지" place={to} onClick={() => setSearching("to")} />
                    <button disabled={loading || !from || !to} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gray-950 px-4 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:bg-gray-400 md:col-span-3">
                        {loading ? <LoaderCircle className="animate-spin" size={17} /> : <Play size={16} fill="currentColor" />}
                        {loading ? "3개 모델 실행 중..." : "A→후보 한 곳→B 추천 후보 비교"}
                    </button>
                </div>
            ) : (
                <div className="grid gap-4">
                    <div className="grid items-end gap-4 md:grid-cols-3">
                        <AirportSelect label="입국 공항" value={arrivalAirport} options={modelStats?.airportOptions ?? []} onChange={setArrivalAirport} />
                        <AirportSelect label="출국 공항" value={departureAirport} options={modelStats?.airportOptions ?? []} onChange={setDepartureAirport} />
                        <PlacePicker label="숙소 / 호텔 지정 (선택 사항)" place={hotel} onClick={() => setSearching("hotel")} />
                    </div>
                    <button disabled={loading || !arrivalAirport || !departureAirport || hasIncompleteNearbyDay} className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-gray-950 px-6 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:bg-gray-400">
                        {loading ? <LoaderCircle className="animate-spin" size={17} /> : <Play size={16} fill="currentColor" />}
                        {loading ? "3개 모델 전체 일정 생성 중..." : `전체 ${features.days}일차 일정 자동 생성 비교`}
                    </button>
                </div>
            )}

            <fieldset className="mt-5 border-t border-gray-100 pt-5">
                <legend className="px-2 text-xs font-bold text-gray-800">추천 조건 · 모델 피처</legend>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    {compareMode === "multiday" && (
                        <NumberField label="일정 기간" value={features.days} min={1} max={14} suffix="일" onChange={resizeDayPreferences} />
                    )}
                    {compareMode === "point_to_point"
                        ? <FeatureSelect label="단일 방문 후보 수" value={String(limit)} options={CANDIDATE_LIMIT_OPTIONS} onChange={(val) => setLimit(Number(val))} />
                        : <NumberField label={`하루 방문 장소 수 (학습 표준 ${modelStats?.standardPlacesPerDay ?? 4}곳)`} value={limit} min={1} max={15} suffix="곳" onChange={setLimit} />}
                    {compareMode === "point_to_point" && <FeatureSelect label="희망 카테고리" value={features.category} options={FEATURE_OPTIONS.category} onChange={(category) => setFeatures((v) => ({ ...v, category }))} />}
                    <FeatureSelect label="여행자 연령대" value={features.ageBucket} options={FEATURE_OPTIONS.age} onChange={(ageBucket) => setFeatures((v) => ({ ...v, ageBucket }))} />
                    <FeatureSelect label="동행 유형" value={features.companionType} options={FEATURE_OPTIONS.companion} onChange={(companionType) => setFeatures((v) => ({ ...v, companionType }))} />
                    <FeatureSelect label="자녀 연령" value={features.childAgeBucket} options={FEATURE_OPTIONS.child} onChange={(childAgeBucket) => setFeatures((v) => ({ ...v, childAgeBucket }))} />
                    <FeatureSelect label="그룹 연령대" value={features.groupAgeBucket} options={GROUP_AGE_OPTIONS} onChange={(groupAgeBucket) => setFeatures((v) => ({ ...v, groupAgeBucket }))} />
                    <FeatureSelect label="계절" value={features.season} options={FEATURE_OPTIONS.season} onChange={(season) => setFeatures((v) => ({ ...v, season }))} />
                    <FeatureSelect label="여행 월" value={features.month} options={MONTH_OPTIONS} onChange={(month) => setFeatures((v) => ({ ...v, month }))} />
                    {compareMode === "point_to_point" && <NumberField label="방문 시간" value={features.hour} min={0} max={23} suffix="시" onChange={(hour) => setFeatures((v) => ({ ...v, hour }))} />}
                    <FeatureSelect label="여행 범위" value={features.travelScope} options={TRAVEL_SCOPE_OPTIONS} onChange={(travelScope) => setFeatures((v) => ({ ...v, travelScope: travelScope as TravelScope }))} />
                </div>
                {compareMode === "multiday" && <div className="mt-5 overflow-hidden rounded-xl border border-gray-200">
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-50 px-4 py-3">
                        <div><p className="text-sm font-bold text-gray-900">Day별 일정 조건</p><p className="mt-0.5 text-[11px] text-gray-500">날짜마다 근교 권역과 희망 카테고리를 따로 적용합니다.</p></div>
                        <span className="text-xs font-semibold text-emerald-700">총 {features.days}일 · 근교 {dayPreferences.filter((item) => item.nearby).length}일</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {dayPreferences.map((preference) => <div key={preference.day} className="grid items-end gap-3 px-4 py-3 md:grid-cols-[80px_150px_minmax(180px,1fr)_minmax(160px,0.8fr)]">
                            <div className="pb-2 text-sm font-black text-gray-900">Day {preference.day}</div>
                            <FeatureSelect label="일정 권역" value={preference.nearby ? "nearby" : "local"} options={[["local", "도쿄 도내"], ["nearby", "근교 일정"]]} onChange={(value) => updateDayPreference(preference.day, { nearby: value === "nearby", nearbyDestinationKey: value === "nearby" ? preference.nearbyDestinationKey : "" })} />
                            <FeatureSelect label="근교 권역" value={preference.nearbyDestinationKey} options={[["", preference.nearby ? "근교 권역 선택" : "도쿄 도내 일정"], ...learnedNearbyDestinations.map((item): [string, string] => [`${item.lat},${item.lon}`, `${item.name}${item.travelTimeLabel ? ` · ${item.travelTimeLabel}` : ""}`])]} onChange={(nearbyDestinationKey) => updateDayPreference(preference.day, { nearbyDestinationKey })} disabled={!preference.nearby} />
                            <FeatureSelect label="희망 카테고리" value={preference.category} options={FEATURE_OPTIONS.category} onChange={(category) => updateDayPreference(preference.day, { category })} />
                        </div>)}
                    </div>
                    {learnedNearbyDestinations.length === 0 && <p className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700">현재 숙소 기준으로 선택 가능한 학습 근교 권역이 없습니다.</p>}
                    {hasIncompleteNearbyDay && <p className="border-t border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700">근교 일정으로 지정한 Day의 근교 권역을 선택하세요.</p>}
                </div>}
                <label className="mt-4 inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-gray-700">
                    <input type="checkbox" checked={features.rainySeason} onChange={(e) => setFeatures((v) => ({ ...v, rainySeason: e.target.checked }))} className="h-4 w-4 accent-emerald-600" />
                    우기 조건 반영
                </label>
            </fieldset>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-500"><Database size={13} /> 숙소를 지정하면 3개 추천 모델이 매일 숙소 위치를 기준으로 최적 일정을 생성합니다.</p>
        </form>

        <PlaceSearchModal open={searching !== null} onClose={() => setSearching(null)} initialQuery={searching === "from" ? from?.title : searching === "to" ? to?.title : hotel?.title} countryCode="JP" adminGoogleSearch preferNearby onSelect={(place) => { if (searching === "from") setFrom(place); else if (searching === "to") setTo(place); else if (searching === "hotel") { setHotel(place); setNearbyDestination(null); } setSearching(null); }} />

        {error && <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
        {loading && <div className="mt-6 grid gap-6 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-96 animate-pulse rounded-xl border border-gray-200 bg-white" />)}</div>}
        {result && <><div className="my-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3"><div className="flex items-center gap-2 text-sm font-bold text-emerald-900"><Route size={17} /> {result.query.from.name}<ArrowRight size={15} />{result.query.to.name}</div><span className="text-xs font-semibold text-emerald-700">비교 일정 {result.dataset.trips.toLocaleString()}개 · 비교 장소 {result.dataset.places.toLocaleString()}개 · ML 학습 장소 {result.dataset.trainedPlaces.toLocaleString()}개</span></div><div className="grid gap-6 lg:grid-cols-3"><ModelColumn pointToPoint={result.query.mode === "point_to_point"} icon={<MapPin size={19} />} title="1. Cosine Vector Baseline" accent="amber" model={result.cosine.model} duration={result.cosine.durationMs} sections={result.cosine.sections} from={result.query.from} to={result.query.to} hotel={result.query.hotel} /><ModelColumn pointToPoint={result.query.mode === "point_to_point"} icon={<BrainCircuit size={19} />} title="2. TravelRecommender (MLP)" accent="emerald" model={result.ml.model} duration={result.ml.durationMs} sections={result.ml.sections} from={result.query.from} to={result.query.to} hotel={result.query.hotel} /><ModelColumn pointToPoint={result.query.mode === "point_to_point"} icon={<Sparkles size={19} />} title="3. GNN + MLP Hybrid (제안)" accent="violet" model={result.gnn.model} duration={result.gnn.durationMs} sections={result.gnn.sections} from={result.query.from} to={result.query.to} hotel={result.query.hotel} /></div></>}
    </div></main></RequireAuth>;
}

function PlacePicker({ label, place, onClick }: { label: string; place: PlaceResult | null; onClick: () => void }) { return <div><span className="mb-2 block text-xs font-bold text-gray-800">{label}</span><button type="button" onClick={onClick} className="flex h-11 w-full items-center gap-2 rounded-lg border border-gray-300 px-3 text-left transition hover:border-emerald-600 hover:bg-emerald-50/40"><MapPin size={16} className={place ? "text-emerald-600" : "text-gray-400"} /><span className={`min-w-0 flex-1 truncate text-sm font-semibold ${place ? "text-gray-950" : "text-gray-400"}`}>{place?.displayTitle ?? place?.title ?? "여행지 검색"}</span><span className="text-xs font-bold text-emerald-700">검색</span></button>{place?.subtitle && <p className="mt-1.5 truncate text-[11px] text-gray-500">{place.subtitle}</p>}</div>; }

function AirportSelect({ label, value, options, onChange }: { label: string; value: AirportOption | null; options: AirportOption[]; onChange: (value: AirportOption | null) => void }) { return <label><span className="mb-2 block text-xs font-bold text-gray-800">{label}</span><select value={value ? `${value.lat},${value.lon}` : ""} onChange={(event) => onChange(options.find((item) => `${item.lat},${item.lon}` === event.target.value) ?? null)} className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-950"><option value="">학습 데이터셋 공항 선택</option>{options.map((airport) => <option key={`${airport.lat},${airport.lon}`} value={`${airport.lat},${airport.lon}`}>{airport.name}</option>)}</select></label>; }

function FeatureSelect({ label, value, options, onChange, disabled = false }: { label: string; value: string; options: readonly (readonly [string, string])[]; onChange: (value: string) => void; disabled?: boolean }) { return <label><span className="mb-1.5 block text-[11px] font-bold text-gray-600">{label}</span><select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900 outline-none focus:border-emerald-600 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400">{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>; }
function NumberField({ label, value, min, max, suffix, onChange }: { label: string; value: number; min: number; max: number; suffix: string; onChange: (value: number) => void }) { return <label><span className="mb-1.5 block text-[11px] font-bold text-gray-600">{label}</span><div className="flex h-10 items-center rounded-lg border border-gray-300 bg-white px-3 focus-within:border-emerald-600"><input type="number" value={value} min={min} max={max} onChange={(e) => onChange(Number(e.target.value))} className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" /><span className="text-xs text-gray-500">{suffix}</span></div></label>; }

function ModelColumn({ icon, title, model, duration, sections, accent, from, to, hotel, pointToPoint = false }: { icon: React.ReactNode; title: string; model: string; duration: number; sections: Sections; accent: "amber" | "emerald" | "violet"; from: Place; to: Place; hotel?: Place | null; pointToPoint?: boolean }) {
    const tone = accent === "amber" ? "border-amber-200 bg-amber-50 text-amber-800" : accent === "emerald" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-violet-200 bg-violet-50 text-violet-800";
    const [selectedDay, setSelectedDay] = useState(1);
    const dailyPlans = sections.dailyPlans;
    const selectedPlan = dailyPlans?.[selectedDay - 1];
    const selectedDayFrom = selectedPlan?.arrivalDay ? from : hotel ?? from;
    const selectedDayTo = selectedPlan?.departureDay ? to : hotel ?? selectedDayFrom;

    return <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
            <div className="flex items-center gap-3">
                <span className={`flex h-9 w-9 items-center justify-center rounded-lg border ${tone}`}>{icon}</span>
                <div><h2 className="font-bold text-gray-950">{title}</h2><p className="text-xs text-gray-500">{model}</p></div>
            </div>
            <span className="flex items-center gap-1 text-xs font-semibold text-gray-500"><Clock3 size={13} /> {(duration / 1000).toFixed(1)}초</span>
        </header>

        {dailyPlans && dailyPlans.length > 1 && (
            <div className="grid gap-1.5 border-b border-gray-100 bg-gray-50 px-3 py-2 [grid-template-columns:repeat(auto-fit,minmax(72px,1fr))]">
                {dailyPlans.map((dp) => {
                    const nearbyDay = dp.nearbyDay === true;
                    const selectedClass = accent === "amber" ? "bg-amber-500 text-white" : accent === "emerald" ? "bg-emerald-600 text-white" : "bg-violet-600 text-white";
                    const dayClass = nearbyDay
                        ? selectedDay === dp.day ? "bg-sky-600 text-white ring-2 ring-sky-200" : "bg-sky-100 text-sky-800 ring-1 ring-inset ring-sky-300 hover:bg-sky-200"
                        : selectedDay === dp.day ? selectedClass : "bg-white text-gray-600 hover:bg-gray-200";
                    return <button key={dp.day} type="button" onClick={() => setSelectedDay(dp.day)} className={`min-w-0 rounded-md px-2 py-1.5 text-xs font-bold leading-tight transition ${dayClass}`}>
                        <span className="block">Day {dp.day}</span>
                        <span className="mt-0.5 block text-[10px] opacity-80">{nearbyDay ? "근교 포함 일정" : dp.arrivalDay ? "입국일 10:00" : dp.departureDay ? "출국일" : `${dp.items.length}곳`}</span>
                    </button>;
                })}
            </div>
        )}

        <div className="divide-y divide-gray-100">
            {pointToPoint ? (
                <ResultSection candidateMode sectionKey="between" label="한 곳 선택 후보" description="각 항목은 서로 대체 가능한 단일 방문지입니다. 한 번에 한 곳만 선택합니다." items={sections.between} accent={accent} from={from} to={to} />
            ) : dailyPlans && dailyPlans.length > 1 ? (
                <ResultSection sectionKey="between" label={`${selectedDay}일차 일정 (${selectedPlan?.label ?? "Day"})`} description={selectedPlan?.departureDay ? "12:00 출국 기준 · 오전 일정 후 출국 공항 이동" : selectedPlan?.arrivalDay ? "10:00 입국 · 수속 후 일정 · 숙소 도착" : "추천 일정 알고리즘 배치"} items={selectedPlan?.items ?? []} accent={accent} from={selectedDayFrom} to={selectedDayTo} departureDay={selectedPlan?.departureDay} />
            ) : (
                sectionMeta.map(([key, label, description]) => <ResultSection key={key} sectionKey={key} label={label} description={description} items={sections[key]} accent={accent} from={from} to={to} />)
            )}
        </div>
    </section>;
}

function isThemeParkPlace(item: Place): boolean {
    const cat = (item.category ?? "").toLowerCase();
    const name = (item.name ?? "").toLowerCase();
    // Only an actual theme-park category receives the all-day stay treatment.
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

function getChronologicalTime(index: number, item: Place, items: Place[]): { timeRange: string; periodLabel: string } {
    if (item.schedule_start && item.schedule_end) {
        const learned = item.stay_sample_count ? `사용자 일정 ${item.stay_sample_count}건 학습` : "카테고리 기본값";
        return { timeRange: `${item.schedule_start} ~ ${item.schedule_end}`, periodLabel: `이동 ${item.travel_from_previous_minutes ?? 0}분 · 체류 ${item.stay_minutes ?? item.learned_stay_minutes ?? 80}분 · ${learned}` };
    }
    if (isThemeParkPlace(item)) {
        const stayMinutes = Math.min(720, Math.max(60, item.learned_stay_minutes ?? 240));
        const endMinute = 10 * 60 + stayMinutes;
        const end = `${String(Math.floor(endMinute / 60)).padStart(2, "0")}:${String(endMinute % 60).padStart(2, "0")}`;
        const learned = item.stay_sample_count ? `사용자 일정 ${item.stay_sample_count}건 학습` : "카테고리 기본값";
        return { timeRange: `10:00 ~ ${end}`, periodLabel: `🎢 테마파크 체류 (${Math.round(stayMinutes / 30) / 2}시간 · ${learned})` };
    }
    if (items.some(isThemeParkPlace)) {
        const eveningIndex = items.slice(0, index).filter(candidate => !isThemeParkPlace(candidate)).length;
        const eveningSlots = [
            { timeRange: "17:30 ~ 19:30", periodLabel: "저녁 식사 & 휴식" },
            { timeRange: "20:00 ~ 21:30", periodLabel: "야경 & 디너" },
        ];
        return eveningSlots[Math.min(eveningIndex, eveningSlots.length - 1)];
    }
    const timeSlots = [
        { timeRange: "09:30 ~ 11:30", periodLabel: "오전 일정" },
        { timeRange: "12:00 ~ 13:30", periodLabel: "점심 & 식도락" },
        { timeRange: "14:00 ~ 16:30", periodLabel: "오후 메인 추천" },
        { timeRange: "17:00 ~ 19:00", periodLabel: "저녁 & 인근 탐방" },
        { timeRange: "19:30 ~ 21:30", periodLabel: "야경 & 나이트라이프" },
    ];
    return timeSlots[index % timeSlots.length];
}

function ResultSection({ sectionKey, label, description, items, accent, from, to, departureDay = false, candidateMode = false }: { sectionKey: keyof Sections; label: string; description: string; items: Place[]; accent: "amber" | "emerald" | "violet"; from: Place; to: Place; departureDay?: boolean; candidateMode?: boolean }) {
    const [showFullMap, setShowFullMap] = useState(false);
    const [routeCandidate, setRouteCandidate] = useState<Place | null>(null);
    const [learningPlace, setLearningPlace] = useState<Place | null>(null);
    const isThemeParkDay = items.some(isThemeParkPlace);
    const mapSections: Sections = {
        before: sectionKey === "before" ? items : [],
        between: sectionKey === "between" ? items : [],
        after: sectionKey === "after" ? items : []
    };
    const bgBadge = accent === "amber" ? "bg-amber-500" : accent === "emerald" ? "bg-emerald-600" : "bg-violet-600";
    const btnTone = accent === "amber" ? "bg-amber-500 hover:bg-amber-600 text-white" : accent === "emerald" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-violet-600 hover:bg-violet-700 text-white";

    return <div className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-gray-900">{label}</h3>
                    {isThemeParkDay && !candidateMode && (
                        <span className="rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                            🎢 테마파크 일일 체류 반영 (일정 축소)
                        </span>
                    )}
                </div>
                <p className="mt-0.5 text-xs text-gray-500">{description}</p>
            </div>
            {items.length > 0 && !candidateMode && (
                <button
                    type="button"
                    onClick={() => setShowFullMap(true)}
                    className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-bold shadow-xs transition ${btnTone}`}
                >
                    <Map size={14} />
                    전체 경로 지도 보기
                </button>
            )}
        </div>

        {items.length === 0 ? (
            departureDay ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-bold text-emerald-900">
                    09:00 공항 이동 · 12:00 출국
                    <p className="mt-1 text-xs font-semibold text-emerald-700">마지막 날은 추가 관광 없이 출국 일정으로 간소화합니다.</p>
                </div>
            ) : <div className="rounded-lg border border-dashed border-gray-200 py-5 text-center text-xs text-gray-400">추천 결과 없음</div>
        ) : (
            <ol className="space-y-3">
                {items.map((item, index) => {
                    const { timeRange, periodLabel } = candidateMode
                        ? { timeRange: `후보 ${index + 1}`, periodLabel: "단일 방문지 대안" }
                        : departureDay
                        ? { timeRange: "08:00 ~ 09:00", periodLabel: "출국 전 간소 일정 · 이후 공항 이동" }
                        : getChronologicalTime(index, item, items);
                    return (
                        <li key={`${item.name}-${index}`} className="flex gap-3 rounded-lg border border-gray-200 bg-gray-50/80 p-3">
                            <div className="flex flex-col items-center">
                                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${bgBadge}`}>{index + 1}</span>
                                {index < items.length - 1 && !candidateMode && <span className="my-1.5 w-0.5 flex-1 bg-gray-300 min-h-[14px]" />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <strong className="text-sm text-gray-950">{item.name}</strong>
                                        {item.category && <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-gray-700">{item.category}</span>}
                                    </div>
                                    <span className="flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-bold text-gray-700 shadow-2xs">
                                        {candidateMode ? <MapPin size={11} className="text-gray-400" /> : <Clock3 size={11} className="text-gray-400" />}
                                        {timeRange}
                                    </span>
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                    <span className="font-semibold text-emerald-700">{periodLabel}</span>
                                    {(item.stay_learning_samples?.length ?? 0) > 0 && <button type="button" onClick={() => setLearningPlace(item)} className="rounded border border-violet-200 bg-violet-50 px-2 py-0.5 font-bold text-violet-700 hover:bg-violet-100">학습 일정 보기</button>}
                                    {item.reason && <span>· {item.reason}</span>}
                                </div>
                                {typeof item.score === "number" && (
                                    <div className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                                        <Sparkles size={11} /> 최종 추천 점수: {item.score.toFixed(3)}
                                        {typeof item.model_score === "number" && <span> · 순수 모델 {item.model_score.toFixed(3)}</span>}
                                        {typeof item.distance_km === "number" && <span> · 기준점 {item.distance_km.toFixed(1)}km</span>}
                                        {typeof item.cluster_score === "number" && item.cluster_score > 0 && <span> · 목적지 클러스터 {item.cluster_score.toFixed(3)} ({item.cluster_neighbor_count ?? 0}곳/{item.cluster_category_count ?? 0}종)</span>}
                                    </div>
                                )}
                                {candidateMode && (
                                    <button
                                        type="button"
                                        onClick={() => setRouteCandidate(item)}
                                        className={`mt-3 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold shadow-xs transition ${btnTone}`}
                                    >
                                        <Route size={14} />
                                        A → 이 후보 → B 경로 확인
                                    </button>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ol>
        )}

        <RouteMapModal
            open={candidateMode ? routeCandidate !== null : showFullMap}
            onClose={() => candidateMode ? setRouteCandidate(null) : setShowFullMap(false)}
            title={candidateMode && routeCandidate ? `${from.name} → ${routeCandidate.name} → ${to.name}` : `${label} 전체 경로`}
            from={from}
            to={to}
            sections={candidateMode && routeCandidate ? { before: [], between: [routeCandidate], after: [] } : mapSections}
            accent={accent}
        />
        <StayLearningModal place={learningPlace} onClose={() => setLearningPlace(null)} />
    </div>;
}

function StayLearningModal({ place, onClose }: { place: Place | null; onClose: () => void }) {
    if (!place) return null;
    return <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
        <button type="button" aria-label="학습 일정 닫기" onClick={onClose} className="absolute inset-0 bg-black/50" />
        <section className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-bold text-gray-950">{place.name} 체류시간 학습 근거</h3><p className="mt-1 text-xs text-gray-500">학습값 {place.learned_stay_minutes ?? "-"}분 · 표본 {place.stay_sample_count ?? 0}건</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100"><X size={18} /></button></div>
            <div className="mt-4 space-y-3">{(place.stay_learning_samples ?? []).map((sample, index) => <article key={`${sample.plan_id}-${sample.day}-${index}`} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm text-gray-950">{sample.plan_title} · Day {sample.day}</strong><span className="rounded bg-violet-100 px-2 py-1 text-xs font-bold text-violet-800">관측 체류 {sample.observed_stay_minutes}분</span></div>
                <p className="mt-2 text-xs text-gray-600">{sample.start_time || "시간 미상"} {sample.place_name} → 이동 {sample.estimated_transit_minutes}분 → {sample.next_start_time || "시간 미상"} {sample.next_place_name}</p>
                <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3">
                    <p className="mb-2 text-[11px] font-bold text-gray-500">해당 일자 방문 시간대</p>
                    <ol className="space-y-1.5">{(sample.route_schedule?.length ? sample.route_schedule : sample.route.map((name, routeIndex) => ({ name, time: routeIndex === sample.route.indexOf(sample.place_name) ? sample.start_time : "", time_bucket: "unknown" }))).filter((item) => item.name).map((item, routeIndex) => <li key={`${item.name}-${routeIndex}`} className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${item.name === sample.place_name ? "bg-violet-50 font-bold text-violet-900" : "text-gray-700"}`}><span className="w-5 text-right text-gray-400">{routeIndex + 1}</span><span className="w-12 tabular-nums">{item.time || "--:--"}</span><span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">{visitTimeBucketLabel(item.time_bucket, item.time)}</span><span>{item.name}</span>{item.name === sample.place_name && <span className="ml-auto text-[10px] text-violet-700">체류 학습 대상</span>}</li>)}</ol>
                </div>
            </article>)}</div>
        </section>
    </div>;
}

function visitTimeBucketLabel(bucket?: string, rawTime?: string) {
    const labels: Record<string, string> = { morning: "오전", lunch: "점심", afternoon: "오후", evening: "저녁", night: "야간", unknown: "시간 미상" };
    if (bucket && bucket !== "unknown") return labels[bucket] ?? bucket;
    const hour = Number.parseInt(String(rawTime ?? "").split(":", 1)[0], 10);
    if (!Number.isFinite(hour)) return labels.unknown;
    if (hour >= 5 && hour < 11) return labels.morning;
    if (hour < 14) return labels.lunch;
    if (hour < 18) return labels.afternoon;
    if (hour < 22) return labels.evening;
    return labels.night;
}



type LeafletMap = { fitBounds: (bounds: [number, number][], options?: object) => void; remove: () => void };
type LeafletTileLayer = { addTo: (map: LeafletMap) => LeafletTileLayer; on: (event: string, handler: () => void) => LeafletTileLayer; remove: () => void };
type LeafletApi = { map: (element: HTMLElement) => LeafletMap & { setView: (center: [number, number], zoom: number) => void }; tileLayer: (url: string, options: object) => LeafletTileLayer; marker: (point: [number, number], options: object) => { addTo: (map: LeafletMap) => { bindPopup: (html: string) => void } }; divIcon: (options: object) => unknown; polyline: (points: [number, number][], options: object) => { addTo: (map: LeafletMap) => void } };
type RouteWindow = Window & { L?: LeafletApi; __routeLeafletPromise?: Promise<LeafletApi> };
const ROUTE_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#4f46e5", "#8b5cf6", "#ec4899"];

function scheduledRoute(from: Place, to: Place, candidates: Place[]): Place[] {
    const valid = candidates.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && p.name !== from.name && p.name !== to.name);
    return [from, ...valid, to];
}

function RouteMapModal({ open, onClose, title, from, to, sections, accent }: { open: boolean; onClose: () => void; title: string; from: Place; to: Place; sections: Sections; accent: "amber" | "emerald" | "violet" }) {
    const mapRef = useRef<HTMLDivElement | null>(null);
    const rawCandidates = [...sections.before, ...sections.between, ...sections.after];
    const route = scheduledRoute(from, to, rawCandidates);
    const legs = route.slice(0, -1).map((place, index) => ({ from: place, to: route[index + 1], distanceKm: routeDistanceKm(place, route[index + 1]) }));
    const totalDistance = legs.reduce((sum, leg) => sum + leg.distanceKm, 0);
    const totalMinutes = Math.round(totalDistance / 22 * 60 + legs.length * 8);
    useEffect(() => { if (!open || !mapRef.current) return; let map: LeafletMap | null = null; let cancelled = false; let fallbackLoaded = false; void loadRouteLeaflet().then((L) => { if (cancelled || !mapRef.current || route.length === 0) return; map = L.map(mapRef.current); let tileErrors = 0; const localTiles = L.tileLayer(process.env.NEXT_PUBLIC_TILE_URL || "/tiles/{z}/{x}/{y}.png", { maxZoom: 18, minZoom: 2, attribution: "Local map" }).addTo(map); localTiles.on("tileerror", () => { tileErrors += 1; if (tileErrors < 3 || fallbackLoaded || !map) return; fallbackLoaded = true; localTiles.remove(); L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(map); }); const points: [number, number][] = route.map((place) => [place.lat, place.lon]); points.slice(0, -1).forEach((point, index) => L.polyline([point, points[index + 1]], { color: routeColor(index), weight: 5, opacity: 0.85 }).addTo(map!)); route.forEach((place, index) => { const isFrom = place === from; const isTo = place === to; L.marker([place.lat, place.lon], { icon: L.divIcon({ className: "", html: routeMarkerHtml(index), iconSize: [34, 34], iconAnchor: [17, 17] }) }).addTo(map!).bindPopup(`<strong>${index + 1}. ${escapeHtml(place.name)}</strong><br>${isFrom ? "출발 고정" : isTo ? "도착 고정" : "추천 여행지"}`); }); if (points.length === 1) (map as LeafletMap & { setView: (center: [number, number], zoom: number) => void }).setView(points[0], 14); else map.fitBounds(points, { padding: [36, 36] }); }).catch(() => undefined); return () => { cancelled = true; map?.remove(); }; }, [open, from, to, sections, accent]);
    if (!open) return null; return <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center"><button type="button" aria-label="지도 닫기" onClick={onClose} className="absolute inset-0 bg-black/50" /><div className="relative flex max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl"><header className="flex items-center justify-between border-b border-gray-200 px-5 py-4"><div><div className="flex items-center gap-2 text-lg font-bold text-gray-950"><MapPinned className="h-5 w-5" />추천 경로 최적화</div><p className="mt-1 text-sm text-gray-500">{title} · 목적지 {route.length}개</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100"><X size={19} /></button></header><div className="min-h-0 overflow-y-auto"><div ref={mapRef} className="h-[320px] min-h-[320px] bg-gray-100 sm:h-[420px] sm:min-h-[420px] lg:h-[460px] lg:min-h-[460px]" /><aside className="grid gap-5 border-t border-gray-200 p-4 sm:p-5 lg:grid-cols-[320px_minmax(0,1fr)]"><div><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold text-gray-900">추천 일정</h3><span className="text-xs text-gray-400">번호 순서대로 이동</span></div><ol className="max-h-[300px] space-y-2 overflow-auto pr-1">{route.map((place, index) => <li key={`${place.name}-${index}`} className="rounded-lg border border-gray-200 px-3 py-2 text-sm" style={{ borderLeftColor: routeColor(index), borderLeftWidth: 5 }}><div className="flex items-center gap-2 font-semibold text-gray-950"><RouteNumberBadge index={index} /><span className="min-w-0 truncate">{place.name}</span></div><div className="mt-1 flex items-center gap-1.5 text-xs text-gray-500"><span className="rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-700">{place === from ? "출발 고정" : place === to ? "도착 고정" : "추천 여행지"}</span>{place.category && <span>{place.category}</span>}</div></li>)}</ol></div><div className="space-y-4"><div><h3 className="text-sm font-bold text-gray-900">경로 요약</h3><div className="mt-3 grid grid-cols-3 gap-2"><Metric label="거리" value={`${totalDistance.toFixed(2)} km`} /><Metric label="예상 시간" value={`${totalMinutes}분`} /><Metric label="목적지" value={`${route.length}개`} /></div></div><div className="space-y-2 border-t border-gray-200 pt-4">{legs.map((leg, index) => <div key={`${leg.from.name}-${leg.to.name}-${index}`} className="flex items-center gap-2 text-xs text-gray-600"><RouteNumberBadge index={index} /><span className="min-w-0 flex-1 truncate">{leg.from.name} → {leg.to.name}</span><strong className="shrink-0 text-gray-900">{leg.distanceKm.toFixed(2)} km</strong></div>)}</div></div></aside></div></div></div>;
}

function loadRouteLeaflet(): Promise<LeafletApi> { const routeWindow = window as RouteWindow; if (routeWindow.L) return Promise.resolve(routeWindow.L); if (routeWindow.__routeLeafletPromise) return routeWindow.__routeLeafletPromise; routeWindow.__routeLeafletPromise = new Promise((resolve, reject) => { if (!document.querySelector('link[data-route-leaflet]')) { const link = document.createElement("link"); link.rel = "stylesheet"; link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; link.dataset.routeLeaflet = "true"; document.head.appendChild(link); } const existing = document.querySelector('script[data-route-leaflet]') as HTMLScriptElement | null; if (existing) { existing.addEventListener("load", () => routeWindow.L ? resolve(routeWindow.L) : reject(new Error("Leaflet unavailable"))); return; } const script = document.createElement("script"); script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; script.dataset.routeLeaflet = "true"; script.onload = () => routeWindow.L ? resolve(routeWindow.L) : reject(new Error("Leaflet unavailable")); script.onerror = () => reject(new Error("Leaflet load failed")); document.head.appendChild(script); }); return routeWindow.__routeLeafletPromise; }
function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] ?? char); }
function routeDistanceKm(a: Place, b: Place) { const toRad = (value: number) => value * Math.PI / 180; const dLat = toRad(b.lat - a.lat); const dLon = toRad(b.lon - a.lon); const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2; return 6371.0088 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)); }
function formatTrainDate(value?: string | null) { if (!value) return "기록 없음"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "기록 없음" : new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(date); }
function routeColor(index: number) { return ROUTE_COLORS[index % ROUTE_COLORS.length]; }
function readableTextColor(color: string) { return color === "#eab308" || color === "#22c55e" ? "#111827" : "#ffffff"; }
function routeMarkerHtml(index: number) { const color = routeColor(index); return `<div style="width:34px;height:34px;border-radius:9999px;background:${color};color:${readableTextColor(color)};border:3px solid white;box-shadow:0 8px 18px rgba(15,23,42,.35);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;line-height:1">${index + 1}</div>`; }
function RouteNumberBadge({ index }: { index: number }) { const color = routeColor(index); return <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black shadow-sm" style={{ backgroundColor: color, color: readableTextColor(color) }}>{index + 1}</span>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-gray-50 p-3"><div className="text-xs text-gray-500">{label}</div><div className="mt-1 text-sm font-bold text-gray-950">{value}</div></div>; }
