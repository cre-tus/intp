"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TravelCheckList, { ChecklistItem } from "@/components/planner/TravelCheckList";
import TravelItinerary, { ItineraryDay } from "@/components/planner/TravelItinerary";
import ParticipantsSidebar, { Participant } from "@/components/planner/ParticipantsSidebar";
import { useAuthStore } from "@/stores/authStore";
import {
    createEmptyTravelPlan,
    loadTravelPlan,
    saveTravelPlan,
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
    const editorRef = useRef({ name: "사용자", email: "" });
    const [syncStatus, setSyncStatus] = useState("오프라인 저장");
    const [initialPlan] = useState<TravelPlanDraft>(() => {
        const loaded = loadTravelPlan(planId) ?? createEmptyTravelPlan(planId);
        saveTravelPlan(loaded);
        return loaded;
    });
    const [title, setTitle] = useState(initialPlan.title);
    const [checklist, setChecklist] = useState<ChecklistItem[]>(initialPlan.checklist);
    const [participants, setParticipants] = useState<Participant[]>(initialPlan.participants);
    const [days, setDays] = useState<ItineraryDay[]>(initialPlan.days);
    const [lastSavedAt, setLastSavedAt] = useState(initialPlan.updatedAt);
    const [lastEditorName, setLastEditorName] = useState("사용자");
    const [lastEditorEmail, setLastEditorEmail] = useState("");

    useEffect(() => {
        void fetchMe();
    }, [fetchMe]);

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

    const draft = useMemo<TravelPlanDraft>(() => ({
        id: planId,
        title,
        template: "basic",
        checklist,
        participants,
        days,
        createdAt: initialPlan.createdAt,
        updatedAt: new Date().toISOString(),
    }), [checklist, days, initialPlan.createdAt, participants, planId, title]);

    useEffect(() => {
        draftRef.current = draft;
        editorRef.current = { name: currentEditorName, email: currentEditorEmail };
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
                    saveTravelPlan(message.plan);
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

    const saveCurrentPlan = useCallback((broadcast = true) => {
        const saved = { ...draft, updatedAt: new Date().toISOString() };
        saveTravelPlan(saved);
        setLastSavedAt(saved.updatedAt);
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
        if (applyingRemoteRef.current) return;
        const timer = window.setTimeout(() => saveCurrentPlan(true), 300);
        return () => window.clearTimeout(timer);
    }, [saveCurrentPlan]);

    const inviteUrl = typeof window === "undefined"
        ? ""
        : `${window.location.origin}/createplan/${planId}`;
    const editorTooltip = lastEditorEmail
        ? `마지막 수정자: ${lastEditorName} (${lastEditorEmail})`
        : `마지막 수정자: ${lastEditorName}`;

    if (!accessStatusReady) {
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
        <div className="min-h-screen bg-gray-50">
            <div className="container mx-auto px-4 py-8">
                <div className="mb-10 flex flex-col gap-2">
                    <h1 className="font-[var(--font-paperlogy)] text-[32px] font-normal leading-[1.05] text-black">
                        여행 일정표
                    </h1>
                    <p className="text-sm text-gray-500">
                        계획 ID: {planId}
                    </p>
                    <p className="text-xs text-gray-400" title={editorTooltip}>
                        {syncStatus} · 마지막 저장 {new Date(lastSavedAt).toLocaleString("ko-KR")} · {lastEditorName} 수정
                    </p>
                </div>

                <div className="flex items-start gap-6">
                    <div className="flex-1 space-y-8">
                        <TravelCheckList checklist={checklist} setChecklist={setChecklist} />
                        <TravelItinerary
                            title={title}
                            setTitle={setTitle}
                            days={days}
                            setDays={setDays}
                        />
                    </div>

                    <div className="w-80 shrink-0">
                        <ParticipantsSidebar
                            planId={planId}
                            inviteUrl={inviteUrl}
                            participants={participants}
                            setParticipants={setParticipants}
                            onSave={() => saveCurrentPlan(true)}
                        />
                    </div>
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
