"use client";

import React, { useState } from "react";
import type { ReactNode } from "react";
import { Copy, Crown, Plus, Trash2, UserCog, Users } from "lucide-react";
import { SaveSection } from "@/components/planner/SaveSection";
import ExchangeRateWidget from "@/components/planner/ExchangeRateWidget";
import type { CurrencyRate } from "@/lib/currency";
import type { TravelCountryCode } from "@/lib/travelPlans";
import { api } from "@/service/api";

export interface Participant {
    id: number;
    name: string;
    email?: string;
    role?: "OWNER" | "EDITOR" | "VIEWER";
}

const editableRoles = [
    { value: "EDITOR", label: "편집자" },
    { value: "VIEWER", label: "조회자" },
] satisfies { value: NonNullable<Participant["role"]>; label: string }[];

type TravelPlanRoleResponse = {
    content?: {
        participants?: Participant[];
    };
};

const TEAM_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#f97316", "#14b8a6", "#f59e0b", "#06b6d4"];
const countryOptions = [
    { value: "KR", label: "대한민국" },
    { value: "JP", label: "일본" },
] satisfies { value: TravelCountryCode; label: string }[];

interface ParticipantsSidebarProps {
    participants: Participant[];
    setParticipants: React.Dispatch<React.SetStateAction<Participant[]>>;
    planId?: string;
    inviteUrl?: string;
    onSave?: () => void;
    routeCalculator?: ReactNode;
    costCalculator?: ReactNode;
    selectedCurrency: CurrencyRate;
    onCurrencyChange: (currency: CurrencyRate) => void;
    countryCode: TravelCountryCode;
    onCountryCodeChange: (countryCode: TravelCountryCode) => void;
    currentUserEmail?: string;
    onParticipantsSynced?: (participants: Participant[]) => void;
}

export default function ParticipantsSidebar({
    participants,
    setParticipants,
    planId,
    inviteUrl,
    onSave,
    routeCalculator,
    costCalculator,
    selectedCurrency,
    onCurrencyChange,
    countryCode,
    onCountryCodeChange,
    currentUserEmail,
    onParticipantsSynced,
}: ParticipantsSidebarProps) {
    const [newParticipantEmail, setNewParticipantEmail] = useState("");
    const [notice, setNotice] = useState("");
    const owner = participants.find((participant) => participant.role === "OWNER") ?? participants[0];
    const isOwner = Boolean(
        owner
        && currentUserEmail
        && owner.email?.trim().toLowerCase() === currentUserEmail.trim().toLowerCase()
    );

    const addParticipant = async () => {
        const email = newParticipantEmail.trim();
        if (!isOwner) {
            setNotice("오너만 참여자를 관리할 수 있습니다.");
            return;
        }
        if (!email) return;

        const res = await fetch(`/api/users/by-email?email=${encodeURIComponent(email)}`);
        if (!res.ok) {
            setNotice("가입된 사용자 이메일만 참여자로 추가할 수 있습니다.");
            return;
        }
        const user = await res.json() as { id: number; email: string; nickname: string };

        const participant: Participant = {
            id: user.id,
            name: user.nickname,
            email: user.email,
            role: "EDITOR",
        };
        setParticipants((prev) => [...prev.filter((item) => item.email !== user.email), participant]);
        window.setTimeout(() => onSave?.(), 0);
        setNewParticipantEmail("");
        setNotice(`${user.nickname}님을 참여자로 추가했습니다.`);
    };

    const removeParticipant = (id: number) => {
        if (!isOwner) {
            setNotice("오너만 참여자를 삭제할 수 있습니다.");
            return;
        }
        const target = participants.find((participant) => participant.id === id);
        if (target?.role === "OWNER") {
            setNotice("오너는 다른 참여자에게 오너를 넘긴 뒤 삭제할 수 있습니다.");
            return;
        }
        setParticipants((prev) => prev.filter((participant) => participant.id !== id));
        window.setTimeout(() => onSave?.(), 0);
    };

    const updateParticipantRole = async (id: number, role: "EDITOR" | "VIEWER") => {
        if (!isOwner) {
            setNotice("오너만 참여자 권한을 변경할 수 있습니다.");
            return;
        }
        const target = participants.find((participant) => participant.id === id);
        if (!target || target.role === "OWNER") return;
        if (planId) {
            try {
                const response = await api.put<TravelPlanRoleResponse>(
                    `/api/travel-plans/${encodeURIComponent(planId)}/participants/${id}/role`,
                    { role },
                );
                if (response.data.content?.participants) {
                    if (onParticipantsSynced) onParticipantsSynced(response.data.content.participants);
                    else setParticipants(response.data.content.participants);
                    setNotice(`${target.name}님의 권한을 ${role === "EDITOR" ? "편집자" : "조회자"}로 변경했습니다.`);
                    return;
                }
            } catch (error) {
                setNotice(apiErrorMessage(error, "참여자 권한 변경 저장에 실패했습니다."));
                return;
            }
        }
        setParticipants((prev) =>
            prev.map((participant) =>
                participant.id === id ? { ...participant, role } : participant
            )
        );
        setNotice(`${target.name}님의 권한을 ${role === "EDITOR" ? "편집자" : "조회자"}로 변경했습니다.`);
    };

    const transferOwner = async (id: number) => {
        if (!isOwner) {
            setNotice("오너만 오너 권한을 넘길 수 있습니다.");
            return;
        }
        const target = participants.find((participant) => participant.id === id);
        if (!target || target.role === "OWNER") return;
        if (!window.confirm(`${target.name}님에게 오너 권한을 넘길까요?`)) return;
        if (planId) {
            try {
                const response = await api.post<TravelPlanRoleResponse>(
                    `/api/travel-plans/${encodeURIComponent(planId)}/owner`,
                    { userId: id },
                );
                if (response.data.content?.participants) {
                    if (onParticipantsSynced) onParticipantsSynced(response.data.content.participants);
                    else setParticipants(response.data.content.participants);
                    setNotice(`${target.name}님에게 오너 권한을 넘겼습니다.`);
                    return;
                }
            } catch (error) {
                setNotice(apiErrorMessage(error, "오너 권한 넘기기 저장에 실패했습니다."));
                return;
            }
        }
        setParticipants((prev) =>
            prev.map((participant) => {
                if (participant.id === id) return { ...participant, role: "OWNER" };
                if (participant.role === "OWNER") return { ...participant, role: "EDITOR" };
                return participant;
            })
        );
        setNotice(`${target.name}님에게 오너 권한을 넘겼습니다.`);
    };

    const copyInviteLink = async () => {
        if (!inviteUrl) return;
        await navigator.clipboard.writeText(inviteUrl);
        setNotice("초대 링크를 복사했습니다.");
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") void addParticipant();
    };

    return (
        <div className="rounded-xl border border-gray-200 bg-white shadow-lg lg:flex lg:h-full lg:flex-col lg:overflow-hidden">
            <div className="sticky top-0 z-20 overflow-hidden bg-gradient-to-r from-black via-gray-900 to-black px-5 py-4 shadow-sm">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                <div className="relative z-10 flex items-center gap-2">
                    <Users className="h-5 w-5 text-white" />
                    <h3 className="text-lg font-bold tracking-tight text-white">여행 계획 메뉴</h3>
                </div>
            </div>

            <div className="min-h-0 space-y-3 overflow-y-visible overflow-x-hidden p-3 sm:p-4 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain">
                <SidebarSection title="기본" description="국가, 초대 링크" defaultOpen>
                    <div className="rounded-lg border border-gray-200 bg-white p-3">
                        <label className="block text-xs font-semibold text-gray-500" htmlFor="travel-country-select">
                            여행 국가
                        </label>
                        <select
                            id="travel-country-select"
                            value={countryCode}
                            onChange={(event) => onCountryCodeChange(event.target.value as TravelCountryCode)}
                            className="mt-2 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                        >
                            {countryOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <div className="text-xs font-semibold text-gray-500">초대 링크</div>
                        <div className="mt-1 truncate text-xs text-gray-700">{inviteUrl || planId || "계획 생성 후 사용 가능"}</div>
                        <div className="mt-1 text-xs text-gray-500">참여자 이메일 목록에 있는 계정만 접근 가능</div>
                        <button
                            type="button"
                            onClick={() => void copyInviteLink()}
                            disabled={!inviteUrl}
                            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900 disabled:cursor-not-allowed disabled:text-gray-300"
                        >
                            <Copy className="h-4 w-4" />
                            링크 복사
                        </button>
                    </div>
                </SidebarSection>

                <SidebarSection title="참여자" description={`${participants.length}명`} defaultOpen>
                    <div className="space-y-2">
                        <div className="grid gap-2 sm:flex sm:items-center">
                            <input
                                type="email"
                                value={newParticipantEmail}
                                onChange={(event) => setNewParticipantEmail(event.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={!isOwner}
                                placeholder="참여자 이메일"
                                className="min-w-0 flex-1 rounded-lg border-2 border-gray-300 px-3 py-2 transition-all focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-100"
                            />
                            <button
                                type="button"
                                onClick={() => void addParticipant()}
                                disabled={!isOwner}
                                aria-label="참여자 추가"
                                className="shrink-0 rounded-lg bg-gradient-to-br from-gray-900 to-gray-700 p-2 text-white shadow-sm transition-all hover:scale-105 hover:from-black hover:to-gray-800 hover:shadow-md disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-300"
                            >
                                <Plus className="h-5 w-5" />
                            </button>
                        </div>
                        <p className="text-xs text-gray-500">가입된 이메일만 참여자로 추가할 수 있습니다.</p>
                    </div>

                    {notice && <p className="text-sm text-gray-600">{notice}</p>}

                    <div className="space-y-2">
                        {participants.length === 0 ? (
                            <div className="py-8 text-center text-gray-400">
                                <Users className="mx-auto mb-2 h-12 w-12 opacity-30" />
                                <p className="text-sm">참여자를 추가해주세요</p>
                            </div>
                        ) : (
                            participants.map((participant, index) => (
                                <div
                                    key={participant.id}
                                    className="group flex min-w-0 items-center gap-3 rounded-lg border border-gray-200 bg-gradient-to-r from-gray-50 to-white p-3 transition-all hover:border-gray-900 hover:shadow-md"
                                >
                                    <div
                                        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm"
                                        style={{ backgroundColor: participantColor(participant) }}
                                        title="참여자 색상"
                                    >
                                        {index + 1}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1 truncate text-sm font-semibold text-gray-950">
                                            {participant.role === "OWNER" && <Crown className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />}
                                            <span className="truncate">{participant.name}</span>
                                        </div>
                                        <div className="truncate text-xs text-gray-500">
                                            {participant.email ?? "local"}
                                        </div>
                                    </div>

                                    {participant.role !== "OWNER" && (
                                        <select
                                            value={participant.role ?? "EDITOR"}
                                            onChange={(event) =>
                                                void updateParticipantRole(participant.id, event.target.value as "EDITOR" | "VIEWER")
                                            }
                                            disabled={!isOwner}
                                            className="h-8 shrink-0 rounded-lg border border-gray-300 bg-white px-2 text-xs font-semibold text-gray-700 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                                            title="참여자 권한"
                                        >
                                            {editableRoles.map((role) => (
                                                <option key={role.value} value={role.value}>
                                                    {role.label}
                                                </option>
                                            ))}
                                        </select>
                                    )}

                                    {participant.role !== "OWNER" && isOwner && (
                                        <button
                                            type="button"
                                            onClick={() => void transferOwner(participant.id)}
                                            className="shrink-0 rounded-lg p-1.5 transition-all hover:scale-110 hover:bg-amber-50 sm:opacity-0 sm:group-hover:opacity-100"
                                            title="오너 넘기기"
                                        >
                                            <UserCog className="h-4 w-4 text-amber-600" />
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => removeParticipant(participant.id)}
                                        disabled={!isOwner || participant.role === "OWNER"}
                                        className="shrink-0 rounded-lg p-1.5 transition-all hover:scale-110 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-20 sm:opacity-0 sm:group-hover:opacity-100"
                                        title={participant.role === "OWNER" ? "오너는 권한을 넘긴 후 삭제할 수 있습니다." : "참여자 삭제"}
                                    >
                                        <Trash2 className="h-4 w-4 text-red-600" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </SidebarSection>

                <SidebarSection title="저장" description="계획 저장">
                    <SaveSection
                        defaultUserName={participants.length > 0 ? participants[0].name : "사용자"}
                        onSave={onSave}
                    />
                </SidebarSection>

                {routeCalculator && (
                    <SidebarSection title="경로" description="최적 경로">
                        {routeCalculator}
                    </SidebarSection>
                )}

                {costCalculator && (
                    <SidebarSection title="비용 계산" description="테이블형 전용">
                        {costCalculator}
                    </SidebarSection>
                )}

                <SidebarSection title="환율" description={selectedCurrency.unit}>
                    <ExchangeRateWidget selectedCurrency={selectedCurrency} onCurrencyChange={onCurrencyChange} />
                </SidebarSection>
            </div>
        </div>
    );
}

function SidebarSection({
    title,
    description,
    defaultOpen = false,
    children,
}: {
    title: string;
    description?: string;
    defaultOpen?: boolean;
    children: ReactNode;
}) {
    return (
        <details open={defaultOpen} className="group overflow-hidden rounded-lg border border-gray-200 bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-left transition hover:bg-gray-50 [&::-webkit-details-marker]:hidden">
                <div className="min-w-0">
                    <div className="truncate text-sm font-black text-gray-950">{title}</div>
                    {description && <div className="mt-0.5 truncate text-xs font-semibold text-gray-500">{description}</div>}
                </div>
                <span className="shrink-0 text-sm font-black text-gray-400 transition group-open:rotate-180">⌄</span>
            </summary>
            <div className="space-y-3 border-t border-gray-200 bg-gray-50/60 p-3">
                {children}
            </div>
        </details>
    );
}

function participantColor(participant: Participant) {
    const value = participant.email || String(participant.id) || participant.name;
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
    }
    return TEAM_COLORS[hash % TEAM_COLORS.length];
}

function apiErrorMessage(error: unknown, fallback: string) {
    if (
        typeof error === "object"
        && error !== null
        && "response" in error
        && typeof (error as { response?: { data?: unknown } }).response?.data === "string"
    ) {
        return (error as { response: { data: string } }).response.data;
    }
    return fallback;
}
