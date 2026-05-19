"use client";

import Header from "@/app/header";
import RequireAuth from "@/components/requireAuth/RequireAuth";
import { api } from "@/service/api";
import { useAuthStore } from "@/stores/authStore";
import { FormEvent, useMemo, useState } from "react";

type ServerTestPoint = {
    id: string;
    name: string;
    lat: number;
    lon: number;
};

type ServerTestUserNodes = {
    userIndex: number;
    points: ServerTestPoint[];
};

type ServerTestShuffleResponse = {
    nodeCount: number;
    userCount: number;
    users: ServerTestUserNodes[];
};

type ServerTestUserResult = {
    userIndex: number;
    withoutRedisMillis: number;
    withRedisMillis: number;
    cacheHit: boolean;
    withoutRedisComplexity: string;
    withRedisComplexity: string;
    withoutRedisOperationCount: number;
    withRedisOperationCount: number;
    savedMillis: number;
    speedupPercent: number;
    points: ServerTestPoint[];
    optimizedRoute: ServerTestPoint[];
    error?: string | null;
};

type ServerTestResponse = {
    nodeCount: number;
    userCount: number;
    wallClockMillis: number;
    averageWithoutRedisMillis: number;
    averageWithRedisMillis: number;
    algorithm: string;
    withoutRedisComplexity: string;
    withRedisComplexityOnHit: string;
    estimatedWithoutRedisOperations: number;
    estimatedCachedOperations: number;
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
    const [nodeCount, setNodeCount] = useState(20);
    const [userCount, setUserCount] = useState(10);
    const [shuffleLoading, setShuffleLoading] = useState(false);
    const [runLoading, setRunLoading] = useState(false);
    const [error, setError] = useState("");
    const [shuffle, setShuffle] = useState<ServerTestShuffleResponse | null>(null);
    const [result, setResult] = useState<ServerTestResponse | null>(null);
    const [openRouteUserIndex, setOpenRouteUserIndex] = useState<number | null>(null);
    const isAdmin = me?.role === "ADMIN";

    const sortedResults = useMemo(
        () => result?.results.slice().sort((a, b) => a.userIndex - b.userIndex) ?? [],
        [result]
    );
    const openResult = result?.results.find((item) => item.userIndex === openRouteUserIndex) ?? null;
    const hasValidShuffle = shuffle?.nodeCount === nodeCount && shuffle?.userCount === userCount;

    const updateNodeCount = (value: number) => {
        setNodeCount(clamp(value, 2, 20));
        clearPreparedData();
    };

    const updateUserCount = (value: number) => {
        setUserCount(clamp(value, 1, 500));
        clearPreparedData();
    };

    const clearPreparedData = () => {
        setShuffle(null);
        setResult(null);
        setOpenRouteUserIndex(null);
    };

    const shuffleNodes = async () => {
        if (!isAdmin) return;
        setShuffleLoading(true);
        setError("");
        setResult(null);
        setOpenRouteUserIndex(null);
        try {
            const response = await api.post<ServerTestShuffleResponse>("/api/admin/server-test/shuffle", {
                nodeCount,
                userCount,
            });
            setShuffle(response.data);
        } catch (err) {
            setError(readErrorMessage(err, "노드 셔플에 실패했습니다."));
            setShuffle(null);
        } finally {
            setShuffleLoading(false);
        }
    };

    const runTest = async (event: FormEvent) => {
        event.preventDefault();
        if (!isAdmin) return;
        if (!hasValidShuffle || !shuffle) {
            setError("먼저 노드 셔플 버튼을 눌러 사용자별 랜덤 노드를 배치해 주세요.");
            return;
        }

        setRunLoading(true);
        setError("");
        setResult(null);
        setOpenRouteUserIndex(null);
        try {
            const response = await api.post<ServerTestResponse>("/api/admin/server-test", {
                nodeCount,
                userCount,
                users: shuffle.users,
            });
            setResult(response.data);
        } catch (err) {
            setError(readErrorMessage(err, "서버 테스트 실행에 실패했습니다."));
        } finally {
            setRunLoading(false);
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
        <main className="mx-auto max-w-7xl px-4 py-8">
            <div className="mb-6">
                <h1 className="font-[var(--font-paperlogy)] text-3xl font-bold text-gray-950">서버 테스트</h1>
                <p className="mt-2 text-sm text-gray-500">
                    노드 셔플로 사용자별 GTFS 역을 먼저 배치한 뒤, 그 고정된 입력값으로 TSP 캐싱/비캐싱 계산 시간을 비교합니다.
                </p>
            </div>

            <form onSubmit={runTest} className="grid gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:grid-cols-[1fr_1fr_auto_auto] lg:items-end">
                <label className="flex flex-col gap-2 text-sm font-semibold text-gray-700">
                    노드 수
                    <input
                        type="number"
                        min={2}
                        max={20}
                        value={nodeCount}
                        onChange={(event) => updateNodeCount(Number(event.target.value))}
                        className="rounded-lg border border-gray-200 px-3 py-3 text-base"
                    />
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-gray-700">
                    사용자 수
                    <input
                        type="number"
                        min={1}
                        max={500}
                        value={userCount}
                        onChange={(event) => updateUserCount(Number(event.target.value))}
                        className="rounded-lg border border-gray-200 px-3 py-3 text-base"
                    />
                </label>
                <button
                    type="button"
                    onClick={shuffleNodes}
                    disabled={shuffleLoading || runLoading}
                    className="rounded-lg border border-gray-300 bg-white px-5 py-3 font-bold text-gray-950 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {shuffleLoading ? "셔플 중..." : "노드 셔플"}
                </button>
                <button
                    type="submit"
                    disabled={runLoading || shuffleLoading || !hasValidShuffle}
                    className="rounded-lg bg-gray-950 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                    {runLoading ? "계산 중..." : "테스트 실행"}
                </button>
            </form>

            <div className="mt-3 text-sm text-gray-500">
                {hasValidShuffle
                    ? `${shuffle.userCount}명에게 ${shuffle.nodeCount}개 노드가 배치되었습니다. 이 셔플 시간은 아래 연산 결과에 포함되지 않습니다.`
                    : "노드 수와 사용자 수를 입력한 뒤 노드 셔플을 먼저 실행해 주세요."}
            </div>

            {error && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                    {error}
                </div>
            )}

            {hasValidShuffle && shuffle && !result && (
                <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-lg font-bold text-gray-950">셔플된 노드 미리보기</h2>
                        <span className="text-sm font-semibold text-gray-500">
                            User 1 기준, 전체 사용자는 경로 보기에서 각각 확인
                        </span>
                    </div>
                    <RouteList title="User 1 랜덤 입력 노드" points={shuffle.users[0]?.points ?? []} />
                </section>
            )}

            {result && (
                <div className="mt-6 space-y-6">
                    <section className="grid gap-3 md:grid-cols-5">
                        <Metric label="성공" value={`${result.successCount}/${result.userCount}`} />
                        <Metric label="전체 계산 시간" value={`${result.wallClockMillis} ms`} />
                        <Metric label="비캐싱 평균" value={`${result.averageWithoutRedisMillis} ms`} />
                        <Metric label="캐싱 평균" value={`${result.averageWithRedisMillis} ms`} />
                        <Metric label="실패" value={`${result.failureCount}`} />
                    </section>

                    <section className="grid gap-4 lg:grid-cols-2">
                        <ComparisonCard
                            title="비캐싱 계산"
                            description={result.algorithm}
                            complexity={result.withoutRedisComplexity}
                            operations={result.estimatedWithoutRedisOperations}
                            avgMillis={result.averageWithoutRedisMillis}
                        />
                        <ComparisonCard
                            title="캐싱 계산"
                            description="Redis cache hit 기준"
                            complexity={result.withRedisComplexityOnHit}
                            operations={result.estimatedCachedOperations}
                            avgMillis={result.averageWithRedisMillis}
                        />
                    </section>

                    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                        <h2 className="text-lg font-bold text-gray-950">동시 사용자 결과</h2>
                        <div className="mt-3 overflow-auto rounded-lg border border-gray-200">
                            <table className="w-full min-w-[1280px] border-collapse text-sm">
                                <thead className="bg-gray-50">
                                <tr>
                                    <th className="border-b px-3 py-2 text-left">사용자</th>
                                    <th className="border-b px-3 py-2 text-center">경로</th>
                                    <th className="border-b px-3 py-2 text-right">비캐싱 시간</th>
                                    <th className="border-b px-3 py-2 text-right">캐싱 시간</th>
                                    <th className="border-b px-3 py-2 text-left">비캐싱 복잡도</th>
                                    <th className="border-b px-3 py-2 text-left">캐싱 복잡도</th>
                                    <th className="border-b px-3 py-2 text-right">비캐싱 연산</th>
                                    <th className="border-b px-3 py-2 text-right">캐싱 연산</th>
                                    <th className="border-b px-3 py-2 text-center">Cache hit</th>
                                    <th className="border-b px-3 py-2 text-right">절감</th>
                                    <th className="border-b px-3 py-2 text-left">오류</th>
                                </tr>
                                </thead>
                                <tbody>
                                {sortedResults.map((item) => (
                                    <tr key={item.userIndex}>
                                        <td className="border-b px-3 py-2 font-semibold">User {item.userIndex}</td>
                                        <td className="border-b px-3 py-2 text-center">
                                            <button
                                                type="button"
                                                onClick={() => setOpenRouteUserIndex(item.userIndex)}
                                                disabled={item.optimizedRoute.length === 0}
                                                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                경로 보기
                                            </button>
                                        </td>
                                        <td className="border-b px-3 py-2 text-right">{item.withoutRedisMillis} ms</td>
                                        <td className="border-b px-3 py-2 text-right">{item.withRedisMillis} ms</td>
                                        <td className="border-b px-3 py-2">{item.withoutRedisComplexity}</td>
                                        <td className="border-b px-3 py-2">{item.withRedisComplexity}</td>
                                        <td className="border-b px-3 py-2 text-right">{item.withoutRedisOperationCount.toLocaleString()}</td>
                                        <td className="border-b px-3 py-2 text-right">{item.withRedisOperationCount.toLocaleString()}</td>
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

            {openResult && (
                <RouteModal result={openResult} onClose={() => setOpenRouteUserIndex(null)} />
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

function ComparisonCard({
    title,
    description,
    complexity,
    operations,
    avgMillis,
}: {
    title: string;
    description: string;
    complexity: string;
    operations: number;
    avgMillis: number;
}) {
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-gray-950">{title}</h2>
            <p className="mt-2 text-sm text-gray-500">{description}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Metric label="평균 시간" value={`${avgMillis} ms`} />
                <Metric label="시간복잡도" value={complexity} />
                <Metric label="연산 횟수" value={operations.toLocaleString()} />
            </div>
        </div>
    );
}

function RouteModal({
    result,
    onClose,
}: {
    result: ServerTestUserResult;
    onClose: () => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-950">User {result.userIndex} 경로</h2>
                        <p className="mt-1 text-sm text-gray-500">
                            셔플 단계에서 배치된 입력 노드와 해당 입력값으로 계산된 최적화 경로입니다.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg px-3 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100"
                    >
                        닫기
                    </button>
                </div>
                <div className="grid max-h-[calc(90vh-88px)] gap-4 overflow-auto p-5 lg:grid-cols-2">
                    <RouteList title="셔플 입력 노드" points={result.points} />
                    <RouteList title="최적화 경로" points={result.optimizedRoute} ordered />
                </div>
            </div>
        </div>
    );
}

function RouteList({
    title,
    points,
    ordered = false,
}: {
    title: string;
    points: ServerTestPoint[];
    ordered?: boolean;
}) {
    return (
        <section className="mt-3 rounded-xl border border-gray-200">
            <div className="border-b border-gray-200 px-4 py-3 font-bold text-gray-950">{title}</div>
            <ol className="max-h-[520px] space-y-2 overflow-auto p-4">
                {points.map((point, index) => (
                    <li
                        key={`${point.id}-${index}`}
                        className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm"
                    >
                        <div className="font-bold text-gray-950">
                            {ordered ? `${index + 1}. ` : ""}{point.name}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                            {point.id} · {point.lat.toFixed(5)}, {point.lon.toFixed(5)}
                        </div>
                    </li>
                ))}
            </ol>
        </section>
    );
}

function clamp(value: number, min: number, max: number) {
    if (Number.isNaN(value)) return min;
    return Math.max(min, Math.min(max, value));
}

function readErrorMessage(err: unknown, fallback: string) {
    if (typeof err === "object" && err !== null && "response" in err) {
        const response = (err as { response?: { status?: number; data?: { message?: string } | string } }).response;
        if (response?.status === 403) return "관리자만 실행할 수 있습니다.";
        if (typeof response?.data === "object" && response.data?.message) return response.data.message;
        if (typeof response?.data === "string" && response.data) return response.data;
    }
    return fallback;
}
