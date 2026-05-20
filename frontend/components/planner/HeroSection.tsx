"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import TravelCheckList, { ChecklistItem } from "@/components/planner/TravelCheckList";
import TravelItinerary, { ItineraryDay, SelectedCostCell } from "@/components/planner/TravelItinerary";
import ParticipantsSidebar, { Participant } from "@/components/planner/ParticipantsSidebar";
import MapRoutePanel from "@/components/planner/MapRoutePanel";
import { Calculator, CalendarDays, Route, X } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import {
    createEmptyTravelPlan,
    loadTravelPlan,
    saveTravelPlanBeforeUnload,
    saveTravelPlan,
    travelPlanNodeLimit,
    type TravelPlanDraft,
} from "@/lib/travelPlans";

type RealtimeMessage = {
    type: "PLAN_UPDATED";
    clientId: string;
    plan: TravelPlanDraft;
    editorName?: string;
    editorEmail?: string;
    updatedAt?: string;
};

export default function HeroSection({ createId }: { createId?: string }) {
    const { me, isLoggedIn, fetchMe } = useAuthStore();
    const planId = createId ?? "default";
    const clientIdRef = useRef<string>(crypto.randomUUID());
    const socketRef = useRef<WebSocket | null>(null);
    const applyingRemoteRef = useRef(false);
    const pendingBroadcastRef = useRef(false);
    const draftRef = useRef<TravelPlanDraft | null>(null);
    const dirtyRef = useRef(false);
    const editorRef = useRef({ name: "사용자", email: "" });
    const [syncStatus, setSyncStatus] = useState("오프라인 저장");
    const [initialPlan, setInitialPlan] = useState<TravelPlanDraft>(() => createEmptyTravelPlan(planId));
    const [planLoading, setPlanLoading] = useState(true);
    const [title, setTitle] = useState(initialPlan.title);
    const [checklist, setChecklist] = useState<ChecklistItem[]>(initialPlan.checklist);
    const [participants, setParticipants] = useState<Participant[]>(initialPlan.participants);
    const [days, setDays] = useState<ItineraryDay[]>(initialPlan.days);
    const [selectedCostCells, setSelectedCostCells] = useState<SelectedCostCell[]>([]);
    const [routeModalOpen, setRouteModalOpen] = useState(false);
    const [routeDayId, setRouteDayId] = useState(initialPlan.days[0]?.id ?? "");
    const [lastSavedAt, setLastSavedAt] = useState(initialPlan.updatedAt);
    const [lastEditorName, setLastEditorName] = useState("사용자");
    const [lastEditorEmail, setLastEditorEmail] = useState("");

    useEffect(() => {
        void fetchMe();
    }, [fetchMe]);

    useEffect(() => {
        let cancelled = false;
        setPlanLoading(true);
        loadTravelPlan(planId)
            .then((loaded) => {
                if (cancelled) return;
                const next = loaded ?? createEmptyTravelPlan(planId);
                setInitialPlan(next);
                setTitle(next.title);
                setChecklist(next.checklist);
                setParticipants(next.participants);
                setDays(next.days);
                setRouteDayId(next.days[0]?.id ?? "");
                setLastSavedAt(next.updatedAt);
                dirtyRef.current = !loaded;
                if (!loaded) void saveTravelPlan(next);
            })
            .finally(() => {
                if (!cancelled) setPlanLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [planId]);

    const currentEditorName = me?.nickname || me?.email?.split("@")[0] || "사용자";
    const currentEditorEmail = me?.email ?? "";
    const allowedEmailSet = useMemo(() => {
        return new Set(
            participants
                .map((participant) => participant.email?.trim().toLowerCase())
                .filter((email): email is string => Boolean(email)),
        );
    }, [participants]);
    const isAccessRestricted = allowedEmailSet.size > 0;
    const isAllowedParticipant = !isAccessRestricted
        || Boolean(currentEditorEmail && allowedEmailSet.has(currentEditorEmail.toLowerCase()));
    const accessStatusReady = isLoggedIn !== null;
    const selectedRouteDayId = routeDayId && days.some((day) => day.id === routeDayId)
        ? routeDayId
        : days[0]?.id ?? "";

    useEffect(() => {
        if (!me?.email || participants.length > 0) return;
        const timer = window.setTimeout(() => {
            setParticipants([{
                id: me.id,
                name: me.nickname || me.email.split("@")[0] || me.email,
                email: me.email,
                role: "OWNER",
            }]);
        }, 0);
        return () => window.clearTimeout(timer);
    }, [me, participants.length]);

    useEffect(() => {
        if (!me?.email || participants.length === 0 || participants.some((participant) => participant.role === "OWNER")) return;
        const timer = window.setTimeout(() => {
            setParticipants((prev) =>
                prev.map((participant, index) => {
                    const currentUserIndex = prev.findIndex((item) =>
                        item.email?.trim().toLowerCase() === me.email.trim().toLowerCase()
                    );
                    const ownerIndex = currentUserIndex >= 0 ? currentUserIndex : 0;
                    return index === ownerIndex
                    ? {
                        ...participant,
                        name: participant.name || me.nickname || me.email.split("@")[0] || me.email,
                        email: participant.email || me.email,
                        role: "OWNER",
                    }
                    : participant;
                })
            );
        }, 0);
        return () => window.clearTimeout(timer);
    }, [me, participants]);

    const draft = useMemo<TravelPlanDraft>(() => ({
        id: planId,
        title,
        template: initialPlan.template ?? "basic",
        tier: initialPlan.tier ?? "FREE",
        checklist,
        participants,
        days,
        createdAt: initialPlan.createdAt,
        updatedAt: new Date().toISOString(),
    }), [checklist, days, initialPlan.createdAt, initialPlan.template, initialPlan.tier, participants, planId, title]);

    useEffect(() => {
        draftRef.current = draft;
        editorRef.current = { name: currentEditorName, email: currentEditorEmail };
        dirtyRef.current = true;
    }, [currentEditorEmail, currentEditorName, draft]);

    useEffect(() => {
        let closedByCleanup = false;
        let attempt = 0;
        const urls = realtimeUrls(planId);

        const connect = () => {
            const socket = new WebSocket(urls[attempt]);
            socketRef.current = socket;

            socket.onopen = () => {
                setSyncStatus("실시간 연결됨");
                if (!pendingBroadcastRef.current) return;
                const currentDraft = draftRef.current;
                if (!currentDraft) return;
                const saved = { ...currentDraft, updatedAt: new Date().toISOString() };
                const editor = editorRef.current;
                socket.send(JSON.stringify({
                    type: "PLAN_UPDATED",
                    clientId: clientIdRef.current,
                    plan: saved,
                    editorName: editor.name,
                    editorEmail: editor.email,
                    updatedAt: saved.updatedAt,
                } satisfies RealtimeMessage));
                pendingBroadcastRef.current = false;
            };
            socket.onclose = () => {
                if (closedByCleanup) return;
                if (attempt + 1 < urls.length) {
                    attempt += 1;
                    connect();
                    return;
                }
                setSyncStatus("오프라인 저장");
            };
            socket.onerror = () => {
                if (attempt + 1 >= urls.length) setSyncStatus("실시간 연결 오류");
                socket.close();
            };
            socket.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data) as RealtimeMessage;
                    if (message.type !== "PLAN_UPDATED" || message.clientId === clientIdRef.current) return;

                    applyingRemoteRef.current = true;
                    setTitle(message.plan.title);
                    setChecklist(message.plan.checklist);
                    setParticipants(message.plan.participants);
                    setDays(message.plan.days);
                    void saveTravelPlan(message.plan);
                    setLastSavedAt(message.plan.updatedAt);
                    setLastEditorName(message.editorName || message.editorEmail || "다른 사용자");
                    setLastEditorEmail(message.editorEmail ?? "");
                    setSyncStatus(`${message.editorName || "다른 사용자"} 수정 반영됨`);
                    window.setTimeout(() => {
                        applyingRemoteRef.current = false;
                    }, 0);
                } catch {
                    setSyncStatus("실시간 메시지 처리 실패");
                }
            };
        };

        connect();

        return () => {
            closedByCleanup = true;
            socketRef.current?.close();
        };
    }, [planId]);

    const saveCurrentPlan = useCallback(async (broadcast = true, planOverride?: TravelPlanDraft) => {
        const source = planOverride ?? draft;
        const saved = { ...source, updatedAt: new Date().toISOString() };
        const persisted = await saveTravelPlan(saved);
        dirtyRef.current = false;
        setInitialPlan(persisted);
        setLastSavedAt(persisted.updatedAt);
        setLastEditorName(currentEditorName);
        setLastEditorEmail(currentEditorEmail);

        if (!broadcast) return;

        if (socketRef.current?.readyState === WebSocket.OPEN) {
            const message: RealtimeMessage = {
                type: "PLAN_UPDATED",
                clientId: clientIdRef.current,
                plan: saved,
                editorName: currentEditorName,
                editorEmail: currentEditorEmail,
                updatedAt: saved.updatedAt,
            };
            socketRef.current.send(JSON.stringify(message));
            setSyncStatus("실시간 동기화됨");
            pendingBroadcastRef.current = false;
            return;
        }

        pendingBroadcastRef.current = true;
        setSyncStatus("실시간 연결 대기중");
    }, [currentEditorEmail, currentEditorName, draft]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            if (!dirtyRef.current || applyingRemoteRef.current) return;
            void saveCurrentPlan(false);
        }, 10 * 60 * 1000);
        return () => window.clearInterval(timer);
    }, [saveCurrentPlan]);

    useEffect(() => {
        const flush = () => {
            if (!dirtyRef.current) return;
            const currentDraft = draftRef.current;
            if (currentDraft && saveTravelPlanBeforeUnload(currentDraft)) {
                dirtyRef.current = false;
                return;
            }
            void saveCurrentPlan(false);
        };
        const handleVisibilityChange = () => {
            if (document.visibilityState === "hidden") flush();
        };
        window.addEventListener("pagehide", flush);
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            window.removeEventListener("pagehide", flush);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [saveCurrentPlan]);

    const commitRealtimeSync = useCallback((planOverride?: TravelPlanDraft) => {
        window.setTimeout(() => void saveCurrentPlan(true, planOverride), 0);
    }, [saveCurrentPlan]);

    const applyOptimizedRoute = useCallback((dayId: string, orderedActivityIds: string[]) => {
        const uniqueOrder = Array.from(new Set(orderedActivityIds));
        if (uniqueOrder.length === 0) return;

        const currentDraft = draftRef.current ?? draft;
        const nextDays = currentDraft.days.map((day) => {
            if (day.id !== dayId) return day;
            if (currentDraft.template === "spreadsheet") {
                return applySpreadsheetOptimizedRoute(day, uniqueOrder);
            }
            const orderIndex = new Map(uniqueOrder.map((id, index) => [id, index]));
            const activities = [...day.activities].sort((left, right) => {
                const leftIndex = orderIndex.get(left.id);
                const rightIndex = orderIndex.get(right.id);
                if (leftIndex == null && rightIndex == null) return 0;
                if (leftIndex == null) return 1;
                if (rightIndex == null) return -1;
                return leftIndex - rightIndex;
            });
            return { ...day, activities };
        });

        const nextDraft = { ...currentDraft, days: nextDays, updatedAt: new Date().toISOString() };
        draftRef.current = nextDraft;
        setDays(nextDays);
        setRouteModalOpen(false);
        commitRealtimeSync(nextDraft);
    }, [commitRealtimeSync, draft]);

    const handleCommitKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== "Enter") return;
        const target = event.target;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
            commitRealtimeSync();
        }
    };

    const handleCommitClick = (event: MouseEvent<HTMLDivElement>) => {
        const target = event.target;
        if (target instanceof Element && target.closest("button")) {
            commitRealtimeSync();
        }
    };

    const inviteUrl = typeof window === "undefined"
        ? ""
        : `${window.location.origin}/createplan/${planId}`;
    const editorTooltip = lastEditorEmail
        ? `마지막 수정자: ${lastEditorName} (${lastEditorEmail})`
        : `마지막 수정자: ${lastEditorName}`;

    if (!accessStatusReady || planLoading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <div className="container mx-auto px-4 py-16">
                    <div className="rounded-xl border border-gray-200 bg-white p-8 text-gray-700 shadow-sm">
                        초대 권한을 확인하는 중입니다.
                    </div>
                </div>
            </div>
        );
    }

    if (isAccessRestricted && !isAllowedParticipant) {
        return (
            <div className="min-h-screen bg-gray-50">
                <div className="container mx-auto px-4 py-16">
                    <div className="max-w-xl rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
                        <h1 className="font-[var(--font-paperlogy)] text-2xl font-semibold text-gray-950">
                            초대된 사용자만 접근할 수 있습니다.
                        </h1>
                        <p className="mt-3 text-sm leading-6 text-gray-600">
                            이 여행 계획은 참여자 이메일 목록에 등록된 계정만 열 수 있습니다.
                            현재 로그인한 이메일이 초대 목록에 있는지 확인해주세요.
                        </p>
                        <div className="mt-5 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
                            현재 계정: {currentEditorEmail || "로그인 정보 없음"}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className="min-h-screen bg-gray-50"
            onBlurCapture={() => commitRealtimeSync()}
            onKeyDownCapture={handleCommitKeyDown}
            onClickCapture={handleCommitClick}
        >
            <div className="container mx-auto px-3 py-6 sm:px-4 sm:py-8">
                <div className="mb-10 flex flex-col gap-2">
                    <h1 className="font-[var(--font-paperlogy)] text-2xl font-normal leading-[1.05] text-black sm:text-[32px]">
                        여행 일정표
                    </h1>
                    <p className="text-sm text-gray-500">
                        계획 ID: {planId}
                    </p>
                    <p className="text-xs text-gray-400" title={editorTooltip}>
                        {syncStatus} · 마지막 저장 {new Date(lastSavedAt).toLocaleString("ko-KR")} · {lastEditorName} 수정
                    </p>
                </div>

                <div className="flex flex-col items-stretch gap-6 lg:flex-row lg:items-start">
                    <div className="min-w-0 flex-1 space-y-8">
                        <TravelCheckList checklist={checklist} setChecklist={setChecklist} />
                        <TravelItinerary
                            title={title}
                            setTitle={setTitle}
                            days={days}
                            setDays={setDays}
                            template={draft.template}
                            tier={draft.tier}
                            planId={planId}
                            onCostSelectionChange={setSelectedCostCells}
                        />
                    </div>

                    <div className="w-full shrink-0 lg:w-80 xl:w-96">
                        <ParticipantsSidebar
                            planId={planId}
                            inviteUrl={inviteUrl}
                            participants={participants}
                            setParticipants={setParticipants}
                            onSave={() => saveCurrentPlan(true)}
                            currentUserEmail={currentEditorEmail}
                            currentUserName={currentEditorName}
                            routeCalculator={
                                <div className="space-y-3">
                                    <RouteCalculatorLauncher
                                        days={days}
                                        selectedDayId={selectedRouteDayId}
                                        onSelectDay={setRouteDayId}
                                        onOpen={() => setRouteModalOpen(true)}
                                    />
                                    {draft.template === "spreadsheet" && (
                                        <SpreadsheetCostCalculator selectedCells={selectedCostCells} />
                                    )}
                                </div>
                            }
                        />
                    </div>
                </div>
            </div>

            {routeModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-0 sm:px-4 sm:py-6">
                    <div className="flex h-full max-h-none w-full max-w-none flex-col overflow-hidden rounded-none bg-white shadow-2xl sm:max-h-[92vh] sm:max-w-7xl sm:rounded-2xl">
                        <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 sm:px-5 sm:py-4">
                            <div>
                                <h2 className="text-xl font-bold text-gray-950">최적 경로 찾기</h2>
                                <p className="mt-1 text-sm text-gray-500">선택한 Day의 경로를 계산하고 여행 계획에 반영할 수 있습니다.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setRouteModalOpen(false)}
                                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-950"
                                aria-label="경로 계산기 닫기"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="min-h-0 overflow-auto">
                            <MapRoutePanel
                                days={days}
                                maxNodes={travelPlanNodeLimit(draft)}
                                initialSelectedDayId={selectedRouteDayId}
                                paidMaps={draft.tier === "PAID"}
                                planId={planId}
                                forcedOpen
                                onApplyOptimizedRoute={applyOptimizedRoute}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function applySpreadsheetOptimizedRoute(day: ItineraryDay, orderedActivityIds: string[]): ItineraryDay {
    const byId = new Map(day.activities.map((activity) => [activity.id, activity]));
    const orderedSources = orderedActivityIds
        .map((id) => byId.get(id))
        .filter((activity): activity is ItineraryDay["activities"][number] => Boolean(activity));
    if (orderedSources.length === 0) return day;

    const targetSlots = day.activities
        .filter((activity) => byId.has(activity.id) && orderedActivityIds.includes(activity.id))
        .sort((left, right) => spreadsheetRouteSlotOrder(left.time) - spreadsheetRouteSlotOrder(right.time));

    const sourceByTargetId = new Map(
        targetSlots.map((slot, index) => [slot.id, orderedSources[index]] as const)
    );

    return {
        ...day,
        activities: day.activities.map((activity) => {
            const source = sourceByTargetId.get(activity.id);
            if (!source) return activity;
            return {
                ...activity,
                location: source.location,
                activity: source.activity,
                cost: source.cost,
                placeId: source.placeId,
                placeSubtitle: source.placeSubtitle,
                lat: source.lat,
                lon: source.lon,
                routeRole: activity.routeRole === "LODGING" ? "LODGING" : source.routeRole === "LODGING" ? "NONE" : source.routeRole,
            };
        }),
    };
}

function spreadsheetRouteSlotOrder(rowKey: string) {
    if (rowKey === "__lodging__") return -1;
    if (/^\d{2}:\d{2}$/.test(rowKey)) {
        const [hour, minute] = rowKey.split(":").map(Number);
        return hour * 60 + minute;
    }
    return Number.MAX_SAFE_INTEGER;
}

function RouteCalculatorLauncher({
    days,
    selectedDayId,
    onSelectDay,
    onOpen,
}: {
    days: ItineraryDay[];
    selectedDayId: string;
    onSelectDay: (dayId: string) => void;
    onOpen: () => void;
}) {
    return (
        <div className="space-y-3 border-t-2 border-gray-200 bg-white p-4 sm:p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-950">
                <Route className="h-4 w-4" />
                경로 계산기
            </div>
            <label className="block text-xs font-semibold text-gray-500" htmlFor="route-day-select">
                일정 선택하기
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2">
                <CalendarDays className="h-4 w-4 flex-shrink-0 text-gray-500" />
                <select
                    id="route-day-select"
                    value={selectedDayId}
                    onChange={(event) => onSelectDay(event.target.value)}
                    disabled={days.length === 0}
                    className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-gray-900 focus:outline-none disabled:text-gray-400"
                >
                    {days.length === 0 ? (
                        <option value="">Day 없음</option>
                    ) : (
                        days.map((day) => (
                            <option key={day.id} value={day.id}>{day.dayTitle}</option>
                        ))
                    )}
                </select>
            </div>
            <button
                type="button"
                onClick={onOpen}
                disabled={days.length === 0}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gray-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-300"
            >
                <Route className="h-4 w-4" />
                최적 경로 찾기
            </button>
        </div>
    );
}

function SpreadsheetCostCalculator({
    selectedCells,
}: {
    selectedCells: SelectedCostCell[];
}) {
    const [calculatedTotal, setCalculatedTotal] = useState(0);
    const [notice, setNotice] = useState("");

    const selectedTotal = useMemo(() => {
        return selectedCells.reduce((sum, cell) => sum + cell.amount, 0);
    }, [selectedCells]);

    return (
        <div className="space-y-3 rounded-xl border-2 border-emerald-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-bold text-gray-950">
                    <Calculator className="h-4 w-4" />
                    비용 계산기
                </div>
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
                    {selectedCells.length}개 선택
                </span>
            </div>

            <p className="rounded-lg bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
                엑셀형 템플릿의 초록색 셀을 클릭, Ctrl/Command 클릭, 드래그로 선택한 뒤 계산하세요.
            </p>

            <div className="rounded-lg bg-gray-50 p-3">
                <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>선택 셀 {selectedCells.length}개</span>
                    <span>미리보기 {selectedTotal.toLocaleString()}원</span>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        if (selectedCells.length === 0) {
                            setNotice("셀을 선택해주세요.");
                            return;
                        }
                        setNotice("");
                        setCalculatedTotal(selectedTotal);
                    }}
                    className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-gray-950 px-3 py-2 text-sm font-bold text-white transition hover:bg-black"
                >
                    비용 계산
                </button>
                {notice && (
                    <p className="mt-2 text-sm font-semibold text-red-600">{notice}</p>
                )}
                <div className="mt-3 text-right text-lg font-black text-gray-950">
                    {calculatedTotal.toLocaleString()}원
                </div>
            </div>
        </div>
    );
}

function realtimeUrls(planId: string) {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const host = window.location.hostname;
    const encodedPlanId = encodeURIComponent(planId);
    const urls = [`${protocol}://${window.location.host}/ws/plans/${encodedPlanId}`];
    if ((host === "localhost" || host === "127.0.0.1") && window.location.port !== "8080") {
        urls.push(`${protocol}://${host}:8080/ws/plans/${encodedPlanId}`);
    }
    return Array.from(new Set(urls));
}
