"use client";

import Header from "@/app/header";
import RequireAuth from "@/components/requireAuth/RequireAuth";
import { useAuthStore } from "@/stores/authStore";
import { loadAdminGoogleMaps } from "@/lib/googleMaps";
import { ProviderBadge } from "@/components/planner/ActivityField/PlaceSerachInput";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRightLeft, Check, Copy, Database, Filter, Layers, LoaderCircle, MapPin, RotateCcw, Save, Search, SlidersHorizontal, Sparkles, Tag, Trash2, X } from "lucide-react";

type PlaceRow = { id: number | string; source: string; sourcePlaceId: string; googlePlaceId?: string | null; title: string; displayTitle?: string | null; titleKo?: string | null; titleEn?: string | null; titleJa?: string | null; subtitle?: string | null; category: string; placeType: string; mlCategory?: string | null; serviceCategory?: string | null; lat: number; lon: number; selectedQuery?: string | null; selectionCount: number; reviewCount: number; sourceDataExpiresAt?: string | null; updatedAt: string; trainingIncluded?: boolean; popularity?: number | null; trainingSources?: string[] };
type NominatimCandidate = { id: string; title: string; displayTitle?: string | null; titleKo?: string | null; titleEn?: string | null; titleJa?: string | null; subtitle?: string | null; lat: number; lon: number; importance?: number; sourceQuery?: string | null; category?: string | null; type?: string | null; provider?: string | null };
type SortMode = "review_asc" | "review_desc" | "selection_asc" | "selection_desc" | "updated_desc";
type ReviewFilter = "all" | "unreviewed" | "reviewed" | "duplicate";
type SourceFilter = "all" | "google" | "custom" | "training";
const aliasLabelFields = new Set<keyof PlaceRow>(["title", "displayTitle", "titleKo", "titleJa", "titleEn"]);
const NOMINATIM_CATEGORY_OPTIONS = [
    ["all", "전체 카테고리 (All)"],
    ["amenity", "amenity · 편의시설"], ["tourism", "tourism · 관광"], ["leisure", "leisure · 여가"],
    ["shop", "shop · 상점"], ["railway", "railway · 철도"], ["aeroway", "aeroway · 공항"],
    ["historic", "historic · 역사"], ["natural", "natural · 자연"], ["place", "place · 지역"],
    ["building", "building · 건물"], ["highway", "highway · 도로·정류장"], ["boundary", "boundary · 행정구역"],
    ["landuse", "landuse · 토지이용"], ["man_made", "man_made · 인공물"], ["office", "office · 업무시설"], ["junction", "junction · 교차점"],
    ["public_transport", "public_transport · 대중교통"], ["waterway", "waterway · 수계"], ["emergency", "emergency · 안전시설"],
] as const;
const NOMINATIM_TYPE_OPTIONS: Record<string, readonly (readonly [string, string])[]> = {
    amenity: [["restaurant", "restaurant · 식당"], ["cafe", "cafe · 카페"], ["fast_food", "fast_food · 패스트푸드"], ["food_court", "food_court · 푸드코트"], ["bar", "bar · 바"], ["pub", "pub · 펍"], ["marketplace", "marketplace · 시장"], ["place_of_worship", "place_of_worship · 종교시설"], ["public_bath", "public_bath · 목욕시설"], ["theatre", "theatre · 극장"], ["arts_centre", "arts_centre · 문화센터"], ["bus_station", "bus_station · 버스터미널"], ["bicycle_rental", "bicycle_rental · 자전거 대여"], ["car_rental", "car_rental · 차량 대여"], ["taxi", "taxi · 택시"], ["school", "school · 학교"], ["university", "university · 대학"]],
    tourism: [["attraction", "attraction · 관광명소"], ["museum", "museum · 박물관"], ["gallery", "gallery · 미술관"], ["viewpoint", "viewpoint · 전망대"], ["theme_park", "theme_park · 테마파크"], ["zoo", "zoo · 동물원"], ["aquarium", "aquarium · 수족관"], ["hotel", "hotel · 호텔"], ["hostel", "hostel · 호스텔"], ["guest_house", "guest_house · 게스트하우스"], ["camp_site", "camp_site · 캠핑장"], ["artwork", "artwork · 작품"], ["information", "information · 관광안내"]],
    leisure: [["park", "park · 공원"], ["garden", "garden · 정원"], ["nature_reserve", "nature_reserve · 자연보호구역"], ["playground", "playground · 놀이터"], ["water_park", "water_park · 워터파크"], ["sports_centre", "sports_centre · 스포츠센터"], ["stadium", "stadium · 경기장"]],
    shop: [["mall", "mall · 쇼핑몰"], ["department_store", "department_store · 백화점"], ["supermarket", "supermarket · 슈퍼마켓"], ["convenience", "convenience · 편의점"], ["clothes", "clothes · 의류"], ["toys", "toys · 장난감"], ["hobby", "hobby · 취미"], ["anime", "anime · 애니메이션"], ["electronics", "electronics · 전자제품"], ["camera", "camera · 카메라"], ["jewelry", "jewelry · 귀금속"], ["pastry", "pastry · 제과"], ["variety_store", "variety_store · 잡화점"], ["ticket", "ticket · 티켓"]],
    railway: [["station", "station · 역"], ["stop", "stop · 정차역"], ["subway_entrance", "subway_entrance · 지하철 입구"], ["halt", "halt · 간이역"], ["tram_stop", "tram_stop · 노면전차 정류장"]],
    aeroway: [["aerodrome", "aerodrome · 공항"], ["terminal", "terminal · 터미널"], ["gate", "gate · 탑승구"]],
    historic: [["castle", "castle · 성"], ["temple", "temple · 사찰"], ["monument", "monument · 기념물"], ["memorial", "memorial · 기념시설"], ["ruins", "ruins · 유적"]],
    natural: [["beach", "beach · 해변"], ["water", "water · 수역"], ["peak", "peak · 산봉우리"], ["cape", "cape · 곶"], ["island", "island · 섬"], ["wood", "wood · 숲"]],
    place: [["city", "city · 도시"], ["town", "town · 소도시"], ["village", "village · 마을"], ["quarter", "quarter · 지구"], ["neighbourhood", "neighbourhood · 동네"], ["island", "island · 섬"], ["islet", "islet · 작은 섬"]],
    building: [["train_station", "train_station · 역 건물"], ["commercial", "commercial · 상업시설"], ["retail", "retail · 판매시설"], ["tower", "tower · 타워"], ["yes", "yes · 일반 건물"]],
    highway: [["bus_stop", "bus_stop · 버스 정류장"], ["pedestrian", "pedestrian · 보행로"], ["footway", "footway · 도보길"], ["elevator", "elevator · 엘리베이터"]],
    boundary: [["administrative", "administrative · 행정구역"], ["religious_administration", "religious_administration · 종교 행정구역"]],
    landuse: [["commercial", "commercial · 상업지역"], ["retail", "retail · 소매지역"], ["recreation_ground", "recreation_ground · 휴양지"]],
    man_made: [["tower", "tower · 타워"], ["island", "island · 인공섬"], ["bridge", "bridge · 교량"]],
    office: [["government", "government · 관공서"], ["diplomatic", "diplomatic · 외교시설"], ["company", "company · 회사"]],
    public_transport: [["station", "station · 역"], ["stop_position", "stop_position · 정차 위치"], ["platform", "platform · 승강장"]],
    waterway: [["river", "river · 강"], ["canal", "canal · 운하"], ["waterfall", "waterfall · 폭포"]],
    emergency: [["assembly_point", "assembly_point · 대피 장소"]],
    junction: [["yes", "yes · 교차점"]],
};

const compactAlias = (value: string) => value.trim().toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
const rebuildSearchAliases = (row: PlaceRow) => {
    const labels = [row.titleKo, row.titleJa, row.titleEn, row.title, row.displayTitle]
        .map(value => value?.trim() || "").filter(Boolean);
    const existing = (row.selectedQuery || "").split(/[|#;,]+/).map(value => value.trim()).filter(Boolean);
    const unique = new Map<string, string>();
    const generated = labels.flatMap(label => {
        const normalized = label.normalize("NFKC").replace(/\s+/g, " ").trim();
        const withoutSpaces = normalized.replace(/\s+/g, "");
        return withoutSpaces !== normalized ? [normalized, withoutSpaces] : [normalized];
    });
    [...generated, ...existing].forEach(alias => {
        const key = alias.normalize("NFKC").trim().toLocaleLowerCase();
        if (key && !unique.has(key)) unique.set(key, alias);
    });
    return [...unique.values()].join(" | ");
};

function generatePageNumbers(current: number, total: number) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: number[] = [];
    pages.push(1);
    if (current > 3) pages.push(-1);
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) {
        pages.push(i);
    }
    if (current < total - 2) pages.push(-1);
    pages.push(total);
    return pages;
}

export default function PlaceDatasetPage() {
    const { me, fetchMe } = useAuthStore();
    const [query, setQuery] = useState("");
    const [rows, setRows] = useState<PlaceRow[]>([]);
    const rowsRef = useRef<PlaceRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState<number | string | null>(null);
    const [deleting, setDeleting] = useState<number | string | null>(null);
    const [savedId, setSavedId] = useState<number | string | null>(null);
    const [mapRow, setMapRow] = useState<PlaceRow | null>(null);
    const [replaceRow, setReplaceRow] = useState<PlaceRow | null>(null);
    const [mergeRow, setMergeRow] = useState<PlaceRow | null>(null);
    const [batchMerging, setBatchMerging] = useState(false);
    const [error, setError] = useState("");

    const handleBatchMerge = async () => {
        if (batchMerging) return;
        if (!confirm("감지된 실질적 중복 장소(동일 구글ID/동일위치+동일이름)를 모두 1-Click 자동 병합하시겠습니까?")) return;
        setBatchMerging(true); setError("");
        try {
            const response = await fetch("/api/admin/place-dataset/batch-merge-duplicates", { method: "POST" });
            if (!response.ok) throw new Error(await response.text() || "중복 장소 자동 병합에 실패했습니다.");
            const data = await response.json() as { mergedCount: number; remainingCount: number };
            alert(`성공적으로 ${data.mergedCount}개의 중복 장소를 자동 병합 처리했습니다!`);
            void load(query, sort, reviewFilter, sourceFilter, categoryFilter, typeFilter, 1);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "중복 장소 자동 병합에 실패했습니다.");
        } finally {
            setBatchMerging(false);
        }
    };
    const [sort, setSort] = useState<SortMode>("review_asc");
    const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
    const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    const load = useCallback(async (
        value = "",
        sortMode: SortMode = "review_asc",
        filter: ReviewFilter = "all",
        source: SourceFilter = "all",
        catFilter = "all",
        tFilter = "all",
        pageNumber = 1,
        size = 50
    ) => {
        setLoading(true); setError("");
        try {
            const params = new URLSearchParams({
                q: value,
                sort: sortMode,
                reviewStatus: filter,
                source: source,
                category: catFilter,
                placeType: tFilter,
                page: String(pageNumber),
                pageSize: String(size)
            });
            const endpoint = source === "training"
                ? `/api/admin/ml-training-places?${params}`
                : `/api/admin/place-dataset?${params}`;
            const response = await fetch(endpoint, { cache: "no-store" });
            if (!response.ok) throw new Error(await response.text() || "데이터셋 조회에 실패했습니다.");
            const data = await response.json();

            let loadedRows: PlaceRow[] = [];
            let total = 0;
            let totalP = 1;
            let curP = pageNumber;

            if (Array.isArray(data)) {
                loadedRows = data;
                total = data.length;
                totalP = Math.max(1, Math.ceil(total / size));
                curP = pageNumber;
            } else if (data && typeof data === "object" && "items" in data) {
                loadedRows = data.items || [];
                total = Number(data.totalCount ?? loadedRows.length);
                totalP = Number(data.totalPages ?? Math.max(1, Math.ceil(total / size)));
                curP = Number(data.page ?? pageNumber);
            }

            if (catFilter !== "all" && catFilter) {
                loadedRows = loadedRows.filter(r => (r.category || "").toLowerCase() === catFilter.toLowerCase());
            }
            if (tFilter !== "all" && tFilter) {
                loadedRows = loadedRows.filter(r => (r.placeType || "").toLowerCase() === tFilter.toLowerCase());
            }

            rowsRef.current = loadedRows;
            setRows(loadedRows);
            setTotalCount(total);
            setTotalPages(totalP);
            setPage(curP);
        } catch (cause) { setError(cause instanceof Error ? cause.message : "데이터셋 조회에 실패했습니다."); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { void fetchMe(); }, [fetchMe]);
    useEffect(() => {
        if (me?.role !== "ADMIN") return;
        const timer = window.setTimeout(() => void load("", sort, reviewFilter, sourceFilter, categoryFilter, typeFilter, 1), 0);
        return () => window.clearTimeout(timer);
    }, [load, me?.role]);

    const handleResetFilters = () => {
        setQuery("");
        setSort("review_asc");
        setReviewFilter("all");
        setSourceFilter("all");
        setCategoryFilter("all");
        setTypeFilter("all");
        void load("", "review_asc", "all", "all", "all", "all", 1);
    };

    const edit = (id: number | string, key: keyof PlaceRow, value: string | number) => {
        const nextRows = rowsRef.current.map(row => {
            if (row.id !== id) return row;
            const updated = { ...row, [key]: value };
            return aliasLabelFields.has(key) ? { ...updated, selectedQuery: rebuildSearchAliases(updated) } : updated;
        });
        rowsRef.current = nextRows;
        setRows(nextRows);
    };
    const save = async (id: number | string) => {
        const target = rowsRef.current.find(item => item.id === id);
        if (!target) return;
        setSaving(id); setError("");
        try {
            const isTraining = target.source === "ML_TRAINING";
            const payload = isTraining ? {
                title: target.title,
                displayTitle: target.displayTitle,
                titleKo: target.titleKo,
                titleEn: target.titleEn,
                titleJa: target.titleJa,
                category: target.category,
                placeType: target.placeType,
                serviceCategory: target.serviceCategory,
                lat: target.lat,
                lon: target.lon,
                subtitle: target.subtitle,
                selectedQuery: target.selectedQuery,
            } : {
                title: target.title,
                displayTitle: target.displayTitle,
                titleKo: target.titleKo,
                titleEn: target.titleEn,
                titleJa: target.titleJa,
                subtitle: target.subtitle,
                category: target.category,
                placeType: target.placeType,
                lat: target.lat,
                lon: target.lon,
                selectedQuery: target.selectedQuery,
            };
            const response = await fetch(isTraining ? "/api/admin/ml-training-places" : `/api/admin/place-dataset/${id}`, {
                method: isTraining ? "POST" : "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(isTraining ? { action: "update", id, place: payload } : payload),
            });
            if (!response.ok) throw new Error(await response.text() || "라벨 저장에 실패했습니다.");
            const updated = await response.json() as PlaceRow;
            const nextRows = rowsRef.current.map(row => row.id === id ? { ...updated, selectedQuery: rebuildSearchAliases(updated) } : row);
            rowsRef.current = nextRows;
            setRows(nextRows);
            setSavedId(id);
            window.setTimeout(() => setSavedId(current => current === id ? null : current), 2000);
        } catch (cause) { setError(cause instanceof Error ? cause.message : "라벨 저장에 실패했습니다."); }
        finally { setSaving(null); }
    };
    const remove = async (row: PlaceRow) => {
        if (!window.confirm(`"${row.displayTitle || row.title}" 데이터를 삭제하시겠습니까?`)) return;
        setDeleting(row.id); setError("");
        try {
            const isTraining = row.source === "ML_TRAINING";
            const response = await fetch(isTraining ? "/api/admin/ml-training-places" : `/api/admin/place-dataset/${row.id}`,
                isTraining ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "exclude", id: row.id }) } : { method: "DELETE" }
            );
            if (!response.ok) throw new Error(await response.text() || "데이터 삭제에 실패했습니다.");
            const remaining = rowsRef.current.filter(item => item.id !== row.id);
            rowsRef.current = remaining;
            setRows(remaining);
            setTotalCount(prev => Math.max(0, prev - 1));
            if (mapRow?.id === row.id) setMapRow(null);
            if (replaceRow?.id === row.id) setReplaceRow(null);
        } catch (cause) { setError(cause instanceof Error ? cause.message : "데이터 삭제에 실패했습니다."); }
        finally { setDeleting(null); }
    };
    const replaced = (oldId: number | string, updated: PlaceRow) => {
        const remaining = rowsRef.current.filter(item => item.id !== oldId && item.id !== updated.id);
        const nextRows = sourceFilter === "google" ? remaining : [updated, ...remaining];
        rowsRef.current = nextRows;
        setRows(nextRows);
        setSavedId(updated.id);
        window.setTimeout(() => setSavedId(current => current === updated.id ? null : current), 2500);
        if (mapRow?.id === oldId) setMapRow(null);
        setReplaceRow(null);
    };

    const hasActiveFilters = query.trim() !== "" || sourceFilter !== "all" || reviewFilter !== "all" || categoryFilter !== "all" || typeFilter !== "all" || sort !== "review_asc";
    const currentSubTypes = categoryFilter !== "all" ? (NOMINATIM_TYPE_OPTIONS[categoryFilter] ?? []) : [];

    if (me?.role !== "ADMIN") return <RequireAuth><Header /><main className="mx-auto max-w-3xl px-6 py-10"><div className="rounded-xl border bg-white p-6"><h1 className="text-2xl font-bold">접근 권한 없음</h1><p className="mt-2 text-sm text-gray-600">관리자만 이용할 수 있습니다.</p></div></main></RequireAuth>;
    return <RequireAuth><main className="min-h-screen bg-gray-50/70"><Header /><section className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200/80 pb-5">
            <div>
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-700">
                    <Database size={15} /> SEARCH DATASET & POI MANAGEMENT
                </div>
                <h1 className="mt-1 font-[var(--font-paperlogy)] text-3xl font-bold text-gray-950">장소 검색 데이터셋 관리</h1>
                <p className="mt-1 text-sm text-gray-600">검색 모달 선택 장소와 ML 추천 모델 학습 데이터셋을 통합 조회하고 검수합니다.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                <span className="rounded-full bg-red-50 border border-red-200 px-3 py-1.5 text-red-700 shadow-2xs">
                    검색 DB 삭제 · 검색 기록만 삭제
                </span>
                <span className="rounded-full bg-violet-50 border border-violet-200 px-3 py-1.5 text-violet-700 shadow-2xs">
                    ML 학습 DB 삭제 · 추천 학습 후보에서 제외
                </span>
            </div>
        </div>

        {/* 🌟 MODERN TRENDS FILTER PANEL */}
        <section className="mt-6 rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm backdrop-blur-md">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                        <SlidersHorizontal size={17} />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-gray-950">스마트 검색 및 멀티 다차원 필터</h2>
                        <p className="text-[11px] font-semibold text-gray-500">Nominatim 카테고리, 세부 유형, 검수 상태, 데이터 출처 필터링</p>
                    </div>
                </div>
                {hasActiveFilters && (
                    <button
                        type="button"
                        onClick={handleResetFilters}
                        className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-xs font-bold text-gray-700 shadow-2xs transition hover:bg-gray-100"
                    >
                        <RotateCcw size={13} />
                        전체 필터 초기화
                    </button>
                )}
            </div>

            <form onSubmit={event => { event.preventDefault(); void load(query, sort, reviewFilter, sourceFilter, categoryFilter, typeFilter, 1); }} className="space-y-4">
                {/* SEARCH INPUT BAR */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[280px]">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="장소명, 주소, 카테고리, 검색어, 원본 ID 통합 검색..."
                            className="h-11 w-full rounded-xl border border-gray-300 bg-gray-50/60 pl-10 pr-10 text-sm font-semibold text-gray-900 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20"
                        />
                        {query && (
                            <button
                                type="button"
                                onClick={() => { setQuery(""); void load("", sort, reviewFilter, sourceFilter, categoryFilter, typeFilter, 1); }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                    <button type="submit" className="flex h-11 items-center gap-2 rounded-xl bg-gray-950 px-6 text-sm font-bold text-white shadow-xs transition hover:bg-emerald-700">
                        <Search size={16} />
                        조회 실행
                    </button>
                </div>

                {/* SEGMENTED SOURCE FILTER PILLS */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-xs font-bold text-gray-500 mr-1 flex items-center gap-1">
                        <Layers size={13} /> 출처 구분:
                    </span>
                    {[
                        ["all", "전체 데이터"],
                        ["google", "Google Maps"],
                        ["custom", "Custom (검수 대치)"],
                        ["training", "ML 학습 데이터 (추천 모델)"]
                    ].map(([key, label]) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => {
                                const val = key as SourceFilter;
                                setSourceFilter(val);
                                void load(query, sort, reviewFilter, val, categoryFilter, typeFilter, 1);
                            }}
                            className={`h-8 rounded-lg px-3 text-xs font-bold transition ${sourceFilter === key ? "bg-emerald-700 text-white shadow-xs" : "border border-gray-200 bg-gray-50/80 text-gray-700 hover:bg-gray-100"}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {/* NOMINATIM CATEGORY & TYPE MULTI-SELECT GRID */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-1">
                    {/* NOMINATIM CATEGORY */}
                    <label className="block">
                        <span className="mb-1.5 flex items-center gap-1 text-[11px] font-bold text-gray-700">
                            <Tag size={13} className="text-emerald-700" /> Nominatim 카테고리
                        </span>
                        <select
                            value={categoryFilter}
                            onChange={e => {
                                const cat = e.target.value;
                                setCategoryFilter(cat);
                                setTypeFilter("all");
                                void load(query, sort, reviewFilter, sourceFilter, cat, "all", 1);
                            }}
                            className="h-10 w-full rounded-xl border border-gray-300 bg-white px-3 text-xs font-bold text-gray-900 outline-none transition focus:border-emerald-600"
                        >
                            {NOMINATIM_CATEGORY_OPTIONS.map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </label>

                    {/* NOMINATIM TYPE */}
                    <label className="block">
                        <span className="mb-1.5 flex items-center gap-1 text-[11px] font-bold text-gray-700">
                            <Filter size={13} className="text-emerald-700" /> Nominatim 세부 유형 (type)
                        </span>
                        <select
                            value={typeFilter}
                            onChange={e => {
                                const typ = e.target.value;
                                setTypeFilter(typ);
                                void load(query, sort, reviewFilter, sourceFilter, categoryFilter, typ, 1);
                            }}
                            className="h-10 w-full rounded-xl border border-gray-300 bg-white px-3 text-xs font-bold text-gray-900 outline-none transition focus:border-emerald-600"
                        >
                            <option value="all">전체 세부 유형 (All Types)</option>
                            {currentSubTypes.map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </label>

                    {/* REVIEW FILTER */}
                    <label className="block">
                        <span className="mb-1.5 flex items-center gap-1 text-[11px] font-bold text-gray-700">
                            <Sparkles size={13} className="text-emerald-700" /> 검수 여부 필터
                        </span>
                        <select
                            value={reviewFilter}
                            onChange={e => {
                                const rev = e.target.value as ReviewFilter;
                                setReviewFilter(rev);
                                void load(query, sort, rev, sourceFilter, categoryFilter, typeFilter, 1);
                            }}
                            className="h-10 w-full rounded-xl border border-gray-300 bg-white px-3 text-xs font-bold text-gray-900 outline-none transition focus:border-emerald-600"
                        >
                            <option value="all">검수 여부 전체</option>
                            <option value="unreviewed">검수 미완료 (Review=0)</option>
                            <option value="reviewed">검수 완료 (Review &gt; 0)</option>
                            <option value="duplicate">⚠️ 중복 장소만 보기 (이름/ID 중복)</option>
                        </select>
                    </label>

                    {/* SORT ORDER */}
                    <label className="block">
                        <span className="mb-1.5 flex items-center gap-1 text-[11px] font-bold text-gray-700">
                            <SlidersHorizontal size={13} className="text-emerald-700" /> 정렬 순서
                        </span>
                        <select
                            value={sort}
                            onChange={e => {
                                const s = e.target.value as SortMode;
                                setSort(s);
                                void load(query, s, reviewFilter, sourceFilter, categoryFilter, typeFilter, 1);
                            }}
                            className="h-10 w-full rounded-xl border border-gray-300 bg-white px-3 text-xs font-bold text-gray-900 outline-none transition focus:border-emerald-600"
                        >
                            <option value="review_asc">검수 적은 순 (우선 검수 대상)</option>
                            <option value="review_desc">검수 많은 순</option>
                            <option value="selection_asc">선택 적은 순</option>
                            <option value="selection_desc">선택 많은 순</option>
                            <option value="updated_desc">최근 수정 일시 순</option>
                        </select>
                    </label>
                </div>

                {/* ACTIVE FILTER TAG CHIPS */}
                {hasActiveFilters && (
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
                        <span className="text-[11px] font-bold text-gray-400">적용 중인 필터:</span>
                        {categoryFilter !== "all" && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-300 px-3 py-1 text-xs font-bold text-emerald-800">
                                카테고리: {categoryFilter}
                                <button type="button" onClick={() => { setCategoryFilter("all"); setTypeFilter("all"); void load(query, sort, reviewFilter, sourceFilter, "all", "all", 1); }}>
                                    <X size={13} className="hover:text-emerald-950" />
                                </button>
                            </span>
                        )}
                        {typeFilter !== "all" && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-300 px-3 py-1 text-xs font-bold text-emerald-800">
                                세부 유형: {typeFilter}
                                <button type="button" onClick={() => { setTypeFilter("all"); void load(query, sort, reviewFilter, sourceFilter, categoryFilter, "all", 1); }}>
                                    <X size={13} className="hover:text-emerald-950" />
                                </button>
                            </span>
                        )}
                        {sourceFilter !== "all" && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-300 px-3 py-1 text-xs font-bold text-blue-800">
                                출처: {sourceFilter}
                                <button type="button" onClick={() => { setSourceFilter("all"); void load(query, sort, reviewFilter, "all", categoryFilter, typeFilter, 1); }}>
                                    <X size={13} className="hover:text-blue-950" />
                                </button>
                            </span>
                        )}
                        {reviewFilter !== "all" && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-300 px-3 py-1 text-xs font-bold text-amber-800">
                                검수: {reviewFilter === "unreviewed" ? "미완료" : reviewFilter === "reviewed" ? "완료" : "⚠️ 중복 장소만"}
                                <button type="button" onClick={() => { setReviewFilter("all"); void load(query, sort, "all", sourceFilter, categoryFilter, typeFilter, 1); }}>
                                    <X size={13} className="hover:text-amber-950" />
                                </button>
                            </span>
                        )}
                    </div>
                )}
            </form>
        </section>

        {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-gray-500">
            <div>
                {loading ? "불러오는 중..." : <>총 <strong className="text-sm font-black text-emerald-700">{totalCount.toLocaleString("ko-KR")}</strong>개 장소 데이터 <span className="ml-2 font-normal text-gray-500">(페이지당 {pageSize}개 표시 · {page}/{totalPages} 페이지)</span></>}
            </div>
            <button
                type="button"
                disabled={batchMerging || loading}
                onClick={() => void handleBatchMerge()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-purple-300 bg-purple-50 px-3.5 py-1.5 text-xs font-black text-purple-700 shadow-2xs transition hover:bg-purple-100 disabled:opacity-50"
            >
                <Sparkles size={14} className="text-purple-600" />
                {batchMerging ? "중복 데이터 자동 병합 중..." : "실제 중복 데이터 1-Click 자동 일괄 병합"}
            </button>
        </div>
        <div className="mt-3 grid gap-4 xl:grid-cols-2">{rows.map(row => <Editor key={row.id} row={row} saving={saving === row.id} deleting={deleting === row.id} saved={savedId === row.id} edit={edit} save={save} remove={remove} replace={setReplaceRow} merge={setMergeRow} viewLocation={setMapRow} />)}</div>
        {!loading && rows.length === 0 && <div className="mt-4 rounded-xl border border-dashed bg-white p-12 text-center text-sm text-gray-500">조건에 맞는 장소가 없습니다.</div>}
        {totalPages > 1 && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-1.5 py-4">
                <button
                    type="button"
                    disabled={page <= 1 || loading}
                    onClick={() => void load(query, sort, reviewFilter, sourceFilter, categoryFilter, typeFilter, page - 1)}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-300 bg-white px-3 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300"
                >
                    이전
                </button>
                {generatePageNumbers(page, totalPages).map((p, idx) => (
                    p === -1 ? (
                        <span key={`dots-${idx}`} className="px-1.5 text-xs text-gray-400">...</span>
                    ) : (
                        <button
                            key={p}
                            type="button"
                            disabled={loading}
                            onClick={() => void load(query, sort, reviewFilter, sourceFilter, categoryFilter, typeFilter, p)}
                            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold transition ${page === p ? "bg-gray-950 text-white shadow-sm" : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"}`}
                        >
                            {p}
                        </button>
                    )
                ))}
                <button
                    type="button"
                    disabled={page >= totalPages || loading}
                    onClick={() => void load(query, sort, reviewFilter, sourceFilter, categoryFilter, typeFilter, page + 1)}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-300 bg-white px-3 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300"
                >
                    다음
                </button>
            </div>
        )}
        {mapRow && <GoogleLocationModal row={mapRow} onClose={() => setMapRow(null)} />}
        {replaceRow && <NominatimReplacementModal row={replaceRow} onClose={() => setReplaceRow(null)} onReplaced={replaced} />}
        {mergeRow && <PlaceMergeModal row={mergeRow} rows={rows} onClose={() => setMergeRow(null)} onMerged={() => { setMergeRow(null); void load(query, sort, reviewFilter, sourceFilter, categoryFilter, typeFilter, page); }} />}
    </section></main></RequireAuth>;
}

function Editor({ row, saving, deleting, saved, edit, save, remove, replace, merge, viewLocation }: { row: PlaceRow; saving: boolean; deleting: boolean; saved: boolean; edit: (id: number | string, key: keyof PlaceRow, value: string | number) => void; save: (id: number | string) => Promise<void>; remove: (row: PlaceRow) => Promise<void>; replace: (row: PlaceRow) => void; merge: (row: PlaceRow) => void; viewLocation: (row: PlaceRow) => void }) {
    const field = (key: keyof PlaceRow, label: string, numeric = false) => <label className="grid gap-1 text-xs font-bold text-gray-600">{label}<input type={numeric ? "number" : "text"} step={numeric ? "any" : undefined} value={(row[key] as string | number | null) ?? ""} onChange={e => edit(row.id, key, numeric ? Number(e.target.value) : e.target.value)} className="rounded-lg border px-3 py-2 text-sm text-gray-950 outline-none" /></label>;
    const categoryOptions: Array<readonly [string, string]> = [...NOMINATIM_CATEGORY_OPTIONS];
    if (row.category && !categoryOptions.some(([value]) => value === row.category)) categoryOptions.push([row.category, `${row.category} · 현재 값`]);
    const typeOptions: Array<readonly [string, string]> = [...(NOMINATIM_TYPE_OPTIONS[row.category] ?? [])];
    if (row.placeType && !typeOptions.some(([value]) => value === row.placeType)) typeOptions.push([row.placeType, `${row.placeType} · 현재 값`]);
    if (typeOptions.length === 0) typeOptions.push(["unknown", "unknown · 미분류"]);
    if (row.source === "ML_TRAINING") return <TrainingPlaceEditor row={row} saving={saving} deleting={deleting} saved={saved} edit={edit} save={save} remove={remove} viewLocation={viewLocation} />;
    return <article className="rounded-xl border bg-white p-5 shadow-sm"><div className="mb-4 flex justify-between gap-3"><div><div className="font-black">{row.displayTitle || row.title}</div><div className="mt-1 break-all text-[11px] text-gray-400">{row.source} · {row.sourcePlaceId}</div>{row.source.toUpperCase() === "GOOGLE" && row.sourceDataExpiresAt && <div className="mt-1 text-[11px] font-bold text-amber-700">임시 데이터 만료: {new Date(row.sourceDataExpiresAt).toLocaleString("ko-KR")}</div>}</div><div className="flex h-fit flex-wrap gap-1.5 font-bold">{(row.source.toUpperCase() === "CUSTOM" || (row.googlePlaceId && row.source.toUpperCase() !== "GOOGLE")) && <span className="rounded-full bg-purple-50 px-2 py-1 text-[11px] font-bold text-purple-700">Custom</span>}<span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">검수 {row.reviewCount}회</span><span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-bold">선택 {row.selectionCount}회</span></div></div>
        <div className="grid gap-3 sm:grid-cols-2">{field("title", "기본 이름")}{field("displayTitle", "표시 이름")}{field("titleKo", "한국어 라벨")}{field("titleJa", "일본어 라벨")}{field("titleEn", "영문 라벨")}<label className="grid gap-1 text-xs font-bold text-gray-600">Nominatim 카테고리<select value={row.category || "place"} onChange={e => { const category = e.target.value; edit(row.id, "category", category); edit(row.id, "placeType", (NOMINATIM_TYPE_OPTIONS[category]?.[0]?.[0]) || "unknown"); }} className="rounded-lg border bg-white px-3 py-2 text-sm text-gray-950 outline-none">{categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="grid gap-1 text-xs font-bold text-gray-600">Nominatim 유형(type)<select value={row.placeType || "unknown"} onChange={e => edit(row.id, "placeType", e.target.value)} className="rounded-lg border bg-white px-3 py-2 text-sm text-gray-950 outline-none">{typeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{field("selectedQuery", "검색 별칭")}</div>
        <label className="mt-3 grid gap-1 text-xs font-bold text-gray-600">주소/설명<textarea rows={2} value={row.subtitle ?? ""} onChange={e => edit(row.id, "subtitle", e.target.value)} className="rounded-lg border px-3 py-2 text-sm outline-none" /></label><div className="mt-3 grid grid-cols-2 gap-3">{field("lat", "위도", true)}{field("lon", "경도", true)}</div>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            {saved && <span className="mr-1 text-xs font-bold text-emerald-700">저장 완료 · 검수 {row.reviewCount}회</span>}
            <button type="button" onClick={() => merge(row)} className="inline-flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-4 py-2 text-xs font-black text-purple-700 hover:bg-purple-100">
                <Layers size={14} />중복 병합
            </button>
            {row.source.toUpperCase() === "GOOGLE" ? (
                <button type="button" onClick={() => replace(row)} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-black text-blue-700 hover:bg-blue-100">
                    <ArrowRightLeft size={14} />Nominatim으로 대체
                </button>
            ) : (
                <button type="button" onClick={() => replace(row)} className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-800 hover:bg-emerald-100">
                    <ArrowRightLeft size={14} />위치/장소 재검색 교정
                </button>
            )}
            <button type="button" disabled={deleting} onClick={() => void remove(row)} className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-xs font-black text-red-600 hover:bg-red-50 disabled:text-gray-300">
                <Trash2 size={14} />{deleting ? "삭제 중" : "검색 데이터 삭제"}
            </button>
            <button type="button" onClick={() => viewLocation(row)} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-black text-gray-800 hover:bg-gray-50">
                <MapPin size={14} />위치 보기
            </button>
            <button type="button" disabled={saving || deleting} onClick={() => void save(row.id)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-black text-white disabled:bg-gray-300">
                <Save size={14} />{saving ? "저장 중" : "수정하고 검수"}
            </button>
        </div>
    </article>;
}

function TrainingPlaceEditor({ row, saving, deleting, saved, edit, save, remove, viewLocation }: { row: PlaceRow; saving: boolean; deleting: boolean; saved: boolean; edit: (id: number | string, key: keyof PlaceRow, value: string | number) => void; save: (id: number | string) => Promise<void>; remove: (row: PlaceRow) => Promise<void>; viewLocation: (row: PlaceRow) => void }) {
    const coordinatesKnown = Number.isFinite(row.lat) && Number.isFinite(row.lon);
    const field = (key: keyof PlaceRow, label: string, numeric = false) => <label className="grid gap-1 text-xs font-bold text-gray-600">{label}<input type={numeric ? "number" : "text"} step={numeric ? "any" : undefined} value={(row[key] as string | number | null) ?? ""} onChange={event => edit(row.id, key, numeric ? Number(event.target.value) : event.target.value)} className="rounded-lg border px-3 py-2 text-sm text-gray-950 outline-none" /></label>;
    return <article className="rounded-xl border bg-white p-5 shadow-sm"><div className="mb-4 flex justify-between gap-3"><div><div className="font-black">{row.displayTitle || row.title}</div><div className="mt-1 break-all text-[11px] text-gray-400">ML_TRAINING · {row.sourcePlaceId}</div><div className="mt-2 flex flex-wrap gap-1">{(row.trainingSources?.length ? row.trainingSources : ["출처 미상"]).map(source => <span key={source} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-600">{source}</span>)}</div></div><div className="flex h-fit gap-1.5"><span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">검수 {row.reviewCount}회</span><span className="rounded-full bg-violet-50 px-2 py-1 text-[11px] font-bold text-violet-700">학습 포함</span></div></div>
        <div className="grid gap-3 sm:grid-cols-2">{field("title", "기본 이름")}{field("displayTitle", "표시 이름")}{field("titleKo", "한국어 라벨")}{field("titleJa", "일본어 라벨")}{field("titleEn", "영문 라벨")}<label className="grid gap-1 text-xs font-bold text-gray-600">Nominatim category<input value={row.category || "place"} readOnly className="rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-950" /></label><label className="grid gap-1 text-xs font-bold text-gray-600">Nominatim type<input value={row.placeType || "unknown"} readOnly className="rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-950" /></label><label className="grid gap-1 text-xs font-bold text-violet-700">실제 ML 카테고리<input value={row.mlCategory || `${row.category || "place"}/${row.placeType || "unknown"}`} readOnly className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-black text-violet-900" /></label><label className="grid gap-1 text-xs font-bold text-gray-600">일정용 서비스 카테고리<input value={row.serviceCategory || "place"} readOnly className="rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-950" /></label>{field("selectedQuery", "검색 별칭")}</div>
        <label className="mt-3 grid gap-1 text-xs font-bold text-gray-600">주소/설명<textarea rows={2} value={row.subtitle ?? ""} onChange={event => edit(row.id, "subtitle", event.target.value)} className="rounded-lg border px-3 py-2 text-sm outline-none" /></label><div className="mt-3 grid grid-cols-2 gap-3">{field("lat", "위도", true)}{field("lon", "경도", true)}</div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-gray-500"><span>인기도 피처 {typeof row.popularity === "number" ? row.popularity.toFixed(4) : "없음"}</span><span>Nominatim category/type 조합이 ML 학습에 직접 반영됩니다.</span></div>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">{saved && <span className="mr-1 text-xs font-bold text-emerald-700">저장 완료 · 검수 {row.reviewCount}회</span>}<button type="button" disabled={deleting} onClick={() => void remove(row)} className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2 text-xs font-black text-violet-700 hover:bg-violet-100 disabled:text-gray-300"><Trash2 size={14} />{deleting ? "삭제 중" : "ML 학습 데이터 삭제"}</button><button type="button" disabled={!coordinatesKnown} onClick={() => viewLocation(row)} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-black text-gray-800 hover:bg-gray-50 disabled:text-gray-300"><MapPin size={14} />위치 보기</button><button type="button" disabled={saving || deleting || !coordinatesKnown || !(row.displayTitle || row.title).trim()} onClick={() => void save(row.id)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-black text-white disabled:bg-gray-300"><Save size={14} />{saving ? "저장 중" : "수정하고 검수"}</button></div></article>;
}

function NominatimReplacementModal({ row, onClose, onReplaced }: { row: PlaceRow; onClose: () => void; onReplaced: (oldId: number | string, updated: PlaceRow) => void }) {
    const isGoogle = row.source.toUpperCase() === "GOOGLE";
    const [query, setQuery] = useState(row.titleKo || row.displayTitle || row.title);
    const [countryCode, setCountryCode] = useState<"JP" | "KR">("JP");
    const [nearbyLat, setNearbyLat] = useState(String(row.lat));
    const [nearbyLon, setNearbyLon] = useState(String(row.lon));
    const [nearbyRadius, setNearbyRadius] = useState("25");
    const [coordinatesCopied, setCoordinatesCopied] = useState(false);
    const [results, setResults] = useState<NominatimCandidate[]>([]);
    const [searching, setSearching] = useState(false);
    const [replacing, setReplacing] = useState<string | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !replacing) onClose(); };
        document.addEventListener("keydown", closeOnEscape);
        return () => document.removeEventListener("keydown", closeOnEscape);
    }, [onClose, replacing]);

    const searchNominatim = async () => {
        const value = query.trim();
        if (!value || searching) return;
        setSearching(true); setError(""); setResults([]);
        try {
            const response = await fetch(`/api/admin/place-dataset/nominatim-search?countryCode=${countryCode}&q=${encodeURIComponent(value)}`, { cache: "no-store" });
            if (!response.ok) throw new Error(await response.text() || "Nominatim 검색에 실패했습니다.");
            setResults(await response.json() as NominatimCandidate[]);
        } catch (cause) { setError(cause instanceof Error ? cause.message : "Nominatim 검색에 실패했습니다."); }
        finally { setSearching(false); }
    };

    const searchOverpassNearby = async () => {
        const lat = Number(nearbyLat); const lon = Number(nearbyLon); const radius = Number(nearbyRadius);
        if (searching || !Number.isFinite(lat) || !Number.isFinite(lon)) return;
        setSearching(true); setError(""); setResults([]);
        try {
            const params = new URLSearchParams({ lat: String(lat), lon: String(lon), radius: String(radius) });
            const response = await fetch(`/api/admin/place-dataset/overpass-nearby?${params}`, { cache: "no-store" });
            if (!response.ok) throw new Error(await response.text() || "Overpass 주변 지물 검색에 실패했습니다.");
            setResults(await response.json() as NominatimCandidate[]);
        } catch (cause) { setError(cause instanceof Error ? cause.message : "Overpass 주변 지물 검색에 실패했습니다."); }
        finally { setSearching(false); }
    };

    const copyCurrentCoordinates = async () => {
        const lat = String(row.lat); const lon = String(row.lon);
        setNearbyLat(lat); setNearbyLon(lon); setCoordinatesCopied(true);
        try { await navigator.clipboard.writeText(`${lat}, ${lon}`); } catch { /* 입력칸 복사는 유지 */ }
        window.setTimeout(() => setCoordinatesCopied(false), 1500);
    };

    const apply = async (candidate: NominatimCandidate) => {
        if (replacing) return;
        setReplacing(candidate.id); setError("");
        try {
            const response = await fetch(`/api/admin/place-dataset/${row.id}/replace-with-nominatim`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ place: candidate, query: query.trim(), countryCode }),
            });
            if (!response.ok) throw new Error(await response.text() || "Nominatim 교정에 실패했습니다.");
            onReplaced(row.id, await response.json() as PlaceRow);
        } catch (cause) { setError(cause instanceof Error ? cause.message : "Nominatim 교정에 실패했습니다."); }
        finally { setReplacing(null); }
    };

    return <div role="dialog" aria-modal="true" aria-label={isGoogle ? "Nominatim 장소로 대체" : "위치/장소 재검색 교정"} className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4" onMouseDown={event => { if (event.target === event.currentTarget && !replacing) onClose(); }}>
        <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b px-5 py-4"><div><h2 className="text-lg font-black">{isGoogle ? "Nominatim 장소로 대체" : "위치/장소 재검색 교정"}</h2><p className="mt-1 text-xs text-gray-500">{isGoogle ? "Google 데이터를 오픈소스 Nominatim 주소·좌표·OSM ID로 대체합니다." : "로컬 Nominatim 검색으로 올바른 위치·좌표·OSM ID를 새로 교정합니다."}</p></div><button type="button" disabled={Boolean(replacing)} onClick={onClose} aria-label="닫기" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-40"><X size={20} /></button></div>
            <div className="border-b bg-amber-50 px-5 py-3 text-xs font-bold text-amber-800">{isGoogle ? "Google 좌표는 검색 보정에 사용하지 않고 로컬 Nominatim으로 대체합니다." : "검색 결과 중 올바른 위치를 선택하면 해당 장소의 좌표와 주소가 새로 교정 적용됩니다."}</div>
            <form onSubmit={event => { event.preventDefault(); void searchNominatim(); }} className="flex flex-wrap gap-2 border-b p-5"><input value={query} onChange={event => setQuery(event.target.value)} aria-label="Nominatim 검색어" className="min-w-64 flex-1 rounded-xl border px-4 py-3 text-sm outline-none focus:border-emerald-500" /><select value={countryCode} onChange={event => setCountryCode(event.target.value as "JP" | "KR")} aria-label="검색 국가" className="rounded-xl border bg-white px-4 text-sm font-bold"><option value="JP">일본</option><option value="KR">한국</option></select><button disabled={searching || !query.trim()} className="inline-flex items-center gap-2 rounded-xl bg-gray-950 px-5 text-sm font-black text-white disabled:bg-gray-300">{searching ? <LoaderCircle className="animate-spin" size={16} /> : <Search size={16} />}검색</button></form>
            <form onSubmit={event => { event.preventDefault(); void searchOverpassNearby(); }} className="border-b bg-emerald-50/60 p-5"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2 text-sm font-black text-emerald-900"><MapPin size={16} />좌표 주변 음식점·상점·테마파크 검색 · Overpass</div><button type="button" onClick={() => void copyCurrentCoordinates()} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 text-[11px] font-black text-emerald-800 hover:bg-emerald-100">{coordinatesCopied ? <Check size={13} /> : <Copy size={13} />}{coordinatesCopied ? "복사됨" : "좌표 복사"}</button></div><div className="flex flex-wrap gap-2"><input type="number" step="any" value={nearbyLat} onChange={event => setNearbyLat(event.target.value)} aria-label="주변 검색 위도" placeholder="위도" className="min-w-40 flex-1 rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500" /><input type="number" step="any" value={nearbyLon} onChange={event => setNearbyLon(event.target.value)} aria-label="주변 검색 경도" placeholder="경도" className="min-w-40 flex-1 rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500" /><select value={nearbyRadius} onChange={event => setNearbyRadius(event.target.value)} aria-label="주변 검색 반경" className="rounded-xl border bg-white px-4 text-sm font-bold"><option value="5">5m</option><option value="10">10m</option><option value="25">25m</option><option value="50">50m</option></select><button type="submit" disabled={searching || !nearbyLat || !nearbyLon} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white disabled:bg-gray-300">{searching ? <LoaderCircle className="animate-spin" size={16} /> : <Layers size={16} />}주변 지물 검색</button></div><p className="mt-2 text-[11px] font-semibold text-emerald-800">음식점·카페·상점과 디즈니랜드·디즈니씨·해리포터 스튜디오 같은 테마파크 후보를 거리순으로 불러옵니다. 테마파크 선택 시 학습 분류도 tourism/theme_park로 저장됩니다.</p></form>
            <div className="overflow-y-auto p-5">{error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}{!searching && results.length === 0 && <div className="rounded-xl border border-dashed p-10 text-center text-sm text-gray-500">검색어를 확인한 뒤 Nominatim 검색을 실행하세요.</div>}<div className="grid gap-3">{results.map(candidate => <article key={candidate.id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5 font-black text-gray-950"><span>{candidate.displayTitle || candidate.title}</span><ProviderBadge provider={candidate.provider || "nominatim"} /></div><div className="mt-1 text-xs leading-5 text-gray-500">{candidate.subtitle}</div><div className="mt-1 text-[11px] font-bold text-emerald-700">{candidate.category || "place"} · {candidate.type || "unknown"}</div><div className="mt-1 text-[11px] text-gray-400">{candidate.id} · {candidate.lat.toFixed(6)}, {candidate.lon.toFixed(6)}</div></div><button type="button" disabled={Boolean(replacing)} onClick={() => void apply(candidate)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-black text-white disabled:bg-gray-300">{replacing === candidate.id ? <LoaderCircle className="animate-spin" size={14} /> : <ArrowRightLeft size={14} />}이 결과로 대체</button></article>)}</div></div>
        </div>
    </div>;
}

function GoogleLocationModal({ row, onClose }: { row: PlaceRow; onClose: () => void }) {
    const mapElement = useRef<HTMLDivElement | null>(null);
    const [mapError, setMapError] = useState("");

    useEffect(() => {
        const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
        document.addEventListener("keydown", closeOnEscape);
        let active = true;
        void loadAdminGoogleMaps()
            .then(maps => {
                if (!active || !mapElement.current) return;
                const position = { lat: Number(row.lat), lng: Number(row.lon) };
                const map = new maps.Map(mapElement.current, {
                    center: position,
                    zoom: 16,
                    mapTypeControl: true,
                    streetViewControl: true,
                    fullscreenControl: true,
                });
                new maps.Marker({ map, position, title: row.displayTitle || row.title });
            })
            .catch(cause => {
                if (active) setMapError(cause instanceof Error ? cause.message : "Google 지도를 불러오지 못했습니다.");
            });
        return () => {
            active = false;
            document.removeEventListener("keydown", closeOnEscape);
        };
    }, [onClose, row]);

    return <div role="dialog" aria-modal="true" aria-label="장소 위치 보기" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
        <div className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b px-5 py-4">
                <div><h2 className="text-lg font-black text-gray-950">{row.displayTitle || row.title}</h2><p className="mt-1 text-xs text-gray-500">{row.lat.toFixed(6)}, {row.lon.toFixed(6)} · Google Maps</p></div>
                <button type="button" onClick={onClose} aria-label="닫기" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X size={20} /></button>
            </div>
            {mapError ? <div className="p-10 text-center text-sm font-bold text-red-600">{mapError}</div> : <div ref={mapElement} className="h-[65vh] min-h-[420px] w-full bg-gray-100" />}
        </div>
    </div>;
}

type FieldChoice = "A" | "B";
type FieldChoices = Record<string, FieldChoice>;

const MERGE_FIELDS: { key: string; label: string; render: (r: PlaceRow) => string | null | undefined }[] = [
    { key: "title",        label: "기본 이름 (Title)",        render: r => r.title },
    { key: "displayTitle", label: "표시 이름 (Display)",      render: r => r.displayTitle },
    { key: "titleKo",      label: "한국어 라벨 (TitleKo)",    render: r => r.titleKo },
    { key: "titleEn",      label: "영어 라벨 (TitleEn)",      render: r => r.titleEn },
    { key: "titleJa",      label: "일본어 라벨 (TitleJa)",    render: r => r.titleJa },
    { key: "subtitle",     label: "주소 / 설명 (Subtitle)",   render: r => r.subtitle },
    { key: "category",     label: "카테고리 (Category)",      render: r => r.category },
    { key: "placeType",    label: "세부 유형 (PlaceType)",    render: r => r.placeType },
    { key: "googlePlaceId",label: "Google Place ID",          render: r => r.googlePlaceId },
    { key: "coords",       label: "좌표 (Lat, Lon)",          render: r => `${r.lat.toFixed(6)}, ${r.lon.toFixed(6)}` },
];

function buildDefaultChoices(a: PlaceRow, b: PlaceRow): FieldChoices {
    const choices: FieldChoices = {};
    for (const f of MERGE_FIELDS) {
        const aVal = f.render(a);
        const bVal = f.render(b);
        // Default: prefer whichever has a value; if both, prefer A
        choices[f.key] = (!aVal && bVal) ? "B" : "A";
    }
    return choices;
}

function PlaceMergeModal({ row, rows, onClose, onMerged }: { row: PlaceRow; rows: PlaceRow[]; onClose: () => void; onMerged: () => void }) {
    const [selectedSourceId, setSelectedSourceId] = useState<string | number>("");
    const [choices, setChoices] = useState<FieldChoices>({});
    const [merging, setMerging] = useState(false);
    const [error, setError] = useState("");

    const candidates = useMemo(() => {
        return rows.filter(r => {
            if (r.id === row.id) return false;
            const targetTitle = compactAlias(row.titleKo || row.displayTitle || row.title);
            const rTitle = compactAlias(r.titleKo || r.displayTitle || r.title);
            const titleMatch = Boolean(targetTitle && rTitle && (targetTitle === rTitle || targetTitle.includes(rTitle) || rTitle.includes(targetTitle)));
            const sameGoogleId = Boolean(r.googlePlaceId && row.googlePlaceId && r.googlePlaceId === row.googlePlaceId);
            const closeCoords = Math.abs(r.lat - row.lat) < 0.005 && Math.abs(r.lon - row.lon) < 0.005;
            return titleMatch || sameGoogleId || closeCoords;
        });
    }, [row, rows]);

    // When a new source is selected, reset choices to smart defaults
    const handleSelectSource = (id: string | number) => {
        setSelectedSourceId(id);
        const src = rows.find(r => String(r.id) === String(id));
        if (src) setChoices(buildDefaultChoices(row, src));
        else setChoices({});
    };

    useEffect(() => {
        if (candidates.length > 0 && !selectedSourceId) {
            handleSelectSource(candidates[0].id);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [candidates]);

    const selectedSource = rows.find(r => String(r.id) === String(selectedSourceId));
    const distance = selectedSource ? distanceMeters(row.lat, row.lon, selectedSource.lat, selectedSource.lon) : null;

    const toggle = (key: string) =>
        setChoices(prev => ({ ...prev, [key]: prev[key] === "A" ? "B" : "A" }));

    const applyMerge = async () => {
        if (!selectedSource || merging) return;
        setMerging(true); setError("");
        try {
            const response = await fetch("/api/admin/place-dataset/merge", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ targetId: Number(row.id), sourceId: Number(selectedSource.id), fieldChoices: choices }),
            });
            if (!response.ok) throw new Error(await response.text() || "중복 장소 병합에 실패했습니다.");
            onMerged();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "중복 장소 병합에 실패했습니다.");
        } finally {
            setMerging(false);
        }
    };

    return (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[110] flex items-center justify-center bg-black/65 p-4" onMouseDown={e => { if (e.target === e.currentTarget && !merging) onClose(); }}>
            <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

                {/* ── HEADER ── */}
                <div className="flex items-start justify-between border-b bg-gradient-to-r from-emerald-50 to-purple-50 px-6 py-4">
                    <div>
                        <h2 className="text-xl font-black text-gray-950 flex items-center gap-2">
                            <Layers className="text-purple-600" size={22} /> 중복 장소 필드별 선택 병합 (Merge Workbench)
                        </h2>
                        <p className="mt-1 text-xs text-gray-600">각 항목마다 <strong className="text-emerald-700">A</strong> (기준 장소) 또는 <strong className="text-purple-700">B</strong> (병합 장소) 중 하나를 골라 최종 <strong className="text-blue-700">C</strong> (결과)를 만든 뒤 병합합니다.</p>
                    </div>
                    <button type="button" disabled={merging} onClick={onClose} aria-label="닫기" className="rounded-lg p-2 text-gray-500 hover:bg-white/80 disabled:opacity-40"><X size={20} /></button>
                </div>

                {/* ── BODY ── */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">

                    {/* CANDIDATE PICKER */}
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-gray-700">병합 대상 장소 선택 (B 장소 · 검수 후 삭제됩니다)</label>
                        {candidates.length > 0 && (
                            <div className="grid gap-2 sm:grid-cols-2 mb-2">
                                {candidates.map((c: PlaceRow) => {
                                    const dist = distanceMeters(row.lat, row.lon, c.lat, c.lon);
                                    const isSelected = String(selectedSourceId) === String(c.id);
                                    return (
                                        <div key={c.id} onClick={() => handleSelectSource(c.id)}
                                            className={`cursor-pointer rounded-xl border p-3 text-xs transition ${isSelected ? "border-purple-600 bg-purple-50 ring-2 ring-purple-600/30" : "border-gray-200 hover:bg-gray-50"}`}>
                                            <div className="flex items-center justify-between font-bold text-gray-900">
                                                <span>{c.displayTitle || c.title}</span>
                                                <span className="text-[10px] text-gray-400">ID #{c.id}</span>
                                            </div>
                                            <div className="mt-1 text-[11px] text-gray-500 truncate">{c.subtitle || "주소 없음"}</div>
                                            <div className="mt-1.5 flex gap-2 text-[10px] font-bold">
                                                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">{c.source}</span>
                                                <span className="text-purple-700">📍 {dist < 1000 ? `${dist}m` : `${(dist / 1000).toFixed(1)}km`}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        <select value={selectedSourceId} onChange={e => handleSelectSource(e.target.value)}
                            className="h-10 w-full rounded-xl border border-gray-300 bg-white px-3 text-xs font-bold text-gray-900 outline-none focus:border-purple-600">
                            <option value="">전체 목록에서 직접 선택...</option>
                            {rows.filter(r => r.id !== row.id).map(r => (
                                <option key={r.id} value={r.id}>[ID #{r.id}] {r.displayTitle || r.title} · {r.subtitle || r.source}</option>
                            ))}
                        </select>
                    </div>

                    {/* FIELD PICKER TABLE */}
                    {selectedSource ? (
                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <h3 className="text-sm font-extrabold text-gray-950 flex items-center gap-2">
                                    <SlidersHorizontal size={16} className="text-blue-600" />
                                    필드별 A/B 선택 → C 결과 미리보기
                                    {distance != null && <span className="rounded-full bg-purple-100 border border-purple-300 px-3 py-1 text-xs font-black text-purple-800 ml-2">📍 {distance < 1000 ? `${distance}m` : `${(distance / 1000).toFixed(1)}km`} 이격</span>}
                                </h3>
                                <div className="flex gap-2 text-[11px]">
                                    <button onClick={() => setChoices(Object.fromEntries(MERGE_FIELDS.map(f => [f.key, "A" as FieldChoice])))}
                                        className="rounded-lg border border-emerald-400 bg-emerald-50 px-3 py-1 font-bold text-emerald-800 hover:bg-emerald-100">전체 A 선택</button>
                                    <button onClick={() => setChoices(Object.fromEntries(MERGE_FIELDS.map(f => [f.key, "B" as FieldChoice])))}
                                        className="rounded-lg border border-purple-400 bg-purple-50 px-3 py-1 font-bold text-purple-800 hover:bg-purple-100">전체 B 선택</button>
                                    <button onClick={() => setChoices(buildDefaultChoices(row, selectedSource))}
                                        className="rounded-lg border border-gray-300 bg-white px-3 py-1 font-bold text-gray-700 hover:bg-gray-100">스마트 초기화</button>
                                </div>
                            </div>

                            <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
                                <table className="w-full text-xs border-collapse">
                                    <thead>
                                        <tr className="border-b font-bold text-[11px]">
                                            <th className="p-2.5 text-left bg-gray-50 text-gray-600 w-[15%]">항목</th>
                                            <th className="p-2.5 text-center bg-emerald-50 border-x border-emerald-200 text-emerald-800 w-[5%]">선택</th>
                                            <th className="p-2.5 text-left bg-emerald-50/60 text-emerald-900 w-[27%]">🟢 A — 기준 장소 (ID #{row.id})</th>
                                            <th className="p-2.5 text-center bg-purple-50 border-x border-purple-200 text-purple-800 w-[5%]">선택</th>
                                            <th className="p-2.5 text-left bg-purple-50/60 text-purple-900 w-[27%]">🟣 B — 병합 장소 (ID #{selectedSource.id})</th>
                                            <th className="p-2.5 text-left bg-blue-50/80 text-blue-900 w-[21%]">🔵 C — 병합 결과</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 bg-white">
                                        {MERGE_FIELDS.map(f => {
                                            const aVal = f.render(row) || "";
                                            const bVal = f.render(selectedSource) || "";
                                            const choice = choices[f.key] ?? "A";
                                            const cVal = choice === "B" ? bVal : aVal;
                                            const identical = aVal === bVal;
                                            return (
                                                <tr key={f.key} className={`transition ${identical ? "opacity-60" : ""}`}>
                                                    <td className="p-2.5 font-bold text-gray-600 bg-gray-50/40 text-[11px]">{f.label}</td>

                                                    {/* A TOGGLE */}
                                                    <td className="p-2 text-center bg-emerald-50/30 border-x border-emerald-100">
                                                        <button onClick={() => setChoices(p => ({ ...p, [f.key]: "A" }))}
                                                            className={`h-7 w-7 rounded-full border-2 transition flex items-center justify-center mx-auto ${choice === "A" ? "border-emerald-500 bg-emerald-500 text-white shadow-sm" : "border-gray-300 text-gray-300 hover:border-emerald-400"}`}>
                                                            {choice === "A" ? <span className="text-[10px] font-black">A</span> : <span className="text-[10px] font-bold text-gray-400">A</span>}
                                                        </button>
                                                    </td>

                                                    {/* A VALUE */}
                                                    <td className={`p-2.5 font-medium leading-relaxed break-words ${choice === "A" ? "text-emerald-900 bg-emerald-50/50 font-bold ring-1 ring-inset ring-emerald-300/60" : "text-gray-500 bg-white"}`}>
                                                        {aVal || <span className="italic text-gray-300">없음</span>}
                                                    </td>

                                                    {/* B TOGGLE */}
                                                    <td className="p-2 text-center bg-purple-50/30 border-x border-purple-100">
                                                        <button onClick={() => setChoices(p => ({ ...p, [f.key]: "B" }))}
                                                            className={`h-7 w-7 rounded-full border-2 transition flex items-center justify-center mx-auto ${choice === "B" ? "border-purple-500 bg-purple-500 text-white shadow-sm" : "border-gray-300 text-gray-300 hover:border-purple-400"}`}>
                                                            {choice === "B" ? <span className="text-[10px] font-black">B</span> : <span className="text-[10px] font-bold text-gray-400">B</span>}
                                                        </button>
                                                    </td>

                                                    {/* B VALUE */}
                                                    <td className={`p-2.5 font-medium leading-relaxed break-words ${choice === "B" ? "text-purple-900 bg-purple-50/50 font-bold ring-1 ring-inset ring-purple-300/60" : "text-gray-500 bg-white"}`}>
                                                        {bVal || <span className="italic text-gray-300">없음</span>}
                                                    </td>

                                                    {/* C PREVIEW */}
                                                    <td className={`p-2.5 font-bold leading-relaxed break-words bg-blue-50/60 text-blue-900 ${!identical && "ring-1 ring-inset ring-blue-200/60"}`}>
                                                        {cVal || <span className="italic text-gray-400 font-normal">없음</span>}
                                                        {!identical && (
                                                            <span className={`ml-1.5 text-[9px] font-black rounded px-1 py-0.5 ${choice === "A" ? "bg-emerald-100 text-emerald-700" : "bg-purple-100 text-purple-700"}`}>{choice}</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                        {/* COUNTS ROW (always summed, read-only) */}
                                        <tr className="bg-gray-50/70">
                                            <td className="p-2.5 font-bold text-gray-600 text-[11px]">선택 / 검수 횟수</td>
                                            <td className="p-2 bg-emerald-50/30 border-x border-emerald-100" />
                                            <td className="p-2.5 text-emerald-800 font-bold">선택 {row.selectionCount}회 · 검수 {row.reviewCount}회</td>
                                            <td className="p-2 bg-purple-50/30 border-x border-purple-100" />
                                            <td className="p-2.5 text-purple-800 font-bold">선택 {selectedSource.selectionCount}회 · 검수 {selectedSource.reviewCount}회</td>
                                            <td className="p-2.5 text-blue-800 font-extrabold">
                                                선택 {row.selectionCount + selectedSource.selectionCount}회 · 검수 {row.reviewCount + selectedSource.reviewCount}회
                                                <div className="text-[10px] text-gray-500 font-normal mt-0.5">항상 합산됩니다</div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <div className="rounded-xl border border-red-200 bg-red-50/60 p-3 text-xs text-red-700 font-bold">
                                🗑️ 병합 완료 후 <strong>ID #{selectedSource.id}</strong> ({selectedSource.displayTitle || selectedSource.title}) 장소는 DB에서 삭제됩니다.
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center text-xs text-gray-400">
                            상단에서 병합할 B 장소를 선택하세요.
                        </div>
                    )}

                    {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">{error}</div>}
                </div>

                {/* ── FOOTER ── */}
                <div className="flex items-center justify-between border-t bg-gray-50/80 px-6 py-4">
                    <button type="button" disabled={merging} onClick={onClose} className="h-10 rounded-xl border border-gray-300 bg-white px-5 text-xs font-bold text-gray-700 hover:bg-gray-100">
                        취소
                    </button>
                    <button
                        type="button"
                        disabled={!selectedSource || merging}
                        onClick={() => void applyMerge()}
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-700 px-6 text-xs font-black text-white shadow-sm transition hover:bg-blue-800 disabled:bg-gray-300"
                    >
                        {merging ? <LoaderCircle className="animate-spin" size={16} /> : <Layers size={16} />}
                        {merging ? "C 결과로 병합 중..." : "선택한 C 결과로 최종 병합"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
