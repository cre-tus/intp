"use client";

import Header from "@/app/header";
import RequireAuth from "@/components/requireAuth/RequireAuth";
import { api } from "@/service/api";
import { useAuthStore } from "@/stores/authStore";
import { FormEvent, useMemo, useState } from "react";

type ServerTestPoint = { id: string; name: string; lat: number; lon: number };
type ServerTestUserNodes = { userIndex: number; points: ServerTestPoint[] };
type ServerTestShuffleResponse = { nodeCount: number; userCount: number; users: ServerTestUserNodes[] };

type ServerTestUserResult = {
    userIndex: number;
    withoutRedisMillis: number;
    withRedisMillis: number;
    cacheHit: boolean;
    cacheHitCount: number;
    cacheMissCount: number;
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
    results: ServerTestUserResult[];
};

type ServerTestJobStartResponse = { jobId: string };
type ServerTestJobStatusResponse<T> = {
    status: "RUNNING" | "COMPLETED" | "FAILED";
    completedUsers: number;
    totalUsers: number;
    progressPercent: number;
    result: T | null;
    error?: string | null;
};

const NODE_COUNT_LIMIT = { min: 2, max: 20 };
const USER_COUNT_LIMIT = { min: 1, max: 5000 };

export default function ServerTestClient() {
    return (
        <RequireAuth>
            <Header />
            <AdminServerTest />
        </RequireAuth>
    );
}

function AdminServerTest() {
    const { me } = useAuthStore();
    const [nodeCountInput, setNodeCountInput] = useState("20");
    const [userCountInput, setUserCountInput] = useState("10");
    const [shuffleLoading, setShuffleLoading] = useState(false);
    const [runLoading, setRunLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [completedUsers, setCompletedUsers] = useState(0);
    const [error, setError] = useState("");
    const [shuffle, setShuffle] = useState<ServerTestShuffleResponse | null>(null);
    const [shuffleJobId, setShuffleJobId] = useState("");
    const [result, setResult] = useState<ServerTestResponse | null>(null);
    const [openRouteUserIndex, setOpenRouteUserIndex] = useState<number | null>(null);

    const isAdmin = me?.role === "ADMIN";
    const nodeCount = parsePositiveInteger(nodeCountInput);
    const userCount = parsePositiveInteger(userCountInput);
    const hasValidShuffle = Boolean(shuffleJobId) && shuffle?.nodeCount === nodeCount && shuffle?.userCount === userCount;
    const sortedResults = useMemo(
        () => result?.results.slice().sort((a, b) => a.userIndex - b.userIndex) ?? [],
        [result],
    );
    const openResult = result?.results.find((item) => item.userIndex === openRouteUserIndex) ?? null;
    const totalSavedPercent = result ? percentSaved(result.averageWithoutRedisMillis, result.averageWithRedisMillis) : 0;

    const clearPreparedData = () => {
        setShuffle(null);
        setShuffleJobId("");
        setResult(null);
        setOpenRouteUserIndex(null);
        setProgress(0);
        setCompletedUsers(0);
    };

    const validateInputs = () => {
        const nextNodeCount = validateIntegerRange("노드 수", nodeCountInput, NODE_COUNT_LIMIT.min, NODE_COUNT_LIMIT.max);
        const nextUserCount = validateIntegerRange("사용자 수", userCountInput, USER_COUNT_LIMIT.min, USER_COUNT_LIMIT.max);
        if (!nextNodeCount.ok || !nextUserCount.ok) {
            setError(readValidationError(nextNodeCount, nextUserCount));
            return null;
        }
        return { nodeCount: nextNodeCount.value, userCount: nextUserCount.value };
    };

    const shuffleNodes = async () => {
        if (!isAdmin) return;
        const inputs = validateInputs();
        if (!inputs) return;
        setShuffleLoading(true);
        setError("");
        setResult(null);
        setOpenRouteUserIndex(null);
        setProgress(0);
        setCompletedUsers(0);
        try {
            const start = await api.post<ServerTestJobStartResponse>("/api/admin/server-test/shuffle/start", inputs);
            const finalStatus = await pollJob<ServerTestShuffleResponse>(
                `/api/admin/server-test/shuffle/jobs/${start.data.jobId}`,
                setProgress,
                setCompletedUsers,
            );
            if (finalStatus.status === "FAILED") throw new Error(finalStatus.error ?? "노드 셔플에 실패했습니다.");
            if (!finalStatus.result) throw new Error("노드 셔플 결과를 불러오지 못했습니다.");
            setShuffleJobId(start.data.jobId);
            setShuffle(finalStatus.result);
        } catch (err) {
            setError(readErrorMessage(err, "노드 셔플에 실패했습니다."));
            setShuffleJobId("");
            setShuffle(null);
        } finally {
            setShuffleLoading(false);
        }
    };

    const runTest = async (event: FormEvent) => {
        event.preventDefault();
        if (!isAdmin) return;
        const inputs = validateInputs();
        if (!inputs) return;
        if (!hasValidShuffle || !shuffle) {
            setError("먼저 노드 셔플을 실행해 주세요.");
            return;
        }

        setRunLoading(true);
        setProgress(0);
        setCompletedUsers(0);
        setError("");
        setResult(null);
        setOpenRouteUserIndex(null);
        try {
            const start = await api.post<ServerTestJobStartResponse>("/api/admin/server-test/start", {
                ...inputs,
                shuffleJobId,
            });
            const finalStatus = await pollJob<ServerTestResponse>(
                `/api/admin/server-test/jobs/${start.data.jobId}`,
                setProgress,
                setCompletedUsers,
            );
            if (finalStatus.status === "FAILED") throw new Error(finalStatus.error ?? "서버 테스트 실행에 실패했습니다.");
            if (!finalStatus.result) throw new Error("서버 테스트 결과를 불러오지 못했습니다.");
            setResult(finalStatus.result);
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
                    사용자별 노드 셔플과 경로 최적화를 병렬 job으로 실행하고, 실제 완료 사용자 수 기준 진행률을 표시합니다.
                </p>
            </div>

            <form onSubmit={runTest} className="grid gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:grid-cols-[1fr_1fr_auto_auto] lg:items-end">
                <NumberField label="노드 수" value={nodeCountInput} min={NODE_COUNT_LIMIT.min} max={NODE_COUNT_LIMIT.max} onChange={(value) => { setNodeCountInput(value); clearPreparedData(); }} />
                <NumberField label="사용자 수" value={userCountInput} min={USER_COUNT_LIMIT.min} max={USER_COUNT_LIMIT.max} onChange={(value) => { setUserCountInput(value); clearPreparedData(); }} />
                <button type="button" onClick={shuffleNodes} disabled={shuffleLoading || runLoading} className="rounded-lg border border-gray-300 bg-white px-5 py-3 font-bold text-gray-950 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">
                    {shuffleLoading ? "셔플 중..." : "노드 셔플"}
                </button>
                <button type="submit" disabled={runLoading || shuffleLoading || !hasValidShuffle} className="rounded-lg bg-gray-950 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:bg-gray-300">
                    {runLoading ? "계산 중..." : "테스트 실행"}
                </button>
            </form>

            <p className="mt-3 text-sm text-gray-500">
                {hasValidShuffle
                    ? `${shuffle.userCount.toLocaleString()}명에게 ${shuffle.nodeCount}개 노드가 배치되었습니다. 셔플 시간은 연산 결과에 포함되지 않습니다.`
                    : "노드 수와 사용자 수를 입력한 뒤 노드 셔플을 먼저 실행해 주세요."}
            </p>

            {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

            {hasValidShuffle && shuffle && !result && (
                <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-lg font-bold text-gray-950">셔플된 노드 미리보기</h2>
                        <span className="text-sm font-semibold text-gray-500">User 1 기준</span>
                    </div>
                    <RouteList title="User 1 셔플 입력 노드" points={shuffle.users[0]?.points ?? []} />
                </section>
            )}

            {result && (
                <div className="mt-6 space-y-6">
                    <section className="grid gap-3 md:grid-cols-6">
                        <Metric label="성공" value={`${result.successCount.toLocaleString()}/${result.userCount.toLocaleString()}`} />
                        <Metric label="전체 계산 시간" value={`${result.wallClockMillis} ms`} />
                        <Metric label="비캐싱 평균" value={`${result.averageWithoutRedisMillis} ms`} />
                        <Metric label="캐싱 평균" value={`${result.averageWithRedisMillis} ms`} />
                        <Metric label="절감률" value={`${totalSavedPercent}%`} />
                        <Metric label="실패" value={`${result.failureCount.toLocaleString()}`} />
                    </section>

                    <section className="grid gap-4 lg:grid-cols-2">
                        <ComparisonCard
                            title="비캐싱 계산"
                            description={result.algorithm}
                            complexity={result.withoutRedisComplexity}
                            operations={result.estimatedWithoutRedisOperations}
                            avgMillis={result.averageWithoutRedisMillis}
                            complexityHelp="Big-O는 입력 노드 수 n이 커질 때 계산량이 얼마나 빠르게 증가하는지 나타냅니다."
                        />
                        <ComparisonCard
                            title="캐싱 계산"
                            description="Redis nearest-stop / 구간 비용 재사용 기준"
                            complexity={result.withRedisComplexityOnHit}
                            operations={result.estimatedCachedOperations}
                            avgMillis={result.averageWithRedisMillis}
                            complexityHelp="Redis 캐싱은 숙소 좌표, 근처 역, A에서 B까지의 이동 비용처럼 반복되는 조회를 재사용합니다."
                        />
                    </section>

                    <ResultTable results={sortedResults} totalUserCount={result.userCount} onOpenRoute={setOpenRouteUserIndex} />
                </div>
            )}

            {openResult && <RouteModal result={openResult} onClose={() => setOpenRouteUserIndex(null)} />}
            {(runLoading || shuffleLoading) && (
                <LoadingOverlay
                    mode={shuffleLoading ? "shuffle" : "calculate"}
                    progress={progress}
                    completedUsers={completedUsers}
                    nodeCount={nodeCount ?? 0}
                    userCount={userCount ?? 0}
                />
            )}
        </main>
    );
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: string; min: number; max: number; onChange: (value: string) => void }) {
    return (
        <label className="flex flex-col gap-2 text-sm font-semibold text-gray-700">
            {label}
            <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={value}
                onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))}
                placeholder={`${min}`}
                aria-describedby={`${label}-range`}
                className="rounded-lg border border-gray-200 px-3 py-3 text-base"
            />
            <span id={`${label}-range`} className="sr-only">
                {min} 이상 {max} 이하의 숫자만 입력
            </span>
        </label>
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
    complexityHelp,
    operations,
    avgMillis,
}: {
    title: string;
    description: string;
    complexity: string;
    complexityHelp: string;
    operations: number;
    avgMillis: number;
}) {
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-gray-950">{title}</h2>
            <p className="mt-2 text-sm text-gray-500">{description}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Metric label="평균 시간" value={`${avgMillis} ms`} />
                <TooltipMetric label="시간복잡도" value={complexity} help={complexityHelp} />
                <Metric label="연산 횟수" value={operations.toLocaleString()} />
            </div>
        </div>
    );
}

function TooltipMetric({ label, value, help }: { label: string; value: string; help: string }) {
    return (
        <div className="group relative rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold text-gray-500">{label}</div>
            <div className="mt-2 cursor-help text-base font-black text-gray-950 underline decoration-dotted underline-offset-4">{value}</div>
            <div className="pointer-events-none absolute left-3 top-full z-20 mt-2 hidden w-72 rounded-lg border border-gray-200 bg-gray-950 p-3 text-left text-xs font-semibold leading-5 text-white shadow-xl group-hover:block">
                {help}
            </div>
        </div>
    );
}

function ResultTable({ results, totalUserCount, onOpenRoute }: { results: ServerTestUserResult[]; totalUserCount: number; onOpenRoute: (userIndex: number) => void }) {
    const isSampled = totalUserCount > results.length;

    return (
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-gray-950">동시 사용자 결과</h2>
            {isSampled && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700">
                    전체 {totalUserCount.toLocaleString()}명 기준으로 계산했고, 동시 사용자 결과는 랜덤 {results.length.toLocaleString()}명만 표시합니다.
                </div>
            )}
            <div className="mt-3 overflow-auto rounded-lg border border-gray-200">
                <table className="w-full min-w-[1520px] border-collapse text-sm">
                    <thead className="bg-gray-50">
                    <tr>
                        <HeaderCell>사용자</HeaderCell>
                        <HeaderCell align="center">경로</HeaderCell>
                        <HeaderCell align="right">비캐싱 시간</HeaderCell>
                        <HeaderCell align="right">캐싱 시간</HeaderCell>
                        <HeaderCell>비캐싱 복잡도</HeaderCell>
                        <HeaderCell>캐싱 복잡도</HeaderCell>
                        <HeaderCell align="right">비캐싱 연산</HeaderCell>
                        <HeaderCell align="right">캐싱 연산</HeaderCell>
                        <HeaderCell align="center">Cache hit</HeaderCell>
                        <HeaderCell align="right">재사용</HeaderCell>
                        <HeaderCell align="right">미사용</HeaderCell>
                        <HeaderCell align="right">절감</HeaderCell>
                        <HeaderCell align="right">절감률</HeaderCell>
                        <HeaderCell>오류</HeaderCell>
                    </tr>
                    </thead>
                    <tbody>
                    {results.map((item) => (
                        <tr key={item.userIndex}>
                            <td className="border-b px-3 py-2 font-semibold">User {item.userIndex}</td>
                            <td className="border-b px-3 py-2 text-center">
                                <button type="button" onClick={() => onOpenRoute(item.userIndex)} disabled={item.optimizedRoute.length === 0} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">
                                    경로 보기
                                </button>
                            </td>
                            <td className="border-b px-3 py-2 text-right">{item.withoutRedisMillis} ms</td>
                            <td className="border-b px-3 py-2 text-right">{item.withRedisMillis} ms</td>
                            <ComplexityCell value={item.withoutRedisComplexity} help="비캐싱은 GTFS 비용 추출과 TSP 휴리스틱 계산을 매번 수행합니다." />
                            <ComplexityCell value={item.withRedisComplexity} help="캐싱은 이전 사용자와 겹치는 근처 역, 구간 비용을 Redis에서 재사용합니다." />
                            <td className="border-b px-3 py-2 text-right">{item.withoutRedisOperationCount.toLocaleString()}</td>
                            <td className="border-b px-3 py-2 text-right">{item.withRedisOperationCount.toLocaleString()}</td>
                            <td className="border-b px-3 py-2 text-center">{item.cacheHit ? "hit" : "miss"}</td>
                            <td className="border-b px-3 py-2 text-right">{item.cacheHitCount.toLocaleString()}</td>
                            <td className="border-b px-3 py-2 text-right">{item.cacheMissCount.toLocaleString()}</td>
                            <td className="border-b px-3 py-2 text-right">{item.savedMillis} ms</td>
                            <td className="border-b px-3 py-2 text-right font-bold text-emerald-700">{item.speedupPercent.toFixed(1)}%</td>
                            <td className="border-b px-3 py-2 text-red-600">{item.error ?? ""}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

function HeaderCell({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" | "center" }) {
    const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
    return <th className={`border-b px-3 py-2 ${alignClass}`}>{children}</th>;
}

function ComplexityCell({ value, help }: { value: string; help: string }) {
    return (
        <td className="group relative border-b px-3 py-2">
            <span className="cursor-help underline decoration-dotted underline-offset-4">{value}</span>
            <span className="pointer-events-none absolute left-3 top-full z-20 mt-1 hidden w-72 rounded-lg bg-gray-950 p-3 text-xs font-semibold leading-5 text-white shadow-xl group-hover:block">
                {help}
            </span>
        </td>
    );
}

function RouteModal({ result, onClose }: { result: ServerTestUserResult; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-950">User {result.userIndex} 경로</h2>
                        <p className="mt-1 text-sm text-gray-500">셔플 입력 노드와 최적화 경로입니다.</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100">닫기</button>
                </div>
                <div className="grid max-h-[calc(90vh-88px)] gap-4 overflow-auto p-5 lg:grid-cols-2">
                    <RouteList title="셔플 입력 노드" points={result.points} />
                    <RouteList title="최적화 경로" points={result.optimizedRoute} ordered />
                </div>
            </div>
        </div>
    );
}

function RouteList({ title, points, ordered = false }: { title: string; points: ServerTestPoint[]; ordered?: boolean }) {
    return (
        <section className="mt-3 rounded-xl border border-gray-200">
            <div className="border-b border-gray-200 px-4 py-3 font-bold text-gray-950">{title}</div>
            <ol className="max-h-[520px] space-y-2 overflow-auto p-4">
                {points.map((point, index) => (
                    <li key={`${point.id}-${index}`} className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                        <div className="font-bold text-gray-950">{ordered ? `${index + 1}. ` : ""}{point.name}</div>
                        <div className="mt-1 text-xs text-gray-500">{point.id} · {point.lat.toFixed(5)}, {point.lon.toFixed(5)}</div>
                    </li>
                ))}
            </ol>
        </section>
    );
}

function LoadingOverlay({ mode, progress, completedUsers, nodeCount, userCount }: { mode: "shuffle" | "calculate"; progress: number; completedUsers: number; nodeCount: number; userCount: number }) {
    const title = mode === "shuffle" ? "노드 셔플 중" : "경로 계산 중";
    const description = mode === "shuffle"
        ? `${userCount.toLocaleString()}명 · ${nodeCount}개 노드를 병렬 배치 중입니다.`
        : `${userCount.toLocaleString()}명 · ${nodeCount}개 노드 기준으로 병렬 계산 중입니다.`;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-2xl">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-4 border-gray-200 border-t-gray-950 animate-spin" />
                <h2 className="mt-5 text-xl font-black text-gray-950">{title}</h2>
                <p className="mt-2 text-sm font-semibold text-gray-500">{description}</p>
                <p className="mt-2 text-xs font-bold text-gray-500">{completedUsers.toLocaleString()} / {userCount.toLocaleString()}명 완료</p>
                <div className="mt-6 h-3 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-gray-950 transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
                </div>
                <div className="mt-3 text-2xl font-black tabular-nums text-gray-950">{progress}%</div>
                <p className="mt-2 text-xs font-semibold text-gray-400">실제 완료된 사용자 수 기준 진행률입니다.</p>
            </div>
        </div>
    );
}

async function pollJob<T>(
    url: string,
    setProgress: (value: number) => void,
    setCompletedUsers: (value: number) => void,
) {
    while (true) {
        await sleep(500);
        const response = await api.get<ServerTestJobStatusResponse<T>>(url);
        const status = response.data;
        setProgress(status.progressPercent);
        setCompletedUsers(status.completedUsers);
        if (status.status !== "RUNNING") return status;
    }
}

function percentSaved(withoutRedis: number, withRedis: number) {
    if (withoutRedis <= 0) return 0;
    return Math.max(0, Math.round(((withoutRedis - withRedis) * 1000) / withoutRedis) / 10);
}

function parsePositiveInteger(value: string) {
    if (!/^\d+$/.test(value)) return null;
    return Number(value);
}

function validateIntegerRange(label: string, value: string, min: number, max: number): { ok: true; value: number } | { ok: false; error: string } {
    const parsed = parsePositiveInteger(value);
    if (parsed === null) return { ok: false, error: `${label}는 숫자로 입력해 주세요.` };
    if (parsed < min || parsed > max) return { ok: false, error: `${label}는 ${min} 이상 ${max} 이하로 입력해 주세요.` };
    return { ok: true, value: parsed };
}

function readValidationError(...results: Array<ReturnType<typeof validateIntegerRange>>) {
    return results.find((result) => !result.ok)?.error ?? "";
}

function readErrorMessage(err: unknown, fallback: string) {
    if (err instanceof Error) return err.message;
    if (typeof err === "object" && err !== null && "response" in err) {
        const response = (err as { response?: { status?: number; data?: { message?: string } | string } }).response;
        if (response?.status === 403) return "관리자만 실행할 수 있습니다.";
        if (typeof response?.data === "object" && response.data?.message) return response.data.message;
        if (typeof response?.data === "string" && response.data) return response.data;
    }
    return fallback;
}

function sleep(ms: number) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}
