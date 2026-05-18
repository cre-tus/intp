"use client";

import Header from "@/app/header";
import RequireAuth from "@/components/requireAuth/RequireAuth";
import { useAuthStore } from "@/stores/authStore";
import { FormEvent, useMemo, useState } from "react";

type ServerTestPoint = {
    id: string;
    name: string;
    lat: number;
    lon: number;
};

type ServerTestUserResult = {
    userIndex: number;
    withoutRedisMillis: number;
    withRedisMillis: number;
    cacheHit: boolean;
    savedMillis: number;
    speedupPercent: number;
    error?: string | null;
};

type ServerTestResponse = {
    nodeCount: number;
    userCount: number;
    wallClockMillis: number;
    averageWithoutRedisMillis: number;
    averageWithRedisMillis: number;
    successCount: number;
    failureCount: number;
    points: ServerTestPoint[];
    results: ServerTestUserResult[];
};

export default function AdminServerTestPage() {
    return (
        <RequireAuth>
            <Header />
            <AdminServerTest />
        </RequireAuth>
    );
}

function AdminServerTest() {
    const { me } = useAuthStore();
    const [nodeCount, setNodeCount] = useState(10);
    const [userCount, setUserCount] = useState(10);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [result, setResult] = useState<ServerTestResponse | null>(null);
    const isAdmin = me?.role === "ADMIN";

    const sortedResults = useMemo(
        () => result?.results.slice().sort((a, b) => a.userIndex - b.userIndex) ?? [],
        [result]
    );

    const runTest = async (event: FormEvent) => {
        event.preventDefault();
        if (!isAdmin) return;

        setLoading(true);
        setError("");
        setResult(null);
        try {
            const response = await fetch("/api/admin/server-test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nodeCount, userCount }),
            });
            if (!response.ok) {
                throw new Error(response.status === 403 ? "관리자만 실행할 수 있습니다." : "서버 테스트 실행에 실패했습니다.");
            }
            setResult(await response.json() as ServerTestResponse);
        } catch (err) {
            setError(err instanceof Error ? err.message : "서버 테스트 실행에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    if (!isAdmin) {
        return (
            <main className="mx-auto max-w-3xl px-4 py-10">
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                    <h1 className="text-2xl font-bold text-gray-950">접근 권한 없음</h1>
                    <p className="mt-2 text-sm text-gray-600">서버 테스트는 관리자 계정에서만 사용할 수 있습니다.</p>
                </div>
            </main>
        );
    }

    return (
        <main className="mx-auto max-w-6xl px-4 py-8">
            <div className="mb-6">
                <h1 className="font-[var(--font-paperlogy)] text-3xl font-bold text-gray-950">서버 테스트</h1>
                <p className="mt-2 text-sm text-gray-500">
                    GTFS 지하철 역 좌표를 랜덤으로 뽑아 TSP 경로 최적화의 캐싱/비캐싱 계산 시간을 비교합니다.
                </p>
            </div>

            <form onSubmit={runTest} className="grid gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:grid-cols-[1fr_1fr_auto] md:items-end">
                <label className="flex flex-col gap-2 text-sm font-semibold text-gray-700">
                    노드 수
                    <select
                        value={nodeCount}
                        onChange={(event) => setNodeCount(Number(event.target.value))}
                        className="rounded-lg border border-gray-200 px-3 py-3 text-base"
                    >
                        {[5, 10, 15, 20].map((value) => (
                            <option key={value} value={value}>{value}개</option>
                        ))}
                    </select>
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-gray-700">
                    사용자 수
                    <select
                        value={userCount}
                        onChange={(event) => setUserCount(Number(event.target.value))}
                        className="rounded-lg border border-gray-200 px-3 py-3 text-base"
                    >
                        {[1, 5, 10, 20, 50].map((value) => (
                            <option key={value} value={value}>{value}명</option>
                        ))}
                    </select>
                </label>
                <button
                    type="submit"
                    disabled={loading}
                    className="rounded-lg bg-gray-950 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                    {loading ? "실행 중..." : "테스트 실행"}
                </button>
            </form>

            {error && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                    {error}
                </div>
            )}

            {result && (
                <div className="mt-6 space-y-6">
                    <section className="grid gap-3 md:grid-cols-5">
                        <Metric label="성공" value={`${result.successCount}/${result.userCount}`} />
                        <Metric label="전체 시간" value={`${result.wallClockMillis} ms`} />
                        <Metric label="비캐싱 평균" value={`${result.averageWithoutRedisMillis} ms`} />
                        <Metric label="캐싱 평균" value={`${result.averageWithRedisMillis} ms`} />
                        <Metric label="실패" value={`${result.failureCount}`} />
                    </section>

                    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                        <h2 className="text-lg font-bold text-gray-950">랜덤 GTFS 노드</h2>
                        <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-gray-200">
                            <table className="w-full min-w-[720px] border-collapse text-sm">
                                <thead className="bg-gray-50">
                                <tr>
                                    <th className="border-b px-3 py-2 text-left">역</th>
                                    <th className="border-b px-3 py-2 text-left">ID</th>
                                    <th className="border-b px-3 py-2 text-right">위도</th>
                                    <th className="border-b px-3 py-2 text-right">경도</th>
                                </tr>
                                </thead>
                                <tbody>
                                {result.points.map((point) => (
                                    <tr key={point.id}>
                                        <td className="border-b px-3 py-2 font-semibold">{point.name}</td>
                                        <td className="border-b px-3 py-2 text-gray-500">{point.id}</td>
                                        <td className="border-b px-3 py-2 text-right">{point.lat.toFixed(5)}</td>
                                        <td className="border-b px-3 py-2 text-right">{point.lon.toFixed(5)}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                        <h2 className="text-lg font-bold text-gray-950">동시 사용자 결과</h2>
                        <div className="mt-3 overflow-auto rounded-lg border border-gray-200">
                            <table className="w-full min-w-[760px] border-collapse text-sm">
                                <thead className="bg-gray-50">
                                <tr>
                                    <th className="border-b px-3 py-2 text-left">사용자</th>
                                    <th className="border-b px-3 py-2 text-right">비캐싱</th>
                                    <th className="border-b px-3 py-2 text-right">캐싱</th>
                                    <th className="border-b px-3 py-2 text-center">Cache hit</th>
                                    <th className="border-b px-3 py-2 text-right">절감</th>
                                    <th className="border-b px-3 py-2 text-left">오류</th>
                                </tr>
                                </thead>
                                <tbody>
                                {sortedResults.map((item) => (
                                    <tr key={item.userIndex}>
                                        <td className="border-b px-3 py-2 font-semibold">User {item.userIndex}</td>
                                        <td className="border-b px-3 py-2 text-right">{item.withoutRedisMillis} ms</td>
                                        <td className="border-b px-3 py-2 text-right">{item.withRedisMillis} ms</td>
                                        <td className="border-b px-3 py-2 text-center">{item.cacheHit ? "hit" : "miss"}</td>
                                        <td className="border-b px-3 py-2 text-right">{item.savedMillis} ms</td>
                                        <td className="border-b px-3 py-2 text-red-600">{item.error ?? ""}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            )}
        </main>
    );
}

function Metric({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold text-gray-500">{label}</div>
            <div className="mt-2 text-xl font-black text-gray-950">{value}</div>
        </div>
    );
}
