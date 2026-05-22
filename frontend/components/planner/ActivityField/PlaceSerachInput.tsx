import { Globe2, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { loadGoogleMaps, type GoogleMap, type GoogleMarker } from "@/lib/googleMaps";

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
};

type SearchProvider = "local" | "google";
type LatLngTuple = [number, number];
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
const DEFAULT_CENTER: LatLngTuple = [35.6812, 139.7671];

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
    showFixedOption?: boolean;
    fixedOptionChecked?: boolean;
    onFixedOptionChange?: (checked: boolean) => void;
    paidPlaces?: boolean;
    planId?: string;
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
    const [manualLat, setManualLat] = useState("");
    const [manualLon, setManualLon] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [mapError, setMapError] = useState("");

    const parsedLat = Number(manualLat);
    const parsedLon = Number(manualLon);
    const canAdd =
        manualName.trim().length > 0 &&
        Number.isFinite(parsedLat) &&
        Number.isFinite(parsedLon) &&
        parsedLat >= -90 &&
        parsedLat <= 90 &&
        parsedLon >= -180 &&
        parsedLon <= 180;

    const normalizedQuery = q.trim();
    const googleEnabled = Boolean(props.paidPlaces && props.planId);
    const googleMapEnabled = Boolean(props.paidPlaces && props.planId);
    const canGoogleSearch = googleEnabled && normalizedQuery.length >= 2;

    const runSearch = useCallback(async (nextProvider: SearchProvider = provider) => {
        const query = q.trim();
        if (!query || (nextProvider === "google" && query.length < 2)) {
            setItems([]);
            return;
        }
        if (nextProvider === "google" && !googleEnabled) {
            setError("유료 템플릿에서만 Google 장소 검색을 사용할 수 있습니다.");
            return;
        }

        const cacheKey = `${nextProvider}:${query.toLowerCase()}`;
        const cached = searchCacheRef.current.get(cacheKey);
        if (cached) {
            setItems(cached);
            setError("");
            return;
        }

        setLoading(true);
        setError("");
        try {
            const url = nextProvider === "google"
                ? `/api/place/google/search?planId=${encodeURIComponent(props.planId ?? "")}&q=${encodeURIComponent(query)}`
                : `/api/place/autocomplete?q=${encodeURIComponent(query)}`;
            const res = await fetch(url);
            if (!res.ok) {
                const message = await res.text();
                throw new Error(message || "장소 검색에 실패했습니다.");
            }
            const data = await res.json() as PlaceApiResult[];
            const mapped = data.map(toPlaceResult);
            searchCacheRef.current.set(cacheKey, mapped);
            setItems(mapped);
        } catch (err) {
            setError(err instanceof Error ? err.message : "장소 검색에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    }, [googleEnabled, props.planId, provider, q]);

    useEffect(() => {
        if (provider !== "local") return;
        if (!normalizedQuery) {
            const timer = setTimeout(() => setItems([]), 0);
            return () => clearTimeout(timer);
        }

        const timer = setTimeout(() => {
            void runSearch("local");
        }, 350);
        return () => clearTimeout(timer);
    }, [normalizedQuery, provider, runSearch]);

    useEffect(() => {
        let mounted = true;
        if (googleMapEnabled && props.planId) {
            loadGoogleMaps(props.planId)
                .then((googleMaps) => {
                    if (!mounted || !mapElementRef.current || googleMapRef.current) return;
                    const map = new googleMaps.Map(mapElementRef.current, {
                        center: { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] },
                        zoom: 12,
                        mapTypeControl: false,
                        streetViewControl: false,
                        fullscreenControl: false,
                    });
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
                }).setView(DEFAULT_CENTER, 12);

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
    }, [googleMapEnabled, props.planId]);

    const selectPlace = (item: PlaceResult) => {
        if (!hasValidCoordinates(item.lat, item.lon)) {
            setError("위도와 경도가 있는 장소만 추가할 수 있습니다.");
            return;
        }
        setSelectedPlace(item);
        setManualName(item.title);
        setManualLat(String(item.lat));
        setManualLon(String(item.lon));
        if (googleMapRef.current && props.planId) {
            loadGoogleMaps(props.planId)
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
        props.onSelect({
            id: selectedPlace?.id ?? `manual:${parsedLat.toFixed(6)},${parsedLon.toFixed(6)}`,
            title: manualName.trim(),
            displayTitle: manualName.trim(),
            subtitle: selectedPlace?.subtitle ?? `${parsedLat.toFixed(6)}, ${parsedLon.toFixed(6)}`,
            lat: parsedLat,
            lon: parsedLon,
        });
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

                    {props.paidPlaces && (
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
                    {loading ? (
                        <div className="p-4 text-sm text-gray-500">검색 중...</div>
                    ) : error ? (
                        <div className="p-4 text-sm text-red-600">{error}</div>
                    ) : items.length === 0 ? (
                        <div className="p-4 text-sm text-gray-500">검색 결과 없음</div>
                    ) : (
                        <ul>
                            {items.map((item) => (
                                <li key={item.id}>
                                    <button
                                        type="button"
                                        disabled={!hasValidCoordinates(item.lat, item.lon)}
                                        className="w-full border-b px-3 py-3 text-left last:border-b-0 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                                        onClick={() => selectPlace(item)}
                                    >
                                        <div className="font-medium">{item.displayTitle ?? item.title}</div>
                                        <div className="mt-0.5 text-xs text-gray-500">{item.subtitle}</div>
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
    };
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
