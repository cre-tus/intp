"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GitCompareArrows, MapPinned, RotateCcw, Route, TrainFront } from "lucide-react";
import type { ItineraryDay } from "@/components/planner/TravelItinerary";

type LatLngTuple = [number, number];
type LeafletLayer = {
    addTo(map: LeafletMap): LeafletLayer;
    remove(): void;
    on?(event: string, handler: () => void): void;
    bindPopup?(content: string): void;
    getBounds?(): unknown;
};
type LeafletMap = {
    setView(center: LatLngTuple, zoom: number): LeafletMap;
    fitBounds(bounds: unknown, options?: { padding: [number, number] }): void;
    __fallbackTilesAdded?: boolean;
};
type LeafletApi = {
    map(element: HTMLElement, options: Record<string, unknown>): LeafletMap;
    tileLayer(url: string, options: Record<string, unknown>): LeafletLayer;
    marker(latLng: LatLngTuple): LeafletLayer;
    polyline(latLngs: LatLngTuple[], options: Record<string, unknown>): LeafletLayer;
};

type RoutePoint = {
    id: string;
    name: string;
    dayId?: string;
    dayTitle?: string;
    lat: number;
    lon: number;
    originalIndex: number;
};

type TransitStop = {
    stopId: string;
    name: string;
    lat: number;
    lon: number;
    distanceMeters: number;
    routes: string[];
};

type NearbyStopsResponse = {
    stops: TransitStop[];
};

type RouteLeg = {
    from: RoutePoint;
    to: RoutePoint;
    distanceKm: number;
    estimatedMinutes: number;
    fromStop: TransitStop;
    toStop: TransitStop;
};

type RouteResult = {
    order: RoutePoint[];
    legs: RouteLeg[];
    costMatrixMinutes: number[][];
    costMatrixDistanceKm: number[][];
    nearestStops: TransitStop[];
    totalDistanceKm: number;
    totalMinutes: number;
    calculationMillis: number;
    costModel: string;
};

type CompareResult = {
    manual: RouteResult;
    optimized: RouteResult;
    savedDistanceKm: number;
    savedMinutes: number;
    improvementPercent: number;
};

declare global {
    interface Window {
        L?: LeafletApi;
    }
}

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const TILE_URL = process.env.NEXT_PUBLIC_TILE_URL || "/tiles/{z}/{x}/{y}.png";

function loadLeaflet(): Promise<LeafletApi> {
    if (typeof window === "undefined") return Promise.reject(new Error("Browser only"));
    if (window.L) return Promise.resolve(window.L);

    return new Promise<LeafletApi>((resolve, reject) => {
        if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = LEAFLET_CSS;
            document.head.appendChild(link);
        }

        const existing = document.querySelector<HTMLScriptElement>(`script[src="${LEAFLET_JS}"]`);
        if (existing) {
            existing.addEventListener("load", () => window.L ? resolve(window.L) : reject(new Error("Leaflet load failed")));
            existing.addEventListener("error", () => reject(new Error("Leaflet load failed")));
            return;
        }

        const script = document.createElement("script");
        script.src = LEAFLET_JS;
        script.async = true;
        script.onload = () => window.L ? resolve(window.L) : reject(new Error("Leaflet load failed"));
        script.onerror = () => reject(new Error("Leaflet load failed"));
        document.body.appendChild(script);
    });
}

export default function MapRoutePanel({ days }: { days: ItineraryDay[] }) {
    const mapElementRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<LeafletMap | null>(null);
    const layersRef = useRef<LeafletLayer[]>([]);
    const [leafletReady, setLeafletReady] = useState(false);
    const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
    const [nearestStopsByPointId, setNearestStopsByPointId] = useState<Record<string, TransitStop | undefined>>({});
    const [optimized, setOptimized] = useState<RouteResult | null>(null);
    const [comparison, setComparison] = useState<CompareResult | null>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState<"optimize" | "compare" | "stops" | null>(null);

    const points = useMemo<RoutePoint[]>(() => {
        let index = 0;
        return days.flatMap((day) =>
            day.activities
                .filter((activity) => Number.isFinite(activity.lat) && Number.isFinite(activity.lon))
                .map((activity) => ({
                    id: activity.id,
                    name: activity.location || activity.activity || `목적지 ${index + 1}`,
                    dayId: day.id,
                    dayTitle: day.dayTitle,
                    lat: activity.lat as number,
                    lon: activity.lon as number,
                    originalIndex: index++,
                }))
        );
    }, [days]);

    const selectedDay = useMemo(
        () => days.find((day) => day.id === selectedDayId) ?? days[0] ?? null,
        [days, selectedDayId]
    );
    const selectedPoints = useMemo(
        () => selectedDay ? points.filter((point) => point.dayId === selectedDay.id) : [],
        [points, selectedDay]
    );

    useEffect(() => {
        setSelectedDayId((current) => {
            if (current && days.some((day) => day.id === current)) return current;
            return days[0]?.id ?? null;
        });
        setOptimized(null);
        setComparison(null);
        setError("");
    }, [days]);

    useEffect(() => {
        if (selectedPoints.length === 0) {
            setNearestStopsByPointId({});
            return;
        }

        let cancelled = false;
        setLoading((current) => current ?? "stops");

        Promise.all(
            selectedPoints.map(async (point) => {
                const params = new URLSearchParams({
                    lat: String(point.lat),
                    lon: String(point.lon),
                    radiusMeters: "1200",
                    limit: "1",
                });
                const res = await fetch(`/api/routes/stops/nearby?${params.toString()}`);
                if (!res.ok) return [point.id, undefined] as const;
                const data = await res.json() as NearbyStopsResponse;
                return [point.id, data.stops[0]] as const;
            })
        )
            .then((items) => {
                if (cancelled) return;
                setNearestStopsByPointId(Object.fromEntries(items));
            })
            .catch(() => {
                if (!cancelled) setNearestStopsByPointId({});
            })
            .finally(() => {
                if (!cancelled) setLoading((current) => current === "stops" ? null : current);
            });

        return () => {
            cancelled = true;
        };
    }, [selectedPoints]);

    useEffect(() => {
        let mounted = true;
        loadLeaflet()
            .then((L) => {
                if (!mounted || !mapElementRef.current || mapRef.current) return;
                const map = L.map(mapElementRef.current, {
                    zoomControl: true,
                    attributionControl: false,
                }).setView([35.6812, 139.7671], 11);

                const localTiles = L.tileLayer(TILE_URL, { maxZoom: 19 }).addTo(map);
                localTiles.on?.("tileerror", () => {
                    if (!map.__fallbackTilesAdded) {
                        map.__fallbackTilesAdded = true;
                        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                            maxZoom: 19,
                            attribution: "OpenStreetMap",
                        }).addTo(map);
                    }
                });

                mapRef.current = map;
                setLeafletReady(true);
            })
            .catch(() => setError("지도를 불러오지 못했습니다."));

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        if (!leafletReady || !window.L || !mapRef.current) return;
        const L = window.L;
        const map = mapRef.current;

        layersRef.current.forEach((layer) => layer.remove());
        layersRef.current = [];

        const routeOrder = optimized?.order ?? selectedPoints;
        routeOrder.forEach((point, idx) => {
            const marker = L.marker([point.lat, point.lon]).addTo(map);
            marker.bindPopup?.(`<strong>${idx + 1}. ${escapeHtml(point.name)}</strong><br/>${escapeHtml(point.dayTitle)}`);
            layersRef.current.push(marker);
        });

        routeOrder.forEach((point) => {
            const stop = nearestStopsByPointId[point.id];
            if (!stop) return;
            const marker = L.marker([stop.lat, stop.lon]).addTo(map);
            marker.bindPopup?.(`<strong>${escapeHtml(stop.name)}</strong><br/>${stop.distanceMeters}m`);
            layersRef.current.push(marker);
        });

        if (routeOrder.length >= 2) {
            const routeLatLngs: LatLngTuple[] = routeOrder.map((point) => [point.lat, point.lon]);
            const dayLatLngs: LatLngTuple[] = selectedPoints.map((point) => [point.lat, point.lon]);
            const dayLine = L.polyline(dayLatLngs, {
                color: "#6b7280",
                weight: 3,
                dashArray: "6 6",
            }).addTo(map);
            const optimizedLine = L.polyline(routeLatLngs, {
                color: "#111827",
                weight: 5,
            }).addTo(map);
            layersRef.current.push(dayLine, optimizedLine);
            const bounds = optimizedLine.getBounds?.();
            if (bounds) map.fitBounds(bounds, { padding: [32, 32] });
        } else if (routeOrder.length === 1) {
            map.setView([routeOrder[0].lat, routeOrder[0].lon], 14);
        }
    }, [leafletReady, nearestStopsByPointId, optimized, selectedPoints]);

    const selectDay = (dayId: string) => {
        setSelectedDayId(dayId);
        setOptimized(null);
        setComparison(null);
        setError("");
    };

    const resetRoute = () => {
        setSelectedDayId(days[0]?.id ?? null);
        setOptimized(null);
        setComparison(null);
        setError("");
    };

    const runOptimize = async () => {
        setError("");
        setLoading("optimize");
        try {
            const result = await postJson<RouteResult>("/api/routes/optimize", { points: selectedPoints });
            setOptimized(hydrateRouteResult(result, selectedPoints));
            setComparison(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "경로 최적화에 실패했습니다.");
        } finally {
            setLoading(null);
        }
    };

    const runCompare = async () => {
        setError("");
        setLoading("compare");
        try {
            const result = await postJson<CompareResult>("/api/routes/compare", { manualOrder: selectedPoints });
            const hydrated = hydrateCompareResult(result, selectedPoints);
            setComparison(hydrated);
            setOptimized(hydrated.optimized);
        } catch (err) {
            setError(err instanceof Error ? err.message : "경로 비교에 실패했습니다.");
        } finally {
            setLoading(null);
        }
    };

    const disabledReason =
        selectedPoints.length < 2
            ? "선택한 Day에 좌표가 있는 장소가 2개 이상이어야 경로를 계산할 수 있습니다."
            : selectedPoints.length > 5
                ? "TSP 최적화는 한 Day 안의 목적지 5개까지 지원합니다."
                : "";

    return (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
            <div className="flex flex-col gap-4 border-b border-gray-200 p-5 md:flex-row md:items-center md:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-lg font-bold text-gray-950">
                        <MapPinned className="h-5 w-5" />
                        Day별 대중교통 경로
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                        {selectedDay ? `${selectedDay.dayTitle} 장소 ${selectedPoints.length}개` : "Day를 추가해주세요"}
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={resetRoute}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                    >
                        <RotateCcw className="h-4 w-4" />
                        초기화
                    </button>
                    <button
                        type="button"
                        onClick={runOptimize}
                        disabled={Boolean(disabledReason) || loading !== null}
                        className="inline-flex items-center gap-2 rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                        <Route className="h-4 w-4" />
                        {loading === "optimize" ? "계산 중" : "TSP 최적화"}
                    </button>
                    <button
                        type="button"
                        onClick={runCompare}
                        disabled={Boolean(disabledReason) || loading !== null}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-900 disabled:cursor-not-allowed disabled:text-gray-300"
                    >
                        <GitCompareArrows className="h-4 w-4" />
                        {loading === "compare" ? "분석 중" : "경로 비교"}
                    </button>
                </div>
            </div>

            <div className="grid lg:grid-cols-[minmax(0,1fr)_420px]">
                <div ref={mapElementRef} className="h-[460px] min-h-[460px] bg-gray-100" />
                <aside className="space-y-4 border-t border-gray-200 p-5 lg:border-l lg:border-t-0">
                    <DaySelector days={days} selectedDayId={selectedDay?.id ?? null} onSelect={selectDay} />
                    {disabledReason && <p className="text-sm text-gray-500">{disabledReason}</p>}
                    {error && <p className="text-sm font-medium text-red-600">{error}</p>}

                    <DayRouteList
                        points={selectedPoints}
                        nearestStopsByPointId={nearestStopsByPointId}
                        loadingStops={loading === "stops"}
                    />

                    {comparison ? (
                        <RouteSummary title="비교 결과" result={comparison.optimized} comparison={comparison} />
                    ) : optimized ? (
                        <RouteSummary title="최적 경로" result={optimized} />
                    ) : null}
                </aside>
            </div>
        </section>
    );
}

function DaySelector({
    days,
    selectedDayId,
    onSelect,
}: {
    days: ItineraryDay[];
    selectedDayId: string | null;
    onSelect: (dayId: string) => void;
}) {
    if (days.length === 0) {
        return <p className="text-sm text-gray-500">Day를 추가하면 해당 Day의 경로만 볼 수 있습니다.</p>;
    }

    return (
        <div className="space-y-2">
            <h3 className="text-sm font-bold text-gray-900">경로를 볼 Day 선택</h3>
            <div className="flex flex-wrap gap-2">
                {days.map((day) => (
                    <button
                        key={day.id}
                        type="button"
                        onClick={() => onSelect(day.id)}
                        className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                            selectedDayId === day.id
                                ? "bg-gray-950 text-white"
                                : "border border-gray-300 text-gray-800 hover:bg-gray-50"
                        }`}
                    >
                        {day.dayTitle}
                    </button>
                ))}
            </div>
        </div>
    );
}

function DayRouteList({
    points,
    nearestStopsByPointId,
    loadingStops,
}: {
    points: RoutePoint[];
    nearestStopsByPointId: Record<string, TransitStop | undefined>;
    loadingStops: boolean;
}) {
    if (points.length === 0) {
        return <p className="text-sm text-gray-500">선택한 Day에 좌표가 있는 장소가 없습니다.</p>;
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-gray-900">선택한 Day 일정</h3>
                {loadingStops && <span className="text-xs text-gray-400">근처 역 조회 중</span>}
            </div>
            <ol className="max-h-[280px] space-y-2 overflow-auto pr-1">
                {points.map((point, idx) => {
                    const stop = nearestStopsByPointId[point.id];
                    return (
                        <li key={point.id} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
                            <div className="font-semibold text-gray-950">
                                {idx + 1}. {point.name}
                            </div>
                            <div className="mt-0.5 text-xs text-gray-500">
                                {point.lat.toFixed(5)}, {point.lon.toFixed(5)}
                            </div>
                            <div className="mt-1 flex items-center gap-1 text-xs text-gray-600">
                                <TrainFront className="h-3.5 w-3.5" />
                                {stop ? `근처 역: ${stop.name} (${stop.distanceMeters}m)` : "근처 역 정보 없음"}
                            </div>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}

function RouteSummary({ title, result, comparison }: {
    title: string;
    result: RouteResult;
    comparison?: CompareResult;
}) {
    return (
        <div className="space-y-4 border-t border-gray-200 pt-4">
            <div>
                <h3 className="text-sm font-bold text-gray-900">{title}</h3>
                <div className="mt-3 grid grid-cols-2 gap-2">
                    <Metric label="거리" value={`${result.totalDistanceKm.toLocaleString()} km`} />
                    <Metric label="예상 시간" value={`${result.totalMinutes}분`} />
                    <Metric label="계산 시간" value={`${result.calculationMillis} ms`} />
                    <Metric label="목적지" value={`${result.order.length}개`} />
                </div>
            </div>

            {comparison && (
                <div className="rounded-lg bg-gray-950 p-3 text-white">
                    <div className="text-xs text-gray-300">수동 경로 대비 절감</div>
                    <div className="mt-1 text-xl font-bold">
                        {Math.max(0, comparison.savedMinutes)}분 / {Math.max(0, comparison.savedDistanceKm)} km
                    </div>
                    <div className="mt-1 text-xs text-gray-300">
                        개선율 {Math.max(0, comparison.improvementPercent)}%
                    </div>
                </div>
            )}

            <ol className="space-y-2">
                {result.order.map((point, idx) => (
                    <li key={`${point.id}-${idx}`} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
                        <span className="font-semibold">{idx + 1}. {point.name}</span>
                        {result.nearestStops[idx] && (
                            <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                                <TrainFront className="h-3.5 w-3.5" />
                                근처 역: {result.nearestStops[idx].name} ({result.nearestStops[idx].distanceMeters}m)
                            </div>
                        )}
                    </li>
                ))}
            </ol>

            <div className="space-y-2">
                {result.legs.map((leg, idx) => (
                    <div key={`${leg.from.id}-${leg.to.id}-${idx}`} className="text-xs text-gray-600">
                        {idx + 1}. {leg.from.name} → {leg.to.name}: {leg.distanceKm} km, {leg.estimatedMinutes}분
                    </div>
                ))}
            </div>

            <CostMatrixTable result={result} />
            <p className="text-xs text-gray-400">{result.costModel}</p>
        </div>
    );
}

function CostMatrixTable({ result }: { result: RouteResult }) {
    if (result.costMatrixMinutes.length === 0) return null;

    return (
        <div className="overflow-hidden rounded-lg border border-gray-200">
            <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-700">
                이동 비용 행렬(분)
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-center text-xs">
                    <thead>
                    <tr className="bg-white text-gray-500">
                        <th className="px-2 py-2 text-left">From</th>
                        {result.order.map((_, index) => (
                            <th key={index} className="px-2 py-2">{index + 1}</th>
                        ))}
                    </tr>
                    </thead>
                    <tbody>
                    {result.costMatrixMinutes.map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-t border-gray-100">
                            <th className="px-2 py-2 text-left font-semibold text-gray-700">{rowIndex + 1}</th>
                            {row.map((minutes, colIndex) => (
                                <td key={colIndex} className="px-2 py-2 text-gray-600">
                                    {rowIndex === colIndex ? "-" : minutes}
                                </td>
                            ))}
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function Metric({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-xs text-gray-500">{label}</div>
            <div className="mt-1 text-sm font-bold text-gray-950">{value}</div>
        </div>
    );
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "요청 처리에 실패했습니다.");
    }

    return res.json();
}

function hydrateCompareResult(result: CompareResult, sourcePoints: RoutePoint[]): CompareResult {
    return {
        ...result,
        manual: hydrateRouteResult(result.manual, sourcePoints),
        optimized: hydrateRouteResult(result.optimized, sourcePoints),
    };
}

function hydrateRouteResult(result: RouteResult, sourcePoints: RoutePoint[]): RouteResult {
    const byId = new Map(sourcePoints.map((point) => [point.id, point]));
    const hydratePoint = (point: RoutePoint): RoutePoint => ({
        ...point,
        dayId: point.dayId ?? byId.get(point.id)?.dayId,
        dayTitle: point.dayTitle ?? byId.get(point.id)?.dayTitle,
    });

    return {
        ...result,
        order: result.order.map(hydratePoint),
        legs: result.legs.map((leg) => ({
            ...leg,
            from: hydratePoint(leg.from),
            to: hydratePoint(leg.to),
        })),
    };
}

function escapeHtml(value: unknown) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
