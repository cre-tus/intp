import { Search } from "lucide-react";
import { useEffect, useState } from "react";

{ /* 장소 검색용 데이터 타입 */ }
export type PlaceResult = {
    id: string; // Nominatim place_id (리스트 key / 중복 제거 )
    title: string;
    subtitle: string;
    lat: number;
    lon: number;
};

{ /* 장소 검색 입력 컴포넌트 */ }
export default function PlaceSearchInput(props: {
    onSelect: (place: PlaceResult) => void;
    initialQuery?: string;
}) {

    { /* 현재 검색어 상태 */ }
    const [q, setQ] = useState(props.initialQuery ?? "");

    { /* 검색 결과 목록 */ }
    const [items, setItems] = useState<PlaceResult[]>([]);

    { /* 검색 중 여부 */ }
    const [loading, setLoading] = useState(false);

    { /* 검색어 변경마다 실행 */ }
    useEffect(() => {

        // 공백 시 결과 초기화
        if (!q.trim()) {
            setItems([]);
            return;
        }

        //디바운스 타이머 설정
        const t = setTimeout(async () => {
            setLoading(true);

            // nginx / backend 프록시를 통해 검색
            const res = await fetch(
                `/api/nominatim/search?format=jsonv2&limit=5&q=${encodeURIComponent(q)}`
            );
            const data = await res.json();

            // Nominatim 응답을 PlaceResult 형태로 정규화
            setItems(
                data.map((r: any) => ({
                    id: r.place_id,
                    title: r.name || r.display_name.split(",")[0],
                    subtitle: r.display_name,
                    lat: Number(r.lat),
                    lon: Number(r.lon),
                }))
            );

            setLoading(false);
        }, 250);

        // q 변경 시 이전 타이머 취소 (디바운스 핵심)
        return () => clearTimeout(t);
    }, [q]);

    { /* 컴포넌트 부분 */ }
    return (
        <>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <Search className="w-4 h-4 text-gray-500" />
                <input
                    autoFocus
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="예) 도쿄 타워 / 도쿄디즈니랜드"
                    className="w-full bg-transparent focus:outline-none"
                />
            </div>

            <div className="mt-3 max-h-[320px] overflow-auto border border-gray-200 rounded-lg">
                {loading ? (
                    <div className="p-4 text-sm text-gray-500">검색 중...</div>
                ) : items.length === 0 ? (
                    <div className="p-4 text-sm text-gray-500">검색 결과 없음</div>
                ) : (
                    <ul>
                        {items.map((it) => (
                            <li key={it.id}>
                                <button
                                    className="w-full text-left px-3 py-3 hover:bg-gray-50 border-b last:border-b-0"
                                    onClick={() => props.onSelect(it)}
                                >
                                    <div className="font-medium">{it.title}</div>
                                    <div className="text-xs text-gray-500 mt-0.5">{it.subtitle}</div>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </>
    );
}
