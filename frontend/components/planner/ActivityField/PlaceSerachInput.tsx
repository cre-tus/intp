import { Search } from "lucide-react";
import { useEffect, useState } from "react";

export type PlaceResult = {
    id: string;
    title: string;
    subtitle: string;
    lat: number;
    lon: number;
};

type PlaceApiResult = {
    id: string;
    title: string;
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
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

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
                                    onClick={() => props.onSelect(item)}
                                >
                                    <div className="font-medium">{item.title}</div>
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
