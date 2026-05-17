import { Search } from "lucide-react";
import { useEffect, useState } from "react";

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

export default function PlaceSearchInput(props: {
    onSelect: (place: PlaceResult) => void;
    initialQuery?: string;
}) {
    const [q, setQ] = useState(props.initialQuery ?? "");
    const [items, setItems] = useState<PlaceResult[]>([]);
    const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
    const [manualName, setManualName] = useState(props.initialQuery ?? "");
    const [manualLat, setManualLat] = useState("");
    const [manualLon, setManualLon] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

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

    return (
        <>
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <Search className="h-4 w-4 text-gray-500" />
                <input
                    autoFocus
                    value={q}
                    onChange={(event) => setQ(event.target.value)}
                    placeholder="예: 신주쿠 역, 우에노 공원"
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
                <button
                    type="button"
                    disabled={!canAdd}
                    onClick={() => {
                        if (!canAdd) return;
                        props.onSelect({
                            id: selectedPlace?.id ?? `manual:${parsedLat.toFixed(6)},${parsedLon.toFixed(6)}`,
                            title: manualName.trim(),
                            displayTitle: manualName.trim(),
                            subtitle: selectedPlace?.subtitle ?? `${parsedLat.toFixed(6)}, ${parsedLon.toFixed(6)}`,
                            lat: parsedLat,
                            lon: parsedLon,
                        });
                    }}
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
                                    className="w-full border-b px-3 py-3 text-left last:border-b-0 hover:bg-gray-50"
                                    onClick={() => {
                                        setSelectedPlace(item);
                                        setManualName(item.title);
                                        setManualLat(String(item.lat));
                                        setManualLon(String(item.lon));
                                    }}
                                >
                                    <div className="font-medium">{item.displayTitle ?? item.title}</div>
                                    <div className="mt-0.5 text-xs text-gray-500">{item.subtitle}</div>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </>
    );
}
