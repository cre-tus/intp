import { Search } from "lucide-react";
import { useEffect, useRef, useState, type MutableRefObject } from "react";

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
}) {
    const mapElementRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<LeafletMap | null>(null);
    const markerRef = useRef<LeafletMarker | null>(null);
    const [q, setQ] = useState(props.initialQuery ?? "");
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

    useEffect(() => {
        if (!q.trim()) {
            const timer = setTimeout(() => setItems([]), 0);
            return () => clearTimeout(timer);
        }

        const timer = setTimeout(async () => {
            setLoading(true);
            setError("");
            try {
                const res = await fetch(`/api/place/autocomplete?q=${encodeURIComponent(q)}`);
                if (!res.ok) throw new Error("장소 검색에 실패했습니다.");
                const data = await res.json() as PlaceApiResult[];
                setItems(
                    data.map((item) => ({
                        id: item.id,
                        title: item.title,
                        displayTitle: item.displayTitle,
                        titleKo: item.titleKo,
                        titleEn: item.titleEn,
                        titleJa: item.titleJa,
                        subtitle: item.subtitle,
                        lat: Number(item.lat),
                        lon: Number(item.lon),
                    }))
                );
            } catch (err) {
                setError(err instanceof Error ? err.message : "장소 검색에 실패했습니다.");
            } finally {
                setLoading(false);
            }
        }, 250);

        return () => clearTimeout(timer);
    }, [q]);

    useEffect(() => {
        let mounted = true;
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
    }, []);

    const selectPlace = (item: PlaceResult) => {
        if (!hasValidCoordinates(item.lat, item.lon)) {
            setError("위도와 경도가 있는 장소만 추가할 수 있습니다.");
            return;
        }
        setSelectedPlace(item);
        setManualName(item.title);
        setManualLat(String(item.lat));
        setManualLon(String(item.lon));
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
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div>
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                    <Search className="h-4 w-4 text-gray-500" />
                    <input
                        autoFocus
                        value={q}
                        onChange={(event) => setQ(event.target.value)}
                        placeholder="예: 신주쿠역, 우에노 공원"
                        className="w-full bg-transparent focus:outline-none"
                    />
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

                <div className="mt-3 max-h-[320px] overflow-auto rounded-lg border border-gray-200">
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

            <div className="overflow-hidden rounded-lg border border-gray-200">
                <div ref={mapElementRef} className="h-[500px] min-h-[500px] bg-gray-100" />
                <div className="border-t border-gray-200 px-3 py-2 text-xs text-gray-500">
                    {mapError || "검색 결과를 선택하거나 지도에서 위치를 클릭하세요."}
                </div>
            </div>
        </div>
    );
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
