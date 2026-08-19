"use client";

import Header from "@/app/header";
import RequireAuth from "@/components/requireAuth/RequireAuth";
import PlaceSearchModal from "@/components/planner/ActivityField/PlaceSerachModal";
import type { PlaceResult } from "@/components/planner/ActivityField/PlaceSerachInput";
import type { PlaceSearchOrigin } from "@/components/planner/ActivityField/PlaceSerachInput";
import { api } from "@/service/api";
import { useAuthStore } from "@/stores/authStore";
import {
    AlertCircle,
    ArrowDown,
    ArrowUp,
    Bot,
    Check,
    CheckCircle2,
    Clock3,
    Cpu,
    Database,
    FileImage,
    FileText,
    ExternalLink,
    GripVertical,
    LoaderCircle,
    MapPin,
    Pencil,
    Plus,
    RefreshCw,
    RotateCcw,
    Search,
    Save,
    Trash2,
    Upload,
    X,
} from "lucide-react";
import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";

type Stage = "QUEUED" | "EXTRACTING" | "GEOCODING" | "REVIEW" | "APPROVED" | "FAILED";

type PipelineEvent = {
    stage: Stage;
    title: string;
    detail: string;
    at: string;
};

type LlmMessage = {
    stage: "OCR" | "STRUCTURING" | "REPAIR";
    role: "user" | "assistant";
    content: string;
    at: string;
};

type Place = {
    name: string;
    category?: string;
    confidence?: number;
    time_bucket?: string;
    time?: string;
    content?: string;
    geocode?: { lat: number; lon: number; display_name?: string; provider?: string } | null;
};

type Review = {
    status: string;
    trip: {
        title?: string | null;
        destination?: string | null;
        start_date?: string | null;
        end_date?: string | null;
        confidence?: number;
        traveler_age_bucket?: string;
        companion_type?: string;
        child_age_bucket?: string;
        group_age_bucket?: string;
        days?: Array<{ day: number; date?: string | null; places?: Place[] }>;
    };
    quality: {
        place_count: number;
        unresolved_places: string[];
        warnings: string[];
        ready_for_review: boolean;
        google_calls?: number;
        google_call_limit?: number;
        google_cache_hits?: number;
        google_promoted_to_nominatim?: number;
        geographic_rejections?: number;
        model_features_ready?: boolean;
        model_feature_gaps?: string[];
    };
    seed_preview?: {
        age_bucket?: string;
        companion_type?: string;
        child_age_bucket?: string;
        group_age_bucket?: string;
        month_bucket?: string;
        season_bucket?: string;
    };
    plan_preview?: {
        id: string;
        title: string;
        template: "basic";
        costCurrency?: "KRW" | "JPY";
        tripContext?: {
            ageBucket?: string;
            companionType?: string;
            childAgeBucket?: string;
            groupAgeBucket?: string;
            monthBucket?: string;
            seasonBucket?: string;
        };
        days: Array<{
            id: string;
            date: string;
            dayTitle: string;
            activities: Array<{
                id: string;
                time: string;
                location: string;
                activity: string;
                cost?: number;
                placeId?: string;
                placeSubtitle?: string;
                address?: string;
                lat?: number | null;
                lon?: number | null;
                coordinateProvider?: string;
                category?: string;
                timeBucket?: string;
            }>;
        }>;
    };
};

type IngestJob = {
    jobId: string;
    fileName: string;
    status: "QUEUED" | "RUNNING" | "REVIEW_REQUIRED" | "APPROVED" | "FAILED";
    stage: Stage;
    progress: number;
    events: PipelineEvent[];
    llmMessages: LlmMessage[];
    review: Review | null;
    error: string | null;
    travelPlanId?: string;
    modelLabel?: string;
};

type BatchStartResponse = { mode: "combined" | "separate"; jobs: IngestJob[] };
type JobListResponse = { jobs: IngestJob[] };
type FeatureEdit = {
    context?: Record<string, string>;
    placeFeatures?: Array<{ id: string; timeBucket?: string; category?: string }>;
};
type ReviewContentEdit = {
    title: string;
    destination: string;
    startDate: string;
    endDate: string;
    costCurrency: "KRW" | "JPY";
    days: NonNullable<Review["plan_preview"]>["days"];
};

const PIPELINE: Array<{ stage: Stage; label: string; icon: typeof Upload }> = [
    { stage: "QUEUED", label: "업로드", icon: Upload },
    { stage: "EXTRACTING", label: "일정 추출", icon: Cpu },
    { stage: "GEOCODING", label: "좌표 검색", icon: Search },
    { stage: "REVIEW", label: "관리자 검수", icon: FileImage },
    { stage: "APPROVED", label: "데이터 반영", icon: Database },
];

export default function AdminMlIngestPage() {
    const { me, isLoggedIn, fetchMe } = useAuthStore();
    const inputRef = useRef<HTMLInputElement | null>(null);
    const pollingRef = useRef<number | null>(null);
    const jobMutationVersionsRef = useRef<Record<string, number>>({});
    const [files, setFiles] = useState<File[]>([]);
    const [sourceMode, setSourceMode] = useState<"image" | "text" | "json">("image");
    const [sourceText, setSourceText] = useState("");
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
    const [jobs, setJobs] = useState<IngestJob[]>([]);
    const [selectedJobId, setSelectedJobId] = useState("");
    const [batchMode, setBatchMode] = useState<"combined" | "separate">("combined");
    const [modelChoice, setModelChoice] = useState<"qwen" | "phi3_paddle" | "both">("qwen");
    const [layoutChoice, setLayoutChoice] = useState<"auto" | "single_day" | "multi_day" | "mobile" | "prose">("auto");
    const [busy, setBusy] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [error, setError] = useState("");
    const [logView, setLogView] = useState<"pipeline" | "llm">("pipeline");

    useEffect(() => {
        void fetchMe();
    }, [fetchMe]);

    useEffect(() => {
        if (me?.role !== "ADMIN") return;
        void api.get<JobListResponse>("/api/admin/ml-ingest/jobs").then((response) => {
            const restored = response.data.jobs ?? [];
            setJobs((current) => current.length > 0 ? current : restored);
            setSelectedJobId((current) => current || restored[0]?.jobId || "");
        }).catch(() => undefined);
    }, [me?.role]);

    useEffect(() => () => {
        previewUrls.forEach((url) => URL.revokeObjectURL(url));
        if (pollingRef.current) window.clearTimeout(pollingRef.current);
    }, [previewUrls]);

    const chooseFiles = (nextFiles: File[]) => {
        if (nextFiles.length === 0) return;
        if (nextFiles.length > 10) {
            setError("이미지는 최대 10장까지 선택할 수 있습니다.");
            return;
        }
        if (nextFiles.some((next) => !next.type.startsWith("image/"))) {
            setError("이미지 파일만 업로드할 수 있습니다.");
            return;
        }
        if (nextFiles.some((next) => next.size > 20 * 1024 * 1024)) {
            setError("이미지 한 장은 20MB 이하여야 합니다.");
            return;
        }
        if (nextFiles.reduce((sum, next) => sum + next.size, 0) > 80 * 1024 * 1024) {
            setError("전체 이미지 용량은 80MB 이하여야 합니다.");
            return;
        }
        previewUrls.forEach((url) => URL.revokeObjectURL(url));
        setFiles(nextFiles);
        setPreviewUrls(nextFiles.map((next) => URL.createObjectURL(next)));
        setJobs([]);
        setSelectedJobId("");
        setLogView("pipeline");
        setError("");
    };

    const poll = async (jobIds: string[]) => {
        const requestVersions = Object.fromEntries(jobIds.map((jobId) => [jobId, jobMutationVersionsRef.current[jobId] ?? 0]));
        try {
            const responses = await Promise.all(jobIds.map((jobId) => api.get<IngestJob>(`/api/admin/ml-ingest/jobs/${jobId}`)));
            const nextJobs = responses.map((response) => response.data);
            setJobs((current) => mergeJobs(current, nextJobs.filter((item) =>
                (jobMutationVersionsRef.current[item.jobId] ?? 0) === requestVersions[item.jobId]
            )));
            if (nextJobs.every((item) => ["REVIEW_REQUIRED", "APPROVED", "FAILED"].includes(item.status))) {
                setBusy(false);
                return;
            }
            pollingRef.current = window.setTimeout(() => void poll(jobIds), 1200);
        } catch (cause) {
            setBusy(false);
            setError(readError(cause, "작업 상태를 불러오지 못했습니다."));
        }
    };

    const start = async () => {
        if ((sourceMode === "image" ? files.length === 0 : sourceText.trim().length < 20) || busy) return;
        setBusy(true);
        setError("");
        if (sourceMode === "json") {
            try {
                const itinerary = JSON.parse(sourceText.trim());
                const response = await api.post<BatchStartResponse>("/api/admin/ml-ingest/json-jobs", itinerary);
                setJobs(response.data.jobs);
                setSelectedJobId(response.data.jobs[0]?.jobId ?? "");
                void poll(response.data.jobs.map((item) => item.jobId));
            } catch (cause) {
                setBusy(false);
                setError(cause instanceof SyntaxError ? `JSON 형식이 올바르지 않습니다: ${cause.message}` : readError(cause, "JSON 일정 등록을 시작하지 못했습니다."));
            }
            return;
        }
        if (sourceMode === "text") {
            try {
                const response = await api.post<BatchStartResponse>("/api/admin/ml-ingest/text-jobs", { text: sourceText.trim() });
                setJobs(response.data.jobs);
                setSelectedJobId(response.data.jobs[0]?.jobId ?? "");
                void poll(response.data.jobs.map((item) => item.jobId));
            } catch (cause) {
                setBusy(false);
                setError(readError(cause, "텍스트 일정 분석을 시작하지 못했습니다."));
            }
            return;
        }
        const body = new FormData();
        files.forEach((file) => body.append("files", file));
        body.append("mode", files.length === 1 ? "combined" : batchMode);
        body.append("model", modelChoice);
        body.append("layout", layoutChoice);
        try {
            const response = await api.post<BatchStartResponse>("/api/admin/ml-ingest/jobs", body, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            setJobs(response.data.jobs);
            setSelectedJobId(response.data.jobs[0]?.jobId ?? "");
            void poll(response.data.jobs.map((item) => item.jobId));
        } catch (cause) {
            setBusy(false);
            setError(readError(cause, "이미지 분석을 시작하지 못했습니다."));
        }
    };

    const approve = async () => {
        if (!job || job.status !== "REVIEW_REQUIRED") return;
        if (!window.confirm("검수한 일정을 영구 학습 시드에 반영할까요? Google 임시 장소는 OSM으로 전환될 때까지 학습에서 제외됩니다.")) return;
        setBusy(true);
        setError("");
        try {
            const response = await api.post<IngestJob>(`/api/admin/ml-ingest/jobs/${job.jobId}/approve`);
            setJobs((current) => current.map((item) => item.jobId === response.data.jobId ? response.data : item));
        } catch (cause) {
            setError(readError(cause, "학습 데이터 반영에 실패했습니다."));
        } finally {
            setBusy(false);
        }
    };

    const reapply = async () => {
        if (!job || job.status !== "APPROVED" || busy) return;
        if (!window.confirm("학습 시드와 기본 템플릿 일정을 다시 반영할까요?")) return;
        setBusy(true);
        setError("");
        try {
            const response = await api.post<IngestJob>(`/api/admin/ml-ingest/jobs/${job.jobId}/reapply`);
            setJobs((current) => current.map((item) => item.jobId === response.data.jobId ? response.data : item));
        } catch (cause) {
            setError(readError(cause, "학습 시드 재반영에 실패했습니다."));
        } finally {
            setBusy(false);
        }
    };

    const retryJson = async () => {
        if (!job || job.status !== "FAILED" || busy) return;
        setBusy(true);
        setError("");
        try {
            const response = await api.post<IngestJob>(`/api/admin/ml-ingest/jobs/${job.jobId}/retry-json`);
            setJobs((current) => current.map((item) => item.jobId === response.data.jobId ? response.data : item));
            void poll([job.jobId]);
        } catch (cause) {
            setBusy(false);
            setError(readError(cause, "JSON 구조화를 다시 시작하지 못했습니다."));
        }
    };

    const saveFeatures = async (edit: FeatureEdit) => {
        if (!job) throw new Error("선택된 작업이 없습니다.");
        const jobId = job.jobId;
        jobMutationVersionsRef.current[jobId] = (jobMutationVersionsRef.current[jobId] ?? 0) + 1;
        setError("");
        try {
            const response = await api.post<IngestJob>(`/api/admin/ml-ingest/jobs/${jobId}/review-features`, edit);
            setJobs((current) => mergeJobs(current, [response.data]));
        } catch (cause) {
            setError(readError(cause, "학습 피처를 저장하지 못했습니다."));
            throw cause;
        }
    };

    const saveContent = async (edit: ReviewContentEdit) => {
        if (!job) throw new Error("선택된 작업이 없습니다.");
        const jobId = job.jobId;
        jobMutationVersionsRef.current[jobId] = (jobMutationVersionsRef.current[jobId] ?? 0) + 1;
        setError("");
        try {
            const payload: ReviewContentEdit = {
                ...edit,
                days: edit.days && edit.days.length > 0 ? edit.days : [{ id: "import-day-1", dayTitle: "Day 1", date: "", activities: [] }],
            };
            const response = await api.post<IngestJob>(`/api/admin/ml-ingest/jobs/${jobId}/review-content`, payload);
            setJobs((current) => mergeJobs(current, [response.data]));
        } catch (cause) {
            setError(readError(cause, "여행 일정 수정 내용을 저장하지 못했습니다."));
            throw cause;
        }
    };

    const deleteReviewItem = async (dayIndex: number, activityIndex?: number) => {
        if (!job) return;
        const target = activityIndex === undefined ? "Day 전체" : "이 일정";
        if (!window.confirm(`${target}를 OCR 결과에서 삭제할까요?`)) return;
        setError("");
        try {
            const response = await api.post<IngestJob>(`/api/admin/ml-ingest/jobs/${job.jobId}/review-delete`, { dayIndex, activityIndex });
            setJobs((current) => mergeJobs(current, [response.data]));
        } catch (cause) {
            setError(readError(cause, "일정을 삭제하지 못했습니다."));
        }
    };

    const job = useMemo(() => jobs.find((item) => item.jobId === selectedJobId) ?? jobs[0] ?? null, [jobs, selectedJobId]);
    const completedStage = useMemo(() => PIPELINE.findIndex((item) => item.stage === job?.stage), [job?.stage]);

    if (isLoggedIn === null || (isLoggedIn && !me)) return null;

    if (me?.role !== "ADMIN") {
        return (
            <RequireAuth>
                <Header />
                <main className="mx-auto max-w-3xl px-6 py-10">
                    <section className="rounded-lg border border-gray-200 bg-white p-6">
                        <h1 className="text-2xl font-bold text-gray-950">접근 권한 없음</h1>
                        <p className="mt-2 text-sm text-gray-600">여행 데이터 파이프라인은 관리자만 사용할 수 있습니다.</p>
                    </section>
                </main>
            </RequireAuth>
        );
    }

    return (
        <RequireAuth>
            <main className="min-h-screen bg-gray-50">
                <Header />
                <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                    <header className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-gray-200 pb-6">
                        <div>
                            <div className="mb-2 flex items-center gap-2 text-xs font-bold text-emerald-700">
                                <Database size={15} /> ML DATA PIPELINE
                            </div>
                            <h1 className="font-[var(--font-paperlogy)] text-3xl font-bold text-gray-950">여행 일정 데이터 수집</h1>
                            <p className="mt-2 text-sm text-gray-600">이미지 또는 텍스트 일정에서 장소를 추출하고 좌표 보강, 검수, 학습 반영까지 진행합니다.</p>
                        </div>
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-600">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            Qwen3-VL · Phi-3/PaddleOCR 로컬 실행
                        </div>
                    </header>

                    {error && (
                        <div className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                            <AlertCircle className="mt-0.5 shrink-0" size={17} /> {error}
                        </div>
                    )}

                    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
                        <aside>
                            <div className="mb-4 grid grid-cols-3 rounded-lg border border-gray-300 bg-gray-100 p-1">
                                <button type="button" onClick={() => setSourceMode("image")} className={`flex min-h-10 items-center justify-center gap-2 rounded-md px-2 text-xs font-bold ${sourceMode === "image" ? "bg-white text-gray-950 shadow-sm" : "text-gray-500"}`}><FileImage size={15} />이미지 수집</button>
                                <button type="button" onClick={() => setSourceMode("text")} className={`flex min-h-10 items-center justify-center gap-2 rounded-md px-2 text-xs font-bold ${sourceMode === "text" ? "bg-white text-gray-950 shadow-sm" : "text-gray-500"}`}><FileText size={15} />텍스트 수집</button>
                                <button type="button" onClick={() => setSourceMode("json")} className={`flex min-h-10 items-center justify-center gap-2 rounded-md px-2 text-xs font-bold ${sourceMode === "json" ? "bg-white text-gray-950 shadow-sm" : "text-gray-500"}`}><Database size={15} />JSON 입력</button>
                            </div>
                            {(sourceMode === "text" || sourceMode === "json") && (
                                <div className="rounded-lg border border-gray-200 bg-white p-3">
                                    <label htmlFor="trip-source-text" className="text-xs font-bold text-gray-800">{sourceMode === "json" ? "여행 일정 JSON" : "여행 일정 텍스트"}</label>
                                    <textarea id="trip-source-text" value={sourceText} onChange={(event) => setSourceText(event.target.value)} rows={14} maxLength={100000} placeholder={sourceMode === "json" ? '{\n  "title": "도쿄 여행",\n  "destination": "도쿄",\n  "days": [{\n    "day": 1,\n    "date": "2026-02-15",\n    "places": [{\n      "name": "센소지",\n      "start_time": "10:00",\n      "content": "관람"\n    }]\n  }]\n}' : "예시)\n2026년 8월 10일 도쿄 여행\n09:00 도쿄역 출발\n10:00 아사쿠사 센소지 관광\n12:00 우에노 맛집 점심"} className="mt-2 w-full resize-y rounded-md border border-gray-300 px-3 py-2 font-mono text-sm leading-6 outline-none focus:border-emerald-500" />
                                    <div className="mt-1 flex justify-between text-[11px] text-gray-500"><span>{sourceMode === "json" ? "days[].places[] 형식으로 입력하면 LLM 구조화를 건너뜁니다." : "날짜, 시간, 장소를 포함하면 정확도가 높아집니다."}</span><span>{sourceText.length.toLocaleString()}/100,000</span></div>
                                </div>
                            )}
                            <input
                                ref={inputRef}
                                type="file"
                                multiple
                                accept="image/png,image/jpeg,image/webp,image/gif"
                                className="hidden"
                                onChange={(event: ChangeEvent<HTMLInputElement>) => chooseFiles(Array.from(event.target.files ?? []))}
                            />
                            <button
                                type="button"
                                onClick={() => inputRef.current?.click()}
                                onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
                                onDragOver={(event) => event.preventDefault()}
                                onDragLeave={() => setDragging(false)}
                                onDrop={(event: DragEvent<HTMLButtonElement>) => {
                                    event.preventDefault();
                                    setDragging(false);
                                    chooseFiles(Array.from(event.dataTransfer.files ?? []));
                                }}
                                className={`${sourceMode !== "image" ? "hidden" : "flex"} aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-lg border-2 border-dashed bg-white transition ${dragging ? "border-emerald-500 bg-emerald-50" : "border-gray-300 hover:border-gray-500"}`}
                            >
                                {previewUrls.length > 0 ? (
                                    <span className={`grid h-full w-full gap-1 p-1 ${previewUrls.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                                        {previewUrls.slice(0, 4).map((url, index) => (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img key={url} src={url} alt={`업로드할 여행 일정 ${index + 1}`} className="h-full min-h-0 w-full object-contain" />
                                        ))}
                                    </span>
                                ) : (
                                    <span className="flex flex-col items-center px-8 text-center">
                                        <Upload className="text-gray-700" size={30} />
                                        <strong className="mt-3 text-sm text-gray-900">여행 계획 이미지 선택</strong>
                                        <span className="mt-1 text-xs text-gray-500">PNG, JPG, WEBP · 최대 20MB</span>
                                    </span>
                                )}
                            </button>
                            {sourceMode === "image" && files.length > 0 && (
                                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-gray-600">
                                    <span className="min-w-0 truncate font-semibold">{files.length === 1 ? files[0].name : `${files.length}개 이미지`}</span>
                                    <span className="shrink-0 tabular-nums">{(files.reduce((sum, item) => sum + item.size, 0) / 1024 / 1024).toFixed(1)}MB</span>
                                </div>
                            )}
                            <fieldset className={sourceMode !== "image" ? "hidden" : "mt-4"}>
                                <legend className="mb-2 text-xs font-bold text-gray-800">OCR 모델</legend>
                                <div className="rounded-lg border border-gray-300 bg-gray-100 p-1">
                                    <button type="button" className="min-h-10 w-full rounded-md bg-white px-2 text-xs font-bold text-gray-950 shadow-sm">Qwen2.5-VL (7B Vision SOTA)</button>
                                </div>
                                <p className="mt-2 text-[11px] leading-4 text-gray-500">Qwen2.5-VL 모델이 이미지를 직관적 표 구조로 판독합니다.</p>
                            </fieldset>
                            <fieldset className={sourceMode !== "image" ? "hidden" : "mt-4"}>
                                <legend className="mb-2 text-xs font-bold text-gray-800">이미지 서식 / 레이아웃 감지</legend>
                                <div className="grid grid-cols-3 gap-1 rounded-lg border border-gray-300 bg-gray-100 p-1">
                                    {([
                                        ["auto", "🤖 자동 감지"],
                                        ["single_day", "📋 단일/세로 표"],
                                        ["multi_day", "📊 가로 멀티 표"],
                                        ["mobile", "📱 모바일 캡처"],
                                        ["prose", "📝 줄글/메모"],
                                    ] as const).map(([value, label]) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setLayoutChoice(value)}
                                            className={`min-h-9 rounded-md px-1 text-[11px] font-bold ${layoutChoice === value ? "bg-white text-gray-950 shadow-sm" : "text-gray-500"}`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                                <p className="mt-2 text-[11px] leading-4 text-gray-500">
                                    {layoutChoice === "auto" ? "VLM 모델이 이미지 시각 구조를 자동 판단하여 맞춤 OCR을 실행합니다." : layoutChoice === "single_day" ? "시간-일정-비용-비고 행이 묶인 표에 최적화된 OCR을 적용합니다." : layoutChoice === "multi_day" ? "Day 1, Day 2 등 가로형 Multi-Day 스프레드시트에 최적화합니다." : layoutChoice === "mobile" ? "모바일 일정 앱 피드/캡처 화면에 최적화합니다." : "자유 형식 줄글 또는 블로그 텍스트에 최적화합니다."}
                                </p>
                            </fieldset>
                            <fieldset className={sourceMode !== "image" ? "hidden" : "mt-4"}>
                                <legend className="mb-2 text-xs font-bold text-gray-800">여러 이미지 처리 방식</legend>
                                <div className="grid grid-cols-2 rounded-lg border border-gray-300 bg-gray-100 p-1">
                                    <button type="button" onClick={() => setBatchMode("combined")} className={`min-h-10 rounded-md px-2 text-xs font-bold ${batchMode === "combined" ? "bg-white text-gray-950 shadow-sm" : "text-gray-500"}`}>한 일정으로 합치기</button>
                                    <button type="button" onClick={() => setBatchMode("separate")} disabled={files.length < 2} className={`min-h-10 rounded-md px-2 text-xs font-bold ${batchMode === "separate" ? "bg-white text-gray-950 shadow-sm" : "text-gray-500"} disabled:cursor-not-allowed disabled:text-gray-300`}>사진별 별도 일정</button>
                                </div>
                                <p className="mt-2 text-[11px] leading-4 text-gray-500">
                                    {files.length < 2 ? "이미지를 2장 이상 선택하면 사진별 분리를 선택할 수 있습니다." : batchMode === "combined" ? "선택한 순서대로 이어진 하나의 여행 일정으로 분석합니다." : "각 사진을 서로 다른 여행 일정으로 분석합니다."}
                                </p>
                            </fieldset>
                            <button
                                type="button"
                                onClick={() => void start()}
                                disabled={(sourceMode === "image" ? files.length === 0 : sourceText.trim().length < 20) || busy}
                                className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gray-950 px-4 text-sm font-bold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                            >
                                {busy ? <LoaderCircle className="animate-spin" size={18} /> : <Cpu size={18} />}
                                {busy ? "처리 중" : sourceMode === "text" ? "텍스트 분석 시작" : sourceMode === "json" ? "JSON 등록 시작" : "이미지 분석 시작"}
                            </button>
                            <LogPanel job={job} logView={logView} onChangeView={setLogView} />
                        </aside>

                        <section className="min-w-0">
                            {jobs.length > 1 && (
                                <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                                    {jobs.map((item, index) => (
                                        <button key={item.jobId} type="button" onClick={() => setSelectedJobId(item.jobId)} className={`h-9 shrink-0 rounded-md border px-3 text-xs font-bold ${job?.jobId === item.jobId ? "border-gray-950 bg-gray-950 text-white" : "border-gray-200 bg-white text-gray-600"}`}>
                                            {item.modelLabel ?? `일정 ${index + 1}`} · {item.status === "REVIEW_REQUIRED" ? "검수" : item.progress + "%"}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div className="rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <h2 className="text-base font-bold text-gray-950">파이프라인 진행 상태</h2>
                                        <p className="mt-1 text-xs text-gray-500">{job ? `${job.modelLabel ?? "OCR"} · ${job.fileName}` : "이미지를 선택하고 분석을 시작하세요."}</p>
                                    </div>
                                    <strong className="text-2xl tabular-nums text-gray-950">{job?.progress ?? 0}%</strong>
                                </div>
                                <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
                                    <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${job?.progress ?? 0}%` }} />
                                </div>
                                <div className="mt-6 grid grid-cols-5 gap-2">
                                    {PIPELINE.map((item, index) => {
                                        const active = item.stage === job?.stage;
                                        const done = job?.stage === "APPROVED" || (completedStage > index && job?.stage !== "FAILED");
                                        const Icon = item.icon;
                                        return (
                                            <div key={item.stage} className="min-w-0 text-center">
                                                <span className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full border ${done ? "border-emerald-600 bg-emerald-600 text-white" : active ? "border-gray-950 bg-gray-950 text-white" : "border-gray-200 bg-gray-50 text-gray-400"}`}>
                                                    {done ? <Check size={17} /> : active && busy ? <LoaderCircle className="animate-spin" size={17} /> : <Icon size={17} />}
                                                </span>
                                                <span className={`mt-2 block truncate text-[11px] font-bold ${active || done ? "text-gray-900" : "text-gray-400"}`}>{item.label}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="mt-5">
                                <div className="min-w-0 rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-base font-bold text-gray-950">추출 결과</h2>
                                        {job?.review && (
                                            <span className="text-xs font-bold text-gray-500">장소 {job.review.quality.place_count}개</span>
                                        )}
                                    </div>
                                    {!job?.review ? (
                                        <div className="flex min-h-64 flex-col items-center justify-center text-center text-gray-400">
                                            <FileImage size={28} />
                                            <p className="mt-3 text-sm font-semibold">분석이 끝나면 날짜별 일정과 좌표가 표시됩니다.</p>
                                        </div>
                                    ) : (
                                        <ReviewResult review={job.review} error={error} onSaveFeatures={saveFeatures} onSaveContent={saveContent} onDelete={deleteReviewItem} busy={busy} onBusyChange={setBusy} />
                                    )}
                                </div>

                            </div>

                            {job?.status === "REVIEW_REQUIRED" && (
                                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-5">
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <AlertCircle size={17} className="text-amber-600" />
                                        {job.review?.quality.model_features_ready === false
                                            ? `학습 피처 미입력 ${job.review.quality.model_feature_gaps?.length ?? 0}개를 확인하세요.`
                                            : "미확인 장소를 확인한 뒤 학습 데이터에 반영하세요."}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => void approve()}
                                        disabled={busy || !job.review?.quality.ready_for_review || job.review?.quality.model_features_ready === false}
                                        className="flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                                    >
                                        {busy ? <RefreshCw className="animate-spin" size={17} /> : <Database size={17} />}
                                        검수 완료 및 데이터 반영
                                    </button>
                                </div>
                            )}
                            {job?.status === "FAILED" && (
                                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-red-200 pt-5">
                                    <div className="min-w-0 text-sm text-red-700">
                                        <p className="font-bold">JSON 구조화 중 오류가 발생했습니다.</p>
                                        <p className="mt-1 max-w-3xl break-words text-xs text-red-600">{job.error}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => void retryJson()}
                                        disabled={busy}
                                        className="flex h-10 shrink-0 items-center gap-2 rounded-lg bg-gray-950 px-4 text-sm font-bold text-white hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                                    >
                                        {busy ? <LoaderCircle className="animate-spin" size={17} /> : <RefreshCw size={17} />}
                                        JSON 작업만 재시도
                                    </button>
                                </div>
                            )}
                            {job?.status === "APPROVED" && (
                                <div className={`mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm font-bold ${job.travelPlanId ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                                    <span className="flex items-center gap-2">
                                        {job.travelPlanId ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                                        {job.travelPlanId
                                            ? "학습 시드와 기본 템플릿 일정에 반영되었습니다."
                                            : "학습 시드는 승인됐지만 기본 템플릿 일정 반영을 확인할 수 없습니다."}
                                    </span>
                                    <div className="flex items-center gap-3">
                                        {job.travelPlanId && <a href={`/createplan/${encodeURIComponent(job.travelPlanId)}`} className="inline-flex items-center gap-1 underline underline-offset-2">일정 열기 <ExternalLink size={14} /></a>}
                                        <button type="button" onClick={() => void reapply()} disabled={busy} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-violet-700 px-3 text-xs font-bold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-gray-300">
                                            {busy ? <RefreshCw className="animate-spin" size={15} /> : <RefreshCw size={15} />}
                                            학습 시드 재반영
                                        </button>
                                    </div>
                                </div>
                            )}
                        </section>
                    </div>
                </div>
            </main>
        </RequireAuth>
    );
}

function LogPanel({ job, logView, onChangeView }: { job: IngestJob | null; logView: "pipeline" | "llm"; onChangeView: (view: "pipeline" | "llm") => void }) {
    return (
        <section className="mt-5 min-w-0 rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex border-b border-gray-200">
                <button type="button" onClick={() => onChangeView("pipeline")} className={`h-9 flex-1 border-b-2 text-xs font-bold ${logView === "pipeline" ? "border-gray-950 text-gray-950" : "border-transparent text-gray-500"}`}>작업 로그</button>
                <button type="button" onClick={() => onChangeView("llm")} className={`flex h-9 flex-1 items-center justify-center gap-1.5 border-b-2 text-xs font-bold ${logView === "llm" ? "border-gray-950 text-gray-950" : "border-transparent text-gray-500"}`}>
                    <Bot size={14} /> LLM 메시지
                </button>
            </div>
            {logView === "pipeline" ? (
                <div className="mt-4 max-h-[440px] space-y-5 overflow-y-auto pr-1">
                    {(job?.events ?? []).length === 0 ? (
                        <p className="py-10 text-center text-xs font-semibold text-gray-400">작업 대기 중</p>
                    ) : (job?.events ?? []).map((item, index) => (
                        <div key={`${item.at}-${index}`} className="relative pl-7">
                            {index < (job?.events.length ?? 0) - 1 && <span className="absolute left-[7px] top-5 h-[calc(100%+4px)] w-px bg-gray-200" />}
                            <span className={`absolute left-0 top-0.5 flex h-4 w-4 items-center justify-center rounded-full ${item.stage === "FAILED" ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-700"}`}>
                                {item.stage === "FAILED" ? <AlertCircle size={11} /> : <Check size={11} />}
                            </span>
                            <p className="text-xs font-bold text-gray-900">{item.title}</p>
                            <p className="mt-1 text-xs leading-5 text-gray-500">{item.detail}</p>
                            <p className="mt-1 flex items-center gap-1 text-[10px] text-gray-400"><Clock3 size={10} /> {formatTime(item.at)}</p>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="mt-4 max-h-[440px] space-y-3 overflow-y-auto pr-1">
                    {(job?.llmMessages ?? []).length === 0 ? (
                        <p className="py-10 text-center text-xs font-semibold text-gray-400">메시지 대기 중</p>
                    ) : (job?.llmMessages ?? []).map((message, index) => (
                        <details key={`${message.at}-${index}`} className="border-b border-gray-100 pb-3" open={index === (job?.llmMessages.length ?? 0) - 1}>
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-bold text-gray-800">
                                <span>{message.stage} · {message.role === "assistant" ? "Qwen" : "요청"}</span>
                                <span className="font-normal text-gray-400">{formatTime(message.at)}</span>
                            </summary>
                            <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words bg-gray-50 p-2 text-[10px] leading-4 text-gray-600">{message.content}</pre>
                        </details>
                    ))}
                </div>
            )}
        </section>
    );
}

const FEATURE_OPTIONS = {
    ageBucket: [["unknown", "미입력"], ["10s", "10대"], ["20s", "20대"], ["30s", "30대"], ["40s", "40대"], ["50s", "50대"], ["60s_plus", "60대 이상"]],
    companionType: [["unknown", "미입력"], ["solo", "혼자"], ["couple", "커플"], ["friends", "친구"], ["parents_only", "부모님"], ["family_with_young_child", "영유아 가족"], ["family_with_child", "자녀 동반 가족"], ["family_with_teen", "청소년 가족"], ["multi_generation", "다세대 가족"]],
    childAgeBucket: [["unknown", "미입력"], ["none", "자녀 없음"], ["infant", "영아"], ["toddler", "유아"], ["preschool", "미취학"], ["lower_elementary", "초등 저학년"], ["upper_elementary", "초등 고학년"], ["teen", "청소년"]],
    groupAgeBucket: [["unknown", "미입력"], ["10s", "10대"], ["20s", "20대"], ["30s", "30대"], ["40s", "40대"], ["50s", "50대"], ["60s_plus", "60대 이상"], ["mixed", "혼합"]],
    monthBucket: [["unknown", "미입력"], ...Array.from({ length: 12 }, (_, index) => [String(index + 1), `${index + 1}월`])],
    seasonBucket: [["unknown", "미입력"], ["spring", "봄"], ["summer", "여름"], ["rainy", "장마"], ["autumn", "가을"], ["winter", "겨울"]],
} satisfies Record<string, string[][]>;

const TIME_BUCKET_OPTIONS = [["unknown", "시간 미지정 (학습 가능)"], ["morning", "아침"], ["lunch", "점심"], ["afternoon", "오후"], ["evening", "저녁"], ["night", "야간"]];
const CATEGORY_OPTIONS = [["place", "일반 장소"], ["station", "공항·역"], ["hotel", "숙소"], ["theme_park", "테마파크"], ["kid_museum", "어린이 박물관"], ["museum", "박물관·미술관"], ["park", "공원·동물원"], ["shopping", "쇼핑"], ["food", "식당·카페"], ["viewpoint", "전망대"], ["landmark", "명소·사찰"]];

function inferTimeBucket(value: string): string {
    const text = value.trim();
    const clock = text.match(/(?:^|\s)([01]?\d|2[0-3])\s*[:.]\s*([0-5]\d)/);
    const korean = text.match(/(?:^|\s)([01]?\d|2[0-3])\s*시/);
    const compact = text.replace(/\s+/g, "").match(/^([01]\d|2[0-3])([0-5]\d)$/);
    const hour = Number((clock ?? korean ?? compact)?.[1]);
    if (!Number.isInteger(hour)) return "unknown";
    if (hour >= 5 && hour < 11) return "morning";
    if (hour >= 11 && hour < 14) return "lunch";
    if (hour >= 14 && hour < 18) return "afternoon";
    if (hour >= 18 && hour < 21) return "evening";
    return "night";
}

function ReviewResult({ review, error, onSaveFeatures, onSaveContent, onDelete, busy, onBusyChange }: { review: Review; error?: string; onSaveFeatures: (edit: FeatureEdit) => Promise<void>; onSaveContent: (edit: ReviewContentEdit) => Promise<void>; onDelete: (dayIndex: number, activityIndex?: number) => Promise<void>; busy?: boolean; onBusyChange?: (busy: boolean) => void }) {
    const pendingGooglePlaces = (review.trip.days ?? []).flatMap(day => day.places ?? [])
        .filter(place => place.geocode?.provider?.toLowerCase() === "google").length;
    return (
        <div className="mt-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-gray-100 pb-4 text-sm">
                <strong className="text-gray-950">{review.trip.title || "제목 미확인"}</strong>
                <span className="text-gray-500">{review.trip.destination || "여행지 미확인"}</span>
                <span className="text-gray-500">{[review.trip.start_date, review.trip.end_date].filter(Boolean).join(" ~ ") || "날짜 미확인"}</span>
                {typeof review.trip.confidence === "number" && <span className="font-semibold text-emerald-700">신뢰도 {Math.round(review.trip.confidence * 100)}%</span>}
                {(review.quality.google_calls ?? 0) > 0 && (
                    <span className="font-semibold text-blue-700">
                        Google {review.quality.google_calls}/{review.quality.google_call_limit ?? 0} · OSM 승격 {review.quality.google_promoted_to_nominatim ?? 0}
                    </span>
                )}
                {pendingGooglePlaces > 0 && <span className="font-semibold text-amber-700">OSM 전환 전 학습 제외 {pendingGooglePlaces}개</span>}
                {(review.quality.geographic_rejections ?? 0) > 0 && (
                    <span className="font-semibold text-amber-700">지역 이탈 거절 {review.quality.geographic_rejections}</span>
                )}
            </div>
            <FeatureReview review={review} onSave={onSaveFeatures} />
            {review.plan_preview ? <BasicTemplatePreview review={review} plan={review.plan_preview} coordinateConflict={parseDuplicateCoordinate(error)} onSaveContent={onSaveContent} busy={busy} onBusyChange={onBusyChange} /> : <div className="divide-y divide-gray-100">
                {(review.trip.days ?? []).map((day) => (
                    <div key={day.day} className="grid gap-3 py-4 sm:grid-cols-[72px_minmax(0,1fr)]">
                        <div>
                            <strong className="text-sm text-gray-950">{day.day}일차</strong>
                            {day.date && <p className="mt-1 text-xs text-gray-500">{day.date}</p>}
                        </div>
                        <div className="space-y-2">
                            {(day.places ?? []).map((place, index) => (
                                <div key={`${place.name}-${index}`} className="flex min-w-0 items-center gap-3 rounded-md bg-gray-50 px-3 py-2.5">
                                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${place.geocode ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                        {place.geocode ? <MapPin size={14} /> : <AlertCircle size={14} />}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-bold text-gray-900">{place.name}</p>
                                        <p className="mt-0.5 truncate text-xs text-gray-500">{place.geocode?.display_name || "좌표 미확인"}</p>
                                    </div>
                                    {place.geocode && (
                                        <span className={`shrink-0 text-[10px] font-bold uppercase ${place.geocode.provider === "google" ? "text-blue-700" : "text-emerald-700"}`}>
                                            {place.geocode.provider === "google" ? "GOOGLE 임시" : "OSM"}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>}
            {review.quality.unresolved_places.length > 0 && (
                <div className="mt-3 border-t border-gray-200 pt-4">
                    <p className="text-xs font-bold text-amber-700">좌표 확인 필요</p>
                    <p className="mt-1 text-sm text-gray-700">{review.quality.unresolved_places.join(", ")}</p>
                </div>
            )}
        </div>
    );
}

function FeatureReview({ review, onSave }: { review: Review; onSave: (edit: FeatureEdit) => Promise<void> }) {
    const [saving, setSaving] = useState("");
    const context = review.plan_preview?.tripContext ?? {};
    const fields = [
        ["ageBucket", "여행자 연령대", context.ageBucket ?? review.seed_preview?.age_bucket ?? review.trip.traveler_age_bucket ?? "unknown"],
        ["companionType", "동행 유형", context.companionType ?? review.seed_preview?.companion_type ?? review.trip.companion_type ?? "unknown"],
        ["childAgeBucket", "자녀 연령", context.childAgeBucket ?? review.seed_preview?.child_age_bucket ?? review.trip.child_age_bucket ?? "unknown"],
        ["groupAgeBucket", "그룹 연령대", context.groupAgeBucket ?? review.seed_preview?.group_age_bucket ?? review.trip.group_age_bucket ?? "unknown"],
        ["monthBucket", "여행 월", context.monthBucket ?? review.seed_preview?.month_bucket ?? "unknown"],
        ["seasonBucket", "계절", context.seasonBucket ?? review.seed_preview?.season_bucket ?? "unknown"],
    ] as const;
    const activities = review.plan_preview?.days.flatMap((day, dayIndex) =>
        day.activities.map((activity, placeIndex) => {
            const sourcePlace = review.trip.days?.[dayIndex]?.places?.[placeIndex];
            return {
                ...activity,
                category: activity.category ?? sourcePlace?.category ?? "place",
                timeBucket: activity.timeBucket ?? sourcePlace?.time_bucket ?? "unknown",
            };
        })
    ) ?? [];

    const save = async (key: string, edit: FeatureEdit) => {
        setSaving(key);
        try {
            await onSave(edit);
        } finally {
            setSaving("");
        }
    };

    return (
        <section className="border-b border-gray-200 py-5">
            <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-gray-950">학습 피처 검수</h3>
                <span className={`text-xs font-bold ${review.quality.model_features_ready ? "text-emerald-700" : "text-amber-700"}`}>
                    {review.quality.model_features_ready ? "입력 완료" : `미입력 ${review.quality.model_feature_gaps?.length ?? 0}개`}
                </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {fields.map(([key, label, value]) => (
                    <label key={key} className="min-w-0 text-xs font-bold text-gray-600">
                        <span className="mb-1.5 block">{label}</span>
                        <select
                            value={value}
                            disabled={Boolean(saving)}
                            onChange={(event) => void save(key, { context: { [key]: event.target.value } })}
                            className={`h-10 w-full border bg-white px-3 text-sm font-semibold outline-none ${value === "unknown" ? "border-amber-400 text-amber-800" : "border-gray-300 text-gray-900"}`}
                        >
                            {FEATURE_OPTIONS[key].map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
                        </select>
                    </label>
                ))}
            </div>
            <details className="mt-4 border-t border-gray-100 pt-3">
                <summary className="cursor-pointer text-xs font-bold text-gray-700">장소별 시간대·카테고리 ({activities.length})</summary>
                <div className="mt-3 divide-y divide-gray-100">
                    {activities.map((activity) => (
                        <div key={activity.id} className="grid gap-2 py-2.5 sm:grid-cols-[minmax(180px,1fr)_150px_170px] sm:items-center">
                            <span className="truncate text-sm font-semibold text-gray-900">{activity.location}</span>
                            <select
                                aria-label={`${activity.location} 시간대`}
                                value={activity.timeBucket ?? "unknown"}
                                disabled={Boolean(saving) || inferTimeBucket(activity.time) !== "unknown"}
                                title={inferTimeBucket(activity.time) !== "unknown" ? "입력된 시간으로 자동 계산됩니다." : "시간이 없을 때 직접 지정할 수 있습니다."}
                                onChange={(event) => void save(`${activity.id}:time`, { placeFeatures: [{ id: activity.id, timeBucket: event.target.value, category: activity.category ?? "place" }] })}
                                className="h-9 border border-gray-300 bg-white px-2 text-xs font-semibold text-gray-800 disabled:bg-gray-100 disabled:text-gray-500"
                            >
                                {TIME_BUCKET_OPTIONS.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
                            </select>
                            <select
                                aria-label={`${activity.location} 카테고리`}
                                value={activity.category ?? "place"}
                                disabled={Boolean(saving)}
                                onChange={(event) => void save(`${activity.id}:category`, { placeFeatures: [{ id: activity.id, timeBucket: activity.timeBucket ?? "unknown", category: event.target.value }] })}
                                className="h-9 border border-gray-300 bg-white px-2 text-xs font-semibold text-gray-800"
                            >
                                {CATEGORY_OPTIONS.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
                            </select>
                        </div>
                    ))}
                </div>
            </details>
        </section>
    );
}

function BasicTemplatePreview({ review, plan, coordinateConflict, onSaveContent, busy, onBusyChange }: { review: Review; plan: NonNullable<Review["plan_preview"]>; coordinateConflict?: { lat: number; lon: number } | null; onSaveContent: (edit: ReviewContentEdit) => Promise<void>; busy?: boolean; onBusyChange?: (busy: boolean) => void }) {
    type Activity = NonNullable<Review["plan_preview"]>["days"][number]["activities"][number];
    type Day = NonNullable<Review["plan_preview"]>["days"][number];
    const initialDraft = (): ReviewContentEdit => ({
        title: review.trip.title ?? plan.title ?? "",
        destination: review.trip.destination ?? "",
        startDate: review.trip.start_date ?? "",
        endDate: review.trip.end_date ?? "",
        costCurrency: plan.costCurrency === "JPY" ? "JPY" : "KRW",
        days: plan.days.map((day) => ({ ...day, activities: day.activities.map((activity) => ({ ...activity })) })),
    });
    const [draft, setDraft] = useState<ReviewContentEdit>(initialDraft);
    const [dirty, setDirty] = useState(false);
    const [savingContent, setSavingContent] = useState(false);
    const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);
    const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
    const [editingOrigin, setEditingOrigin] = useState<PlaceSearchOrigin | null>(null);

    const addDaysToIsoDate = (isoDate: string, offset: number): string => {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
        if (!match) return "";
        const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
        date.setUTCDate(date.getUTCDate() + offset);
        return date.toISOString().slice(0, 10);
    };

    const synchronizeTripDates = (current: ReviewContentEdit, days = current.days): ReviewContentEdit => {
        if (!current.startDate) return { ...current, endDate: "", days: days.map((day) => ({ ...day, date: "" })) };
        return {
            ...current,
            endDate: addDaysToIsoDate(current.startDate, Math.max(0, days.length - 1)),
            days: days.map((day, index) => ({ ...day, date: addDaysToIsoDate(current.startDate, index) })),
        };
    };

    const [draggedPos, setDraggedPos] = useState<{ dayIndex: number; activityIndex: number } | null>(null);
    const [dragOverPos, setDragOverPos] = useState<{ dayIndex: number; activityIndex: number } | null>(null);

    const handleDragStart = (e: React.DragEvent, dayIndex: number, activityIndex: number) => {
        e.dataTransfer.setData("text/plain", `${dayIndex}:${activityIndex}`);
        e.dataTransfer.effectAllowed = "move";
        setDraggedPos({ dayIndex, activityIndex });
    };

    const handleDragOver = (e: React.DragEvent, dayIndex: number, activityIndex: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (dragOverPos?.dayIndex !== dayIndex || dragOverPos?.activityIndex !== activityIndex) {
            setDragOverPos({ dayIndex, activityIndex });
        }
    };

    const handleDrop = (e: React.DragEvent, targetDayIndex: number, targetActivityIndex: number) => {
        e.preventDefault();
        setDragOverPos(null);
        if (!draggedPos) return;
        const { dayIndex: sourceDayIndex, activityIndex: sourceActivityIndex } = draggedPos;
        setDraggedPos(null);

        if (sourceDayIndex === targetDayIndex && sourceActivityIndex === targetActivityIndex) return;

        setDraft((current) => {
            const sourceActivities = [...current.days[sourceDayIndex].activities];
            const [movedItem] = sourceActivities.splice(sourceActivityIndex, 1);
            if (!movedItem) return current;

            if (sourceDayIndex === targetDayIndex) {
                sourceActivities.splice(targetActivityIndex, 0, movedItem);
                return {
                    ...current,
                    days: current.days.map((day, idx) => idx === sourceDayIndex ? { ...day, activities: sourceActivities } : day),
                };
            } else {
                const targetActivities = [...current.days[targetDayIndex].activities];
                targetActivities.splice(targetActivityIndex, 0, movedItem);
                return {
                    ...current,
                    days: current.days.map((day, idx) => {
                        if (idx === sourceDayIndex) return { ...day, activities: sourceActivities };
                        if (idx === targetDayIndex) return { ...day, activities: targetActivities };
                        return day;
                    }),
                };
            }
        });
        setDirty(true);
    };

    const handleDragEnd = () => {
        setDraggedPos(null);
        setDragOverPos(null);
    };

    const isFirstMetaMount = useRef(true);
    const [autoSavedMeta, setAutoSavedMeta] = useState(false);

    useEffect(() => {
        // 폴링 응답이 도착해도 아직 저장되지 않은 관리자 편집값을 덮어쓰지 않는다.
        if (dirty) return;
        setDraft(initialDraft());
        setDirty(false);
        setExpandedActivityId(null);
        // 서버에서 저장·좌표 수정된 검수 결과가 도착했을 때 편집본을 동기화한다.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [plan, review.trip.title, review.trip.destination, review.trip.start_date, review.trip.end_date, dirty]);

    useEffect(() => {
        if (!coordinateConflict) return;
        const conflicted = draft.days.flatMap((day) => day.activities).find((activity) =>
            Number.isFinite(activity.lat) && Number.isFinite(activity.lon)
            && Math.abs(Number(activity.lat) - coordinateConflict.lat) < 0.000001
            && Math.abs(Number(activity.lon) - coordinateConflict.lon) < 0.000001
        );
        if (conflicted) setExpandedActivityId(conflicted.id);
    }, [coordinateConflict, draft.days]);

    useEffect(() => {
        if (isFirstMetaMount.current) {
            isFirstMetaMount.current = false;
            return;
        }
        const timer = setTimeout(() => {
            void onSaveContent(draft).then(() => {
                setDirty(false);
                setAutoSavedMeta(true);
                setTimeout(() => setAutoSavedMeta(false), 2000);
            }).catch(() => {});
        }, 600);
        return () => clearTimeout(timer);
    }, [draft.title, draft.destination, draft.startDate, draft.endDate, draft.costCurrency]);

    const updateMeta = (key: keyof Omit<ReviewContentEdit, "days">, value: string) => {
        setDraft((current) => {
            const updated = { ...current, [key]: value };
            return key === "startDate" ? synchronizeTripDates(updated) : updated;
        });
        setDirty(true);
    };

    const updateDay = (dayIndex: number, values: Partial<Day>) => {
        setDraft((current) => ({
            ...current,
            days: current.days.map((day, index) => index === dayIndex ? { ...day, ...values } : day),
        }));
        setDirty(true);
    };

    const updateActivity = (dayIndex: number, activityIndex: number, key: keyof Activity, value: string | number) => {
        setDraft((current) => ({
            ...current,
            days: current.days.map((day, index) => index !== dayIndex ? day : {
                ...day,
                activities: day.activities.map((activity, rowIndex) => {
                    if (rowIndex !== activityIndex) return activity;
                    const updated = { ...activity, [key]: value };
                    if (key === "time") updated.timeBucket = inferTimeBucket(String(value));
                    return updated;
                }),
            }),
        }));
        setDirty(true);
    };

    const moveDay = (dayIndex: number, direction: -1 | 1) => {
        const target = dayIndex + direction;
        if (target < 0 || target >= draft.days.length) return;
        const days = [...draft.days];
        [days[dayIndex], days[target]] = [days[target], days[dayIndex]];
        setDraft((current) => synchronizeTripDates(current, days));
        setDirty(true);
    };

    const moveActivity = (dayIndex: number, activityIndex: number, direction: -1 | 1) => {
        const activities = [...draft.days[dayIndex].activities];
        const target = activityIndex + direction;
        if (target < 0 || target >= activities.length) return;
        [activities[activityIndex], activities[target]] = [activities[target], activities[activityIndex]];
        updateDay(dayIndex, { activities });
    };

    const moveActivityToDay = (sourceDayIndex: number, activityIndex: number, targetDayIndex: number) => {
        if (sourceDayIndex === targetDayIndex || targetDayIndex < 0 || targetDayIndex >= draft.days.length) return;
        setDraft((current) => {
            const activity = current.days[sourceDayIndex]?.activities[activityIndex];
            if (!activity) return current;
            return {
                ...current,
                days: current.days.map((day, dayIndex) => {
                    if (dayIndex === sourceDayIndex) {
                        return { ...day, activities: day.activities.filter((_, index) => index !== activityIndex) };
                    }
                    if (dayIndex === targetDayIndex) {
                        return { ...day, activities: [...day.activities, activity] };
                    }
                    return day;
                }),
            };
        });
        setDirty(true);
    };

    const ocrFileInputRef = useRef<HTMLInputElement | null>(null);
    const [ocrLoading, setOcrLoading] = useState(false);

    const handleOcrAddDay = async (selectedFiles: FileList | null) => {
        if (!selectedFiles || selectedFiles.length === 0 || ocrLoading) return;
        setOcrLoading(true);
        onBusyChange?.(true);
        try {
            const body = new FormData();
            Array.from(selectedFiles).forEach((file) => body.append("files", file));
            body.append("mode", "combined");
            body.append("model", "qwen");
            body.append("layout", "auto");
            const response = await api.post<BatchStartResponse>("/api/admin/ml-ingest/jobs", body, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            const createdJobId = response.data.jobs[0]?.jobId;
            if (!createdJobId) throw new Error("작업 생성을 실패했습니다.");

            let completedReview: Review | null = null;
            for (let attempt = 0; attempt < 45; attempt++) {
                await new Promise((r) => setTimeout(r, 2000));
                const res = await api.get<IngestJob>(`/api/admin/ml-ingest/jobs/${createdJobId}`);
                if (res.data.status === "REVIEW_REQUIRED" && res.data.review) {
                    completedReview = res.data.review;
                    break;
                }
                if (res.data.status === "FAILED") {
                    throw new Error(res.data.error || "이미지 OCR 분석에 실패했습니다.");
                }
            }
            if (completedReview?.plan_preview?.days) {
                const incomingDays = completedReview.plan_preview.days;
                setDraft((current) => {
                    const startDayIndex = current.days.length;
                    const mappedNewDays = incomingDays.map((incomingDay, idx) => ({
                        id: `ocr-day-${Date.now()}-${idx}`,
                        date: incomingDay.date || "",
                        dayTitle: incomingDay.dayTitle || `Day ${startDayIndex + idx + 1}`,
                        activities: (incomingDay.activities || []).map((act, aIdx) => ({
                            id: `ocr-act-${Date.now()}-${idx}-${aIdx}`,
                            time: act.time || "",
                            location: act.location || "장소명 미입력",
                            activity: act.activity || "",
                            cost: act.cost || 0,
                            category: act.category || "place",
                            timeBucket: act.timeBucket || "unknown",
                            lat: act.lat || null,
                            lon: act.lon || null,
                            coordinateProvider: act.coordinateProvider || "none",
                        })),
                    }));
                    return synchronizeTripDates(current, [...current.days, ...mappedNewDays]);
                });
                setDirty(true);
            }
        } catch (cause) {
            alert(readError(cause, "이미지 OCR 분석 중 오류가 발생했습니다."));
        } finally {
            setOcrLoading(false);
            onBusyChange?.(false);
            if (ocrFileInputRef.current) ocrFileInputRef.current.value = "";
        }
    };

    const addDay = () => {
        const number = draft.days.length + 1;
        setDraft((current) => synchronizeTripDates(current, [...current.days, { id: `draft-day-${Date.now()}`, date: "", dayTitle: `Day ${number}`, activities: [] }]));
        setDirty(true);
    };

    const addActivity = (dayIndex: number) => {
        const activity: Activity = {
            id: `draft-activity-${Date.now()}-${dayIndex}`,
            time: "",
            location: "새 장소",
            activity: "",
            cost: 0,
            category: "place",
            timeBucket: "unknown",
            lat: null,
            lon: null,
        };
        updateDay(dayIndex, { activities: [...draft.days[dayIndex].activities, activity] });
        setExpandedActivityId(activity.id);
    };

    const removeDay = (dayIndex: number) => {
        if (draft.days.length === 1) return;
        setDraft((current) => synchronizeTripDates(current, current.days.filter((_, index) => index !== dayIndex)));
        setDirty(true);
    };

    const removeActivity = (dayIndex: number, activityIndex: number) => {
        if (expandedActivityId === draft.days[dayIndex].activities[activityIndex]?.id) setExpandedActivityId(null);
        updateDay(dayIndex, { activities: draft.days[dayIndex].activities.filter((_, index) => index !== activityIndex) });
    };

    const resetChanges = () => {
        setDraft(initialDraft());
        setDirty(false);
        setExpandedActivityId(null);
    };

    const saveAll = async () => {
        setSavingContent(true);
        try {
            await onSaveContent(draft);
            setDirty(false);
        } finally {
            setSavingContent(false);
        }
    };

    const beginEdit = (activity: Activity) => {
        const activities = draft.days.flatMap((day) => day.activities);
        const activityIndex = activities.findIndex((value) => value.id === activity.id);
        const previous = activities.slice(0, activityIndex).reverse().find((value) => Number.isFinite(value.lat) && Number.isFinite(value.lon));
        const fallback = activities.find((value) => value.id !== activity.id && Number.isFinite(value.lat) && Number.isFinite(value.lon));
        const originActivity = previous ?? fallback;
        setEditingOrigin(originActivity && Number.isFinite(originActivity.lat) && Number.isFinite(originActivity.lon) ? {
            name: originActivity.location,
            lat: Number(originActivity.lat),
            lon: Number(originActivity.lon),
        } : null);
        setEditingActivity(activity);
    };

    const chooseResult = (result: PlaceResult) => {
        if (!editingActivity) return;
        const resultId = result.id.toLowerCase();
        const provider = resultId.startsWith("custom:") ? "custom" : resultId.startsWith("google:") ? "google" : resultId.startsWith("photon:") ? "photon" : resultId.startsWith("manual:") ? "manual" : "nominatim";
        const location = result.displayTitle || result.title || editingActivity.location;
        const displayName = result.subtitle || result.displayTitle || result.title;
        setDraft((current) => ({
            ...current,
            days: current.days.map((day) => ({
                ...day,
                activities: day.activities.map((activity) => activity.id === editingActivity.id ? {
                    ...activity,
                    location,
                    placeId: result.id,
                    placeSubtitle: displayName,
                    address: displayName,
                    lat: result.lat,
                    lon: result.lon,
                    coordinateProvider: provider,
                } : activity),
            })),
        }));
        setDirty(true);
        setEditingActivity(null);
    };

    return (
        <div className="mt-4 space-y-5 pb-4">
            <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 px-5 py-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-gray-950">여행 기본 정보</h3>
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">⚡ 수정 시 자동 저장</span>
                            {autoSavedMeta && <span className="animate-pulse rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">자동 저장 완료!</span>}
                        </div>
                        <p className="mt-1 text-xs text-gray-500">기본 정보(제목, 지역, 시작일, 종료일)는 입력 즉시 자동 저장됩니다.</p>
                    </div>
                    <button type="button" disabled={!dirty || savingContent} onClick={() => void saveAll()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gray-950 px-3.5 text-xs font-bold text-white shadow-sm transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none">
                        {savingContent ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />} 변경사항 저장
                    </button>
                </div>
                <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5">
                    <label className="text-xs font-bold text-gray-600"><span className="mb-1.5 block">여행 제목</span><input value={draft.title} onChange={(event) => updateMeta("title", event.target.value)} className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" /></label>
                    <label className="text-xs font-bold text-gray-600"><span className="mb-1.5 block">여행 지역</span><input value={draft.destination} onChange={(event) => updateMeta("destination", event.target.value)} className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" /></label>
                    <label className="text-xs font-bold text-gray-600"><span className="mb-1.5 block">시작일</span><input type="date" value={draft.startDate} onChange={(event) => updateMeta("startDate", event.target.value)} className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" /></label>
                    <label className="text-xs font-bold text-gray-600"><span className="mb-1.5 block">종료일</span><input type="date" value={draft.endDate} onChange={(event) => updateMeta("endDate", event.target.value)} className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" /></label>
                    <label className="text-xs font-bold text-gray-600"><span className="mb-1.5 block">경비 통화 표기</span><select value={draft.costCurrency} onChange={(event) => updateMeta("costCurrency", event.target.value)} className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"><option value="KRW">원화 (원)</option><option value="JPY">엔화 (엔)</option></select></label>
                </div>
            </section>
            {draft.days.map((day, dayIndex) => (
                <section key={day.id} className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3.5">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-emerald-700 px-2 text-xs font-black text-white">D{dayIndex + 1}</span>
                            <input aria-label={`${dayIndex + 1}일차 제목`} value={day.dayTitle} onChange={(event) => updateDay(dayIndex, { dayTitle: event.target.value })} className="h-9 w-44 rounded-lg border border-transparent bg-transparent px-2 text-sm font-bold text-gray-950 outline-none hover:border-gray-300 hover:bg-white focus:border-emerald-600 focus:bg-white" />
                            <input aria-label={`${dayIndex + 1}일차 날짜`} type="date" value={day.date} onChange={(event) => updateDay(dayIndex, { date: event.target.value })} className="h-9 rounded-lg border border-transparent bg-transparent px-2 text-xs text-gray-600 outline-none hover:border-gray-300 hover:bg-white focus:border-emerald-600 focus:bg-white" />
                            <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-gray-500 ring-1 ring-gray-200">일정 {day.activities.length}개</span>
                        </div>
                        <span className="flex items-center gap-1">
                            <button type="button" disabled={dayIndex === 0} onClick={() => moveDay(dayIndex, -1)} title="Day 위로 이동" className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-gray-400 disabled:text-gray-300"><ArrowUp size={14} /></button>
                            <button type="button" disabled={dayIndex === draft.days.length - 1} onClick={() => moveDay(dayIndex, 1)} title="Day 아래로 이동" className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-gray-400 disabled:text-gray-300"><ArrowDown size={14} /></button>
                            <button type="button" onClick={() => addActivity(dayIndex)} className="ml-1 inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-700 bg-white px-2.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50"><Plus size={13} /> 일정 추가</button>
                            <button type="button" disabled={draft.days.length === 1} onClick={() => removeDay(dayIndex)} title="Day 삭제" className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 disabled:text-gray-300"><Trash2 size={14} /></button>
                        </span>
                    </div>
                    <div className="divide-y divide-gray-100 p-3">
                        {day.activities.length === 0 && <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 py-10 text-center"><Clock3 size={22} className="text-gray-300" /><p className="mt-2 text-sm font-bold text-gray-500">등록된 일정이 없습니다</p><button type="button" onClick={() => addActivity(dayIndex)} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><Plus size={13} /> 첫 일정 추가</button></div>}
                        {day.activities.map((activity, activityIndex) => {
                            const resolved = Number.isFinite(activity.lat) && Number.isFinite(activity.lon);
                            const google = resolved && activity.coordinateProvider === "google";
                            const custom = resolved && activity.coordinateProvider === "custom";
                            const photon = resolved && activity.coordinateProvider === "photon";
                            const nominatim = resolved && ["nominatim", "osm"].includes(activity.coordinateProvider ?? "");
                            const manual = resolved && activity.coordinateProvider === "manual";
                            const coordinateProviderTextClass = custom ? "text-violet-700" : photon ? "text-orange-700" : google ? "text-red-700" : manual ? "text-cyan-700" : nominatim ? "text-emerald-700" : "text-gray-950";
                            const expanded = expandedActivityId === activity.id;
                            const categoryLabel = CATEGORY_OPTIONS.find(([value]) => value === (activity.category ?? "place"))?.[1] ?? activity.category ?? "일반 장소";
                            const timeLabel = TIME_BUCKET_OPTIONS.find(([value]) => value === (activity.timeBucket ?? "unknown"))?.[1] ?? "시간 미지정";
                            const isDraggingThis = draggedPos?.dayIndex === dayIndex && draggedPos?.activityIndex === activityIndex;
                            const isDragOverThis = dragOverPos?.dayIndex === dayIndex && dragOverPos?.activityIndex === activityIndex;
                            const coordinateConflictHere = Boolean(coordinateConflict && resolved
                                && Math.abs(Number(activity.lat) - coordinateConflict.lat) < 0.000001
                                && Math.abs(Number(activity.lon) - coordinateConflict.lon) < 0.000001);

                            return (
                                <article
                                    key={activity.id}
                                    onDragOver={(e) => handleDragOver(e, dayIndex, activityIndex)}
                                    onDrop={(e) => handleDrop(e, dayIndex, activityIndex)}
                                    className={`rounded-lg transition ${coordinateConflictHere ? "my-2 border-2 border-red-500 bg-red-50/60 shadow-sm" : isDraggingThis ? "opacity-40 border border-dashed border-emerald-400 bg-emerald-50" : isDragOverThis ? "border-2 border-emerald-500 bg-emerald-50/80 shadow-md" : expanded ? "my-2 border border-emerald-200 bg-emerald-50/30 shadow-sm" : "hover:bg-gray-50"}`}
                                >
                                    <div className="flex items-start gap-3 px-3 py-3">
                                        <span
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, dayIndex, activityIndex)}
                                            onDragEnd={handleDragEnd}
                                            title="드래그하여 일정 순서 변경"
                                            className="mt-1 flex h-8 w-6 shrink-0 cursor-grab items-center justify-center text-gray-400 hover:text-emerald-600 active:cursor-grabbing"
                                        >
                                            <GripVertical size={16} />
                                        </span>
                                        <div className="flex w-16 shrink-0 flex-col items-center gap-1">
                                            <span className="rounded-md bg-gray-950 px-2 py-1 text-xs font-bold tabular-nums text-white">{activity.time || "--:--"}</span>
                                            <span className="text-[10px] font-semibold text-gray-400">#{activityIndex + 1}</span>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h4 className={`truncate text-sm font-bold ${coordinateProviderTextClass}`}>{activity.location || "장소명 미입력"}</h4>
                                                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">{categoryLabel}</span>
                                                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">{timeLabel}</span>
                                                <span title={custom ? "Custom 데이터셋 좌표" : photon ? "Photon 검색 좌표" : google ? "Google 검색 좌표" : manual ? "관리자 직접 입력 좌표" : nominatim ? "Nominatim 검색 좌표" : "좌표 미확인"} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${custom ? "bg-violet-100 text-violet-700" : photon ? "bg-orange-100 text-orange-700" : google ? "bg-red-50 text-red-700" : manual ? "bg-cyan-50 text-cyan-700" : nominatim ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-700"}`}><MapPin size={10} />{resolved ? custom ? "Custom" : photon ? "Photon" : google ? "Google" : manual ? "직접 지정" : "Nominatim" : "좌표 필요"}</span>
                                                {coordinateConflictHere && <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white"><AlertCircle size={10} />중복 좌표 · Day {dayIndex + 1}</span>}
                                            </div>
                                            <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs leading-5 text-gray-600">{activity.activity || "일정 내용이 없습니다."}</p>
                                            {Number(activity.cost) > 0 && <p className="mt-1 text-[11px] font-bold text-gray-500">경비 {Number(activity.cost).toLocaleString("ko-KR")}{draft.costCurrency === "JPY" ? "엔" : "원"}</p>}
                                        </div>
                                        <div className="flex shrink-0 items-center gap-1">
                                            {draft.days.length > 1 && <label className="relative">
                                                <span className="sr-only">이 일정을 다른 Day로 이동</span>
                                                <select
                                                    aria-label={`${activity.location || "일정"}을 다른 Day로 이동`}
                                                    value={dayIndex}
                                                    onChange={(event) => moveActivityToDay(dayIndex, activityIndex, Number(event.target.value))}
                                                    className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-[11px] font-bold text-gray-600 outline-none hover:border-emerald-600 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                                                    title="다른 Day로 이동"
                                                >
                                                    {draft.days.map((targetDay, targetDayIndex) => <option key={targetDay.id} value={targetDayIndex}>{targetDayIndex === dayIndex ? `Day ${targetDayIndex + 1} (현재)` : `Day ${targetDayIndex + 1}로 이동`}</option>)}
                                                </select>
                                            </label>}
                                            <button type="button" disabled={activityIndex === 0} onClick={() => moveActivity(dayIndex, activityIndex, -1)} title="일정 위로 이동" className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-gray-400 disabled:text-gray-200"><ArrowUp size={13} /></button>
                                            <button type="button" disabled={activityIndex === day.activities.length - 1} onClick={() => moveActivity(dayIndex, activityIndex, 1)} title="일정 아래로 이동" className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-gray-400 disabled:text-gray-200"><ArrowDown size={13} /></button>
                                            <button type="button" onClick={() => setExpandedActivityId(expanded ? null : activity.id)} className={`inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-bold ${expanded ? "bg-gray-950 text-white" : "border border-gray-300 bg-white text-gray-700 hover:border-gray-500"}`}>{expanded ? <X size={13} /> : <Pencil size={13} />}{expanded ? "닫기" : "수정"}</button>
                                        </div>
                                    </div>
                                    {expanded && <div className="border-t border-emerald-100 bg-white px-4 py-4">
                                        <div className="grid gap-4 lg:grid-cols-12">
                                            <label className="text-xs font-bold text-gray-600 lg:col-span-2"><span className="mb-1.5 block">시간</span><input value={activity.time} placeholder="09:30" onChange={(event) => updateActivity(dayIndex, activityIndex, "time", event.target.value)} className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm tabular-nums outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" /></label>
                                            <label className="text-xs font-bold text-gray-600 lg:col-span-5"><span className="mb-1.5 block">장소명</span><input value={activity.location} onChange={(event) => updateActivity(dayIndex, activityIndex, "location", event.target.value)} className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm font-semibold outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" /></label>
                                            <label className="text-xs font-bold text-gray-600 lg:col-span-2"><span className="mb-1.5 block">경비</span><div className="relative"><input type="number" min="0" value={activity.cost ?? 0} onChange={(event) => updateActivity(dayIndex, activityIndex, "cost", Number(event.target.value))} className="h-10 w-full rounded-lg border border-gray-300 px-3 pr-8 text-right text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" /><span className="absolute right-3 top-3 text-xs text-gray-400">{draft.costCurrency === "JPY" ? "엔" : "원"}</span></div></label>
                                            <div className="flex items-end lg:col-span-3"><button type="button" onClick={() => beginEdit(activity)} className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-xs font-bold text-gray-700 hover:border-emerald-600 hover:text-emerald-700"><MapPin size={14} /> 장소 검색·좌표 수정</button></div>
                                            <label className="text-xs font-bold text-gray-600 lg:col-span-3"><span className="mb-1.5 flex items-center justify-between gap-2">시간대 <em className="font-medium not-italic text-emerald-700">시간 입력 시 자동</em></span><select value={activity.timeBucket ?? "unknown"} disabled={inferTimeBucket(activity.time) !== "unknown"} onChange={(event) => updateActivity(dayIndex, activityIndex, "timeBucket", event.target.value)} className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-emerald-600 disabled:bg-gray-100 disabled:text-gray-600">{TIME_BUCKET_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                                            <label className="text-xs font-bold text-gray-600 lg:col-span-3"><span className="mb-1.5 block">카테고리</span><select value={activity.category ?? "place"} onChange={(event) => updateActivity(dayIndex, activityIndex, "category", event.target.value)} className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-emerald-600">{CATEGORY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                                            <label className="text-xs font-bold text-gray-600 lg:col-span-6"><span className="mb-1.5 block">일정 내용</span><textarea value={activity.activity} onChange={(event) => updateActivity(dayIndex, activityIndex, "activity", event.target.value)} rows={3} placeholder="이 장소에서 할 일이나 이동 내용을 입력하세요." className="min-h-24 w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm leading-5 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" /></label>
                                        </div>
                                        {activity.placeSubtitle && <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-gray-50 px-3 py-2 text-[11px] leading-4 text-gray-500"><MapPin size={12} className="mt-0.5 shrink-0" />{activity.placeSubtitle}</p>}
                                        <div className="mt-4 flex justify-end"><button type="button" onClick={() => removeActivity(dayIndex, activityIndex)} className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-bold text-red-600 hover:bg-red-50"><Trash2 size={13} /> 이 일정 삭제</button></div>
                                    </div>}
                                </article>
                            );
                        })}
                    </div>
                </section>
            ))}
            <div className="grid gap-3 sm:grid-cols-2">
                <button
                    type="button"
                    onClick={addDay}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-dashed border-gray-400 bg-white text-sm font-bold text-gray-700 transition hover:border-gray-600 hover:bg-gray-50 shadow-sm"
                >
                    <Plus size={16} className="text-gray-500" />
                    수동으로 새 Day 추가
                </button>
                <button
                    type="button"
                    onClick={() => ocrFileInputRef.current?.click()}
                    disabled={ocrLoading}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-emerald-400 bg-emerald-50 px-4 text-sm font-bold text-emerald-900 transition hover:border-emerald-500 hover:bg-emerald-100 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {ocrLoading ? <LoaderCircle size={16} className="animate-spin text-emerald-700" /> : <FileImage size={16} className="text-emerald-700" />}
                    {ocrLoading ? "새 이미지 OCR 분석 중..." : "📸 이미지 OCR로 새 Day 추가"}
                </button>
                <input
                    ref={ocrFileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => void handleOcrAddDay(e.target.files)}
                />
            </div>
            {dirty && <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-gray-950 px-4 py-3 text-white shadow-xl">
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-400" /><div><p className="text-xs font-bold">저장하지 않은 변경사항이 있습니다.</p><p className="mt-0.5 text-[10px] text-gray-400">저장하면 학습 데이터에도 수정된 내용과 순서가 반영됩니다.</p></div></div>
                <div className="flex items-center gap-2"><button type="button" disabled={savingContent} onClick={resetChanges} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-gray-300 hover:bg-white/10 hover:text-white"><RotateCcw size={13} /> 변경 취소</button><button type="button" disabled={savingContent} onClick={() => void saveAll()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-500 disabled:bg-gray-600">{savingContent ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />} 저장</button></div>
            </div>}
            <PlaceSearchModal
                open={Boolean(editingActivity)}
                onClose={() => setEditingActivity(null)}
                onSelect={chooseResult}
                initialQuery={editingActivity?.location}
                initialLat={editingActivity?.lat}
                initialLon={editingActivity?.lon}
                countryCode="JP"
                tier="FREE"
                paidPlaces={false}
                adminGoogleSearch
                origin={editingOrigin}
                preferNearby
            />
        </div>
    );
}

function mergeJobs(current: IngestJob[], incoming: IngestJob[]) {
    if (current.length === 0) return incoming;
    const incomingById = new Map(incoming.map((item) => [item.jobId, item]));
    const merged = current.map((item) => incomingById.get(item.jobId) ?? item);
    const currentIds = new Set(current.map((item) => item.jobId));
    return [...merged, ...incoming.filter((item) => !currentIds.has(item.jobId))];
}

function formatTime(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function parseDuplicateCoordinate(error?: string): { lat: number; lon: number } | null {
    if (!error) return null;
    const match = error.match(/Duplicate entry ['\"](-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)['\"]/i);
    if (!match) return null;
    const lat = Number(match[1]);
    const lon = Number(match[2]);
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}

function readError(error: unknown, fallback: string) {
    if (typeof error === "object" && error !== null && "response" in error) {
        const response = (error as { response?: { data?: unknown; status?: number } }).response;
        if (typeof response?.data === "string" && response.data.trim()) return response.data;
        if (typeof response?.data === "object" && response.data && "error" in response.data) return String(response.data.error);
        if (response?.status) return `${fallback} (HTTP ${response.status})`;
    }
    return fallback;
}
