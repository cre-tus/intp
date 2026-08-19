import { Globe2, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { loadAdminGoogleMaps, loadGoogleMaps, type GoogleMap, type GoogleMarker } from "@/lib/googleMaps";
import type { TravelCountryCode, TravelPlanTier } from "@/lib/travelPlans";

export type PlaceResult = {
    id: string;
    title: string;
    displayTitle?: string;
    titleKo?: string;
    titleEn?: string;
    titleJa?: string;
    subtitle: string;
    lat: number;
    lon: number;
    provider?: string;
};

type PlaceApiResult = {
    id: string;
    title: string;
    displayTitle?: string;
    titleKo?: string;
    titleEn?: string;
    titleJa?: string;
    subtitle: string;
    lat: number | string;
    lon: number | string;
    provider?: string;
};

type SearchProvider = "local" | "google";
type SortMode = "relevance" | "distance";
type LatLngTuple = [number, number];
export type PlaceSearchOrigin = {
    name?: string;
    lat: number;
    lon: number;
};
type RankedPlaceResult = PlaceResult & {
    distanceFromOriginKm: number | null;
};
type LeafletMarker = {
    addTo(map: LeafletMap): LeafletMarker;
    setLatLng(latLng: LatLngTuple): LeafletMarker;
    bindPopup?(content: string): LeafletMarker;
};
type LeafletLayer = {
    addTo(map: LeafletMap): LeafletLayer;
    on?(event: string, handler: () => void): void;
};
type LeafletMap = {
    setView(center: LatLngTuple, zoom: number): LeafletMap;
    on(event: "click", handler: (event: { latlng: { lat: number; lng: number } }) => void): void;
    invalidateSize(): LeafletMap;
    __fallbackTilesAdded?: boolean;
};
type LeafletApi = {
    map(element: HTMLElement, options: Record<string, unknown>): LeafletMap;
    marker(latLng: LatLngTuple): LeafletMarker;
    tileLayer(url: string, options: Record<string, unknown>): LeafletLayer;
};

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const TILE_URL = process.env.NEXT_PUBLIC_TILE_URL || "/tiles/{z}/{x}/{y}.png";
const COUNTRY_CENTERS: Record<TravelCountryCode, LatLngTuple> = {
    KR: [37.5665, 126.9780],
    JP: [35.6812, 139.7671],
};

function loadLeaflet(): Promise<LeafletApi> {
    if (typeof window === "undefined") return Promise.reject(new Error("Browser only"));
    const browserWindow = window as Window & { L?: LeafletApi };
    if (browserWindow.L) return Promise.resolve(browserWindow.L);

    return new Promise<LeafletApi>((resolve, reject) => {
        if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = LEAFLET_CSS;
            document.head.appendChild(link);
        }

        const existing = document.querySelector<HTMLScriptElement>(`script[src="${LEAFLET_JS}"]`);
        if (existing) {
            existing.addEventListener("load", () => browserWindow.L ? resolve(browserWindow.L) : reject(new Error("Leaflet load failed")));
            existing.addEventListener("error", () => reject(new Error("Leaflet load failed")));
            return;
        }

        const script = document.createElement("script");
        script.src = LEAFLET_JS;
        script.async = true;
        script.onload = () => browserWindow.L ? resolve(browserWindow.L) : reject(new Error("Leaflet load failed"));
        script.onerror = () => reject(new Error("Leaflet load failed"));
        document.body.appendChild(script);
    });
}

export default function PlaceSearchInput(props: {
    onSelect: (place: PlaceResult) => void;
    initialQuery?: string;
    initialLat?: number | null;
    initialLon?: number | null;
    showFixedOption?: boolean;
    fixedOptionChecked?: boolean;
    onFixedOptionChange?: (checked: boolean) => void;
    paidPlaces?: boolean;
    tier?: TravelPlanTier;
    planId?: string;
    planTitle?: string;
    countryCode?: TravelCountryCode;
    origin?: PlaceSearchOrigin | null;
    onUpgradeRequested?: () => void;
    onTierSynced?: (tier: TravelPlanTier) => void;
    adminGoogleSearch?: boolean;
    preferNearby?: boolean;
    knownPlaces?: PlaceResult[];
}) {
    const mapElementRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<LeafletMap | null>(null);
    const markerRef = useRef<LeafletMarker | null>(null);
    const googleMapRef = useRef<GoogleMap | null>(null);
    const googleMarkerRef = useRef<GoogleMarker | null>(null);
    const searchCacheRef = useRef<Map<string, PlaceResult[]>>(new Map());
    const [q, setQ] = useState(props.initialQuery ?? "");
    const [provider, setProvider] = useState<SearchProvider>("local");
    const [items, setItems] = useState<PlaceResult[]>([]);
    const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
    const [manualName, setManualName] = useState(props.initialQuery ?? "");
    const hasInitialCoords = props.initialLat != null && props.initialLon != null &&
        Number.isFinite(props.initialLat) && Number.isFinite(props.initialLon) &&
        props.initialLat >= -90 && props.initialLat <= 90 &&
        props.initialLon >= -180 && props.initialLon <= 180;
    const [manualLat, setManualLat] = useState(() => hasInitialCoords ? String(props.initialLat) : "");
    const [manualLon, setManualLon] = useState(() => hasInitialCoords ? String(props.initialLon) : "");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [mapError, setMapError] = useState("");
    const [sortMode, setSortMode] = useState<SortMode>(() => hasInitialCoords || props.preferNearby ? "distance" : "relevance");
    const countryCode = props.countryCode ?? "KR";
    const mapCenter: LatLngTuple = hasInitialCoords
        ? [props.initialLat!, props.initialLon!]
        : (COUNTRY_CENTERS[countryCode] ?? COUNTRY_CENTERS.KR);

    const parsedLat = Number(manualLat);
    const parsedLon = Number(manualLon);
    const hasManualCoords = manualLat.trim() !== "" && manualLon.trim() !== "" &&
        Number.isFinite(parsedLat) && Number.isFinite(parsedLon) &&
        parsedLat >= -90 && parsedLat <= 90 && parsedLon >= -180 && parsedLon <= 180;
    const effectiveOrigin = useMemo<PlaceSearchOrigin | null>(() => hasManualCoords
        ? { lat: parsedLat, lon: parsedLon, name: manualName.trim() || props.initialQuery || "선택 좌표" }
        : props.origin ?? null,
    [hasManualCoords, manualName, parsedLat, parsedLon, props.initialQuery, props.origin]);
    const canAdd =
        manualName.trim().length > 0 &&
        hasManualCoords;

    const normalizedQuery = q.trim();
    const googleEnabled = Boolean(props.adminGoogleSearch || (props.paidPlaces && props.planId));
    const googleMapEnabled = Boolean(props.adminGoogleSearch || (props.paidPlaces && props.planId));
    const canGoogleSearch = googleEnabled && normalizedQuery.length >= 2;
    const knownPlaces = useMemo(() => deduplicatePlaces(props.knownPlaces ?? []), [props.knownPlaces]);
    const rankedItems = useMemo(() => rankPlacesByOrigin(items, effectiveOrigin, sortMode), [items, effectiveOrigin, sortMode]);

    useEffect(() => {
        if (!effectiveOrigin && sortMode === "distance") setSortMode("relevance");
    }, [effectiveOrigin, sortMode]);

    useEffect(() => {
        if (hasManualCoords) setSortMode("distance");
    }, [hasManualCoords]);

    const runSearch = useCallback(async (nextProvider: SearchProvider = provider) => {
        const query = q.trim();
        if (!query || (nextProvider === "google" && query.length < 2)) {
            setItems(nextProvider === "local" ? knownPlaces : []);
            return;
        }
        if (nextProvider === "google" && !googleEnabled) {
            setError("Google 장소 검색을 사용할 수 없는 상태입니다.");
            return;
        }

        const coordinateKey = effectiveOrigin ? `${effectiveOrigin.lat.toFixed(5)},${effectiveOrigin.lon.toFixed(5)}` : "none";
        const cacheKey = `${nextProvider}:${countryCode}:${query.toLowerCase()}:${coordinateKey}`;
        const cached = searchCacheRef.current.get(cacheKey);
        if (cached) {
            setItems(mergeKnownPlaces(query, knownPlaces, cached));
            setError("");
            return;
        }

        setLoading(true);
        setError("");
        try {
            const url = nextProvider === "google"
                ? props.adminGoogleSearch
                    ? `/api/admin/ml-ingest/place-search/google?countryCode=${encodeURIComponent(countryCode)}&q=${encodeURIComponent(query)}`
                    : `/api/place/google/search?planId=${encodeURIComponent(props.planId ?? "")}&countryCode=${encodeURIComponent(countryCode)}&q=${encodeURIComponent(query)}`
                : `/api/place/autocomplete?countryCode=${encodeURIComponent(countryCode)}&q=${encodeURIComponent(query)}${effectiveOrigin ? `&lat=${effectiveOrigin.lat}&lon=${effectiveOrigin.lon}` : ""}`;
            const res = await fetch(url);
            if (!res.ok) {
                const message = await res.text();
                throw new Error(message || "장소 검색에 실패했습니다.");
            }
            const data = await res.json() as PlaceApiResult[];
            const mapped = deduplicatePlaces(data.map(toPlaceResult));
            searchCacheRef.current.set(cacheKey, mapped);
            setItems(mergeKnownPlaces(query, knownPlaces, mapped));
        } catch (err) {
            setError(err instanceof Error ? err.message : "장소 검색에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    }, [countryCode, effectiveOrigin, googleEnabled, knownPlaces, props.adminGoogleSearch, props.planId, provider, q]);

    useEffect(() => {
        if (provider !== "local") return;
        if (!normalizedQuery) {
            const timer = setTimeout(() => setItems(knownPlaces), 0);
            return () => clearTimeout(timer);
        }

        const timer = setTimeout(() => {
            void runSearch("local");
        }, 350);
        return () => clearTimeout(timer);
    }, [knownPlaces, normalizedQuery, provider, runSearch]);

    useEffect(() => {
        let mounted = true;
        if (googleMapEnabled && (props.adminGoogleSearch || props.planId)) {
            const loader = props.adminGoogleSearch ? loadAdminGoogleMaps() : loadGoogleMaps(props.planId!);
            loader
                .then((googleMaps) => {
                    if (!mounted || !mapElementRef.current || googleMapRef.current) return;
                    const map = new googleMaps.Map(mapElementRef.current, {
                        center: { lat: mapCenter[0], lng: mapCenter[1] },
                        zoom: hasInitialCoords ? 15 : 12,
                        mapTypeControl: false,
                        streetViewControl: false,
                        fullscreenControl: false,
                    });
                    if (hasInitialCoords) {
                        placeGoogleMarker(googleMaps, map, googleMarkerRef, props.initialLat!, props.initialLon!, props.initialQuery || "기존 선택 위치");
                    }
                    map.addListener("click", (event) => {
                        const latLng = event.latLng;
                        if (!latLng) return;
                        const lat = Number(latLng.lat().toFixed(6));
                        const lon = Number(latLng.lng().toFixed(6));
                        setSelectedPlace(null);
                        setManualName((current) => current.trim() || "지도 선택 위치");
                        setManualLat(String(lat));
                        setManualLon(String(lon));
                        placeGoogleMarker(googleMaps, map, googleMarkerRef, lat, lon, "지도 선택 위치");
                    });
                    googleMapRef.current = map;
                    setMapError("");
                })
                .catch(() => setMapError("Google 지도를 불러오지 못해 로컬 지도를 사용합니다."));
        }

        if (googleMapEnabled) {
            return () => {
                mounted = false;
            };
        }

        loadLeaflet()
            .then((L) => {
                if (!mounted || !mapElementRef.current || mapRef.current) return;
                const map = L.map(mapElementRef.current, {
                    zoomControl: true,
                    attributionControl: false,
                }).setView(mapCenter, hasInitialCoords ? 15 : 12);

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

                if (hasInitialCoords) {
                    placeMarker(L, map, markerRef, props.initialLat!, props.initialLon!, props.initialQuery || "기존 선택 위치");
                }

                map.on("click", (event) => {
                    const lat = Number(event.latlng.lat.toFixed(6));
                    const lon = Number(event.latlng.lng.toFixed(6));
                    setSelectedPlace(null);
                    setManualName((current) => current.trim() || "지도 선택 위치");
                    setManualLat(String(lat));
                    setManualLon(String(lon));
                    placeMarker(L, map, markerRef, lat, lon, "지도 선택 위치");
                });

                mapRef.current = map;
                setTimeout(() => map.invalidateSize(), 0);
            })
            .catch(() => setMapError("지도를 불러오지 못했습니다."));

        return () => {
            mounted = false;
        };
    }, [googleMapEnabled, hasInitialCoords, mapCenter, props.adminGoogleSearch, props.initialLat, props.initialLon, props.initialQuery, props.planId]);

    const selectPlace = (item: PlaceResult) => {
        if (!hasValidCoordinates(item.lat, item.lon)) {
            setError("위도와 경도가 있는 장소만 추가할 수 있습니다.");
            return;
        }
        setSelectedPlace(item);
        setManualName(item.displayTitle?.trim() || item.title);
        setManualLat(String(item.lat));
        setManualLon(String(item.lon));
        if (googleMapRef.current && (props.adminGoogleSearch || props.planId)) {
            const loader = props.adminGoogleSearch ? loadAdminGoogleMaps() : loadGoogleMaps(props.planId!);
            loader
                .then((googleMaps) => {
                    if (!googleMapRef.current) return;
                    placeGoogleMarker(googleMaps, googleMapRef.current, googleMarkerRef, item.lat, item.lon, item.displayTitle ?? item.title);
                    googleMapRef.current.setCenter({ lat: item.lat, lng: item.lon });
                    googleMapRef.current.setZoom(15);
                })
                .catch(() => undefined);
            return;
        }
        const browserWindow = window as Window & { L?: LeafletApi };
        if (browserWindow.L && mapRef.current) {
            placeMarker(browserWindow.L, mapRef.current, markerRef, item.lat, item.lon, item.displayTitle ?? item.title);
            mapRef.current.setView([item.lat, item.lon], 15);
            setTimeout(() => mapRef.current?.invalidateSize(), 0);
        }
    };

    const addPlace = () => {
        if (!canAdd) return;
        const place = {
            id: selectedPlace?.id ?? `manual:${parsedLat.toFixed(6)},${parsedLon.toFixed(6)}`,
            title: manualName.trim(),
            displayTitle: manualName.trim(),
            titleKo: selectedPlace?.titleKo,
            titleEn: selectedPlace?.titleEn,
            titleJa: selectedPlace?.titleJa,
            subtitle: selectedPlace?.subtitle ?? `${parsedLat.toFixed(6)}, ${parsedLon.toFixed(6)}`,
            lat: parsedLat,
            lon: parsedLon,
            provider: selectedPlace?.provider,
        };
        void recordPlaceSelection(place, q, selectedPlace?.provider ?? (selectedPlace ? provider : "manual"), props.planId, countryCode);
        props.onSelect(place);
    };

    return (
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                        <Search className="h-4 w-4 flex-shrink-0 text-gray-500" />
                        <input
                            autoFocus
                            value={q}
                            onChange={(event) => setQ(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") void runSearch(provider);
                            }}
                            placeholder="예: 신주쿠역, 우에노 공원"
                            className="w-full min-w-0 bg-transparent focus:outline-none"
                        />
                    </div>

                    {Boolean(props.paidPlaces || props.adminGoogleSearch) && (
                        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
                            <button
                                type="button"
                                onClick={() => {
                                    setProvider("local");
                                    setError("");
                                    void runSearch("local");
                                }}
                                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                                    provider === "local" ? "bg-gray-950 text-white" : "text-gray-700 hover:bg-gray-100"
                                }`}
                            >
                                로컬
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setProvider("google");
                                    setError("");
                                }}
                                className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold ${
                                    provider === "google" ? "bg-gray-950 text-white" : "text-gray-700 hover:bg-gray-100"
                                }`}
                            >
                                <Globe2 className="h-3.5 w-3.5" />
                                Google
                            </button>
                        </div>
                    )}

                    {provider === "google" && (
                        <button
                            type="button"
                            disabled={!canGoogleSearch || loading}
                            onClick={() => void runSearch("google")}
                            className="rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                        >
                            검색
                        </button>
                    )}
                </div>

                <div className="mt-3 grid gap-2 rounded-lg border border-gray-200 bg-white p-3">
                    <input
                        value={manualName}
                        onChange={(event) => setManualName(event.target.value)}
                        placeholder="표시할 장소 이름"
                        className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                    />
                    <div className="grid grid-cols-2 gap-2">
                        <input
                            value={manualLat}
                            onChange={(event) => setManualLat(event.target.value)}
                            placeholder="위도"
                            inputMode="decimal"
                            className="rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                        />
                        <input
                            value={manualLon}
                            onChange={(event) => setManualLon(event.target.value)}
                            placeholder="경도"
                            inputMode="decimal"
                            className="rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                        />
                    </div>
                    {props.showFixedOption && (
                        <label className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800">
                            <input
                                type="checkbox"
                                checked={props.fixedOptionChecked ?? false}
                                onChange={(event) => props.onFixedOptionChange?.(event.target.checked)}
                                className="h-4 w-4 accent-gray-950"
                            />
                            일정 고정
                        </label>
                    )}
                    <button
                        type="button"
                        disabled={!canAdd}
                        onClick={addPlace}
                        className="rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                        추가하기
                    </button>
                </div>

                <div className="mt-3 max-h-[220px] overflow-auto rounded-lg border border-gray-200 sm:max-h-[320px]">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2">
                        <div className="text-xs font-bold text-gray-600">
                            {effectiveOrigin
                                ? <>{hasManualCoords ? "기존 선택된 경로" : "이전 경로"}{effectiveOrigin.name ? ` "${effectiveOrigin.name}"` : ""} 기준</>
                                : "검색 결과"}
                        </div>
                        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
                            <button
                                type="button"
                                onClick={() => setSortMode("relevance")}
                                className={`rounded-md px-2.5 py-1 text-xs font-black ${sortMode === "relevance" ? "bg-gray-950 text-white" : "text-gray-600 hover:bg-gray-100"}`}
                            >
                                관련순
                            </button>
                            <button
                                type="button"
                                disabled={!effectiveOrigin}
                                onClick={() => setSortMode("distance")}
                                className={`rounded-md px-2.5 py-1 text-xs font-black ${sortMode === "distance" ? "bg-gray-950 text-white" : "text-gray-600 hover:bg-gray-100"} disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent`}
                            >
                                가까운순
                            </button>
                        </div>
                    </div>
                    {loading ? (
                        <div className="p-4 text-sm text-gray-500">검색 중...</div>
                    ) : error ? (
                        <div className="p-4 text-sm text-red-600">{error}</div>
                    ) : items.length === 0 ? (
                        <div className="p-4 text-sm text-gray-500">검색 결과 없음</div>
                    ) : (
                        <ul>
                            {rankedItems.map((item) => (
                                <li key={item.id}>
                                    <button
                                        type="button"
                                        disabled={!hasValidCoordinates(item.lat, item.lon)}
                                        className="w-full border-b px-3 py-3 text-left last:border-b-0 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                                        onClick={() => selectPlace(item)}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-1.5 font-medium">
                                                    <span>{item.displayTitle ?? item.title}</span>
                                                    <ProviderBadge provider={item.provider} />
                                                </div>
                                            </div>
                                            {item.distanceFromOriginKm !== null && (
                                                <span className="shrink-0 rounded-full bg-gray-950 px-2 py-0.5 text-[11px] font-black text-white">
                                                    {formatDistanceKm(item.distanceFromOriginKm)}
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-0.5 text-xs text-gray-500">{item.subtitle}</div>
                                        {item.distanceFromOriginKm !== null && (
                                            <div className="mt-1 text-xs font-semibold text-gray-600">
                                                {hasManualCoords ? "기존 선택된 경로에서" : "이전 경로에서"} {formatDistanceKm(item.distanceFromOriginKm)}
                                            </div>
                                        )}
                                        {!hasValidCoordinates(item.lat, item.lon) && (
                                            <div className="mt-1 text-xs font-semibold text-red-500">
                                                좌표 없음
                                            </div>
                                        )}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            <div className="min-w-0 overflow-hidden rounded-lg border border-gray-200">
                <div ref={mapElementRef} className="h-[260px] min-h-[260px] bg-gray-100 sm:h-[420px] sm:min-h-[420px] lg:h-[500px] lg:min-h-[500px]" />
                <div className="border-t border-gray-200 px-3 py-2 text-xs text-gray-500">
                    {mapError || "검색 결과를 선택하거나 지도에서 위치를 클릭하세요."}
                </div>
            </div>
        </div>
    );
}

export function ProviderBadge({ provider }: { provider?: string }) {
    const norm = (provider || "nominatim").toLowerCase();
    if (norm === "custom") {
        return (
            <span className="shrink-0 rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-black text-violet-700">
                Custom
            </span>
        );
    }
    if (norm === "redis") {
        return (
            <span className="shrink-0 rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-black text-rose-700">
                Redis
            </span>
        );
    }
    if (norm === "photon") {
        return (
            <span className="shrink-0 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-black text-amber-800">
                Photon
            </span>
        );
    }
    if (norm === "google") {
        return (
            <span className="shrink-0 rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-black text-blue-700">
                Google
            </span>
        );
    }
    if (norm === "overpass") {
        return (
            <span className="shrink-0 rounded border border-cyan-200 bg-cyan-50 px-1.5 py-0.5 text-[10px] font-black text-cyan-800">
                Overpass
            </span>
        );
    }
    if (norm === "plan") {
        return (
            <span className="shrink-0 rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-black text-violet-700">
                현재 일정
            </span>
        );
    }
    return (
        <span className="shrink-0 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-black text-emerald-800">
            Nominatim
        </span>
    );
}

function toPlaceResult(item: PlaceApiResult): PlaceResult {
    return {
        id: item.id,
        title: item.title,
        displayTitle: item.displayTitle,
        titleKo: item.titleKo,
        titleEn: item.titleEn,
        titleJa: item.titleJa,
        subtitle: item.subtitle,
        lat: Number(item.lat),
        lon: Number(item.lon),
        provider: item.provider || inferProviderFromId(item.id),
    };
}

function deduplicatePlaces(items: PlaceResult[]) {
    const unique = new Map<string, PlaceResult>();
    items.forEach((item) => {
        const key = item.id || `${item.lat.toFixed(6)},${item.lon.toFixed(6)}`;
        unique.set(key, item);
    });
    return [...unique.values()];
}

function mergeKnownPlaces(query: string, knownPlaces: PlaceResult[], remotePlaces: PlaceResult[]) {
    const normalized = query.trim().toLocaleLowerCase();
    const matchingKnown = knownPlaces.filter((place) => [
        place.title,
        place.displayTitle,
        place.titleKo,
        place.titleEn,
        place.titleJa,
        place.subtitle,
    ].some((value) => value?.toLocaleLowerCase().includes(normalized)));
    return deduplicatePlaces([...matchingKnown, ...remotePlaces]);
}

function inferProviderFromId(id?: string): string {
    if (!id) return "nominatim";
    const lower = id.toLowerCase();
    if (lower.startsWith("redis:") || lower.startsWith("cache:")) return "redis";
    if (lower.startsWith("google:") || lower.startsWith("google")) return "google";
    if (lower.startsWith("photon:")) return "photon";
    if (lower.startsWith("custom:")) return "custom";
    if (lower.startsWith("place:") || lower.startsWith("nominatim:")) return "nominatim";
    return "nominatim";
}

function hasValidCoordinates(lat: number, lon: number) {
    return (
        Number.isFinite(lat) &&
        Number.isFinite(lon) &&
        lat >= -90 &&
        lat <= 90 &&
        lon >= -180 &&
        lon <= 180
    );
}

function rankPlacesByOrigin(items: PlaceResult[], origin?: PlaceSearchOrigin | null, sortMode: SortMode = "relevance"): RankedPlaceResult[] {
    const ranked = items.map((item) => ({
        ...item,
        distanceFromOriginKm: origin && hasValidCoordinates(item.lat, item.lon)
            ? haversineKm(origin.lat, origin.lon, item.lat, item.lon)
            : null,
    }));
    if (!origin || sortMode === "relevance") return ranked;
    return ranked.sort((left, right) => {
        if (left.distanceFromOriginKm === null && right.distanceFromOriginKm === null) return 0;
        if (left.distanceFromOriginKm === null) return 1;
        if (right.distanceFromOriginKm === null) return -1;
        return left.distanceFromOriginKm - right.distanceFromOriginKm;
    });
}

function haversineKm(fromLat: number, fromLon: number, toLat: number, toLon: number) {
    const radiusKm = 6371.0088;
    const dLat = toRadians(toLat - fromLat);
    const dLon = toRadians(toLon - fromLon);
    const lat1 = toRadians(fromLat);
    const lat2 = toRadians(toLat);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number) {
    return value * Math.PI / 180;
}

function formatDistanceKm(value: number) {
    if (value < 1) return `${Math.round(value * 1000)}m`;
    return `${value.toFixed(value < 10 ? 1 : 0)}km`;
}

async function recordPlaceSelection(place: PlaceResult, query: string, provider: string, planId?: string, countryCode?: TravelCountryCode) {
    try {
        await fetch("/api/place/selection", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                place,
                query,
                provider,
                planId,
                countryCode,
            }),
        });
    } catch {
        // Place memory is best-effort; selecting a place should not fail when logging is unavailable.
    }
}

function placeMarker(
    L: LeafletApi,
    map: LeafletMap,
    markerRef: MutableRefObject<LeafletMarker | null>,
    lat: number,
    lon: number,
    label: string
) {
    if (markerRef.current) {
        markerRef.current.setLatLng([lat, lon]).bindPopup?.(label);
        return;
    }
    markerRef.current = L.marker([lat, lon]).addTo(map).bindPopup?.(label) ?? null;
}

function placeGoogleMarker(
    googleMaps: Awaited<ReturnType<typeof loadGoogleMaps>>,
    map: GoogleMap,
    markerRef: MutableRefObject<GoogleMarker | null>,
    lat: number,
    lon: number,
    label: string
) {
    const position = { lat, lng: lon };
    if (markerRef.current) {
        markerRef.current.setPosition(position);
        return;
    }
    const marker = new googleMaps.Marker({
        map,
        position,
        title: label,
    });
    const infoWindow = new googleMaps.InfoWindow({ content: escapeHtml(label) });
    marker.addListener("click", () => infoWindow.open({ map, anchor: marker }));
    markerRef.current = marker;
}

function escapeHtml(value: unknown) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
