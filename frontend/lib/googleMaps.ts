type GoogleMapsApi = {
    Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMap;
    Marker: new (options: Record<string, unknown>) => GoogleMarker;
    Polyline: new (options: Record<string, unknown>) => GooglePolyline;
    InfoWindow: new (options: Record<string, unknown>) => GoogleInfoWindow;
    LatLngBounds: new () => GoogleLatLngBounds;
    event: {
        clearInstanceListeners(instance: unknown): void;
    };
};

export type GoogleMap = {
    setCenter(position: { lat: number; lng: number }): void;
    setZoom(zoom: number): void;
    fitBounds(bounds: GoogleLatLngBounds): void;
    addListener(eventName: string, handler: (event: { latLng?: { lat(): number; lng(): number } }) => void): void;
};

export type GoogleMarker = {
    setPosition(position: { lat: number; lng: number }): void;
    setMap(map: GoogleMap | null): void;
    addListener(eventName: string, handler: () => void): void;
};

export type GooglePolyline = {
    setMap(map: GoogleMap | null): void;
};

export type GoogleInfoWindow = {
    open(options: { map: GoogleMap; anchor?: GoogleMarker }): void;
};

export type GoogleLatLngBounds = {
    extend(position: { lat: number; lng: number }): void;
};

declare global {
    interface Window {
        google?: {
            maps?: GoogleMapsApi;
        };
    }
}

let scriptPromise: Promise<GoogleMapsApi> | null = null;
let loadedKey = "";

export async function loadGoogleMaps(planId: string): Promise<GoogleMapsApi> {
    if (typeof window === "undefined") throw new Error("Browser only");
    const key = await fetchGoogleMapsKey(planId);
    if (window.google?.maps && loadedKey === key) return window.google.maps;
    if (scriptPromise && loadedKey === key) return scriptPromise;

    loadedKey = key;
    scriptPromise = new Promise<GoogleMapsApi>((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>("script[data-google-maps='true']");
        if (existing) existing.remove();

        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
        script.async = true;
        script.defer = true;
        script.dataset.googleMaps = "true";
        script.onload = () => window.google?.maps ? resolve(window.google.maps) : reject(new Error("Google Maps load failed"));
        script.onerror = () => reject(new Error("Google Maps load failed"));
        document.head.appendChild(script);
    });

    return scriptPromise;
}

async function fetchGoogleMapsKey(planId: string) {
    const res = await fetch(`/api/place/google/maps-key?planId=${encodeURIComponent(planId)}`);
    if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Google 지도 설정을 불러오지 못했습니다.");
    }
    const data = await res.json() as { apiKey?: string };
    if (!data.apiKey) throw new Error("Google 지도 API 키가 없습니다.");
    return data.apiKey;
}
