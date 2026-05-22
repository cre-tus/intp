"use client";

import React, { useState } from "react";
import type { ReactNode } from "react";
import { Crown, Copy, Plus, Trash2, UserCog, Users } from "lucide-react";
import { SaveSection } from "@/components/planner/SaveSection";

export interface Participant {
    id: number;
    name: string;
    email?: string;
    role?: "OWNER" | "EDITOR" | "VIEWER";
}

interface ParticipantsSidebarProps {
    participants: Participant[];
    setParticipants: React.Dispatch<React.SetStateAction<Participant[]>>;
    planId?: string;
    inviteUrl?: string;
    onSave?: () => void;
    routeCalculator?: ReactNode;
    currentUserEmail?: string;
    currentUserName?: string;
}

export default function ParticipantsSidebar({
    participants,
    setParticipants,
    planId,
    inviteUrl,
    onSave,
    routeCalculator,
    currentUserEmail,
    currentUserName,
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

    const transferOwner = (id: number) => {
        if (!isOwner) {
            setNotice("오너만 오너 권한을 넘길 수 있습니다.");
            return;
        }
        const target = participants.find((participant) => participant.id === id);
        if (!target || target.role === "OWNER") return;
        if (!window.confirm(`${target.name}님에게 오너 권한을 넘길까요?`)) return;
        setParticipants((prev) =>
            prev.map((participant) => {
                if (participant.id === id) return { ...participant, role: "OWNER" };
                if (participant.role === "OWNER") return { ...participant, role: "EDITOR" };
                return participant;
            })
        );
        window.setTimeout(() => onSave?.(), 0);
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
        <div className="rounded-xl border border-gray-200 bg-white shadow-lg lg:sticky lg:top-8">
            <div className="relative overflow-hidden bg-gradient-to-r from-black via-gray-900 to-black px-5 py-4">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                <div className="relative z-10 flex items-center gap-2">
                    <Users className="h-5 w-5 text-white" />
                    <h3 className="text-lg font-bold tracking-tight text-white">참여자 목록</h3>
                </div>
            </div>

            <div className="max-h-none space-y-4 overflow-y-visible overflow-x-hidden p-4 sm:p-5">
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

                <div className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-500">
                        <Crown className="h-3.5 w-3.5" />
                        오너: {owner?.name || currentUserName || "사용자"}
                    </div>
                    <div className="text-xs text-gray-500">
                        {isOwner ? "참여자 추가, 삭제, 오너 넘기기가 가능합니다." : "오너만 참여자를 관리할 수 있습니다."}
                    </div>
                </div>

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
                            className="shrink-0 rounded-lg bg-gradient-to-br from-gray-900 to-gray-700 p-2 text-white shadow-sm transition-all hover:scale-105 hover:from-black hover:to-gray-800 hover:shadow-md disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-300"
                        >
                            <Plus className="h-5 w-5" />
                        </button>
                    </div>
                    <p className="text-xs text-gray-500">이메일로 가입된 사용자를 찾아 닉네임을 자동으로 표시합니다.</p>
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
                                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gray-900 to-gray-700 text-sm font-bold text-white shadow-sm">
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

                                {participant.role !== "OWNER" && isOwner && (
                                    <button
                                        type="button"
                                        onClick={() => transferOwner(participant.id)}
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
                                    title={participant.role === "OWNER" ? "오너는 권한을 넘긴 뒤 삭제할 수 있습니다." : "참여자 삭제"}
                                >
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {participants.length > 0 && (
                    <div className="-mx-5 mt-4 border-t-2 border-gray-200 bg-gradient-to-r from-gray-100 to-white px-5 py-3">
                        <div className="text-center">
                            <span className="text-sm font-medium text-gray-600">총 인원: </span>
                            <span className="ml-1 text-xl font-bold text-gray-900">{participants.length}</span>
                            <span className="ml-1 text-sm text-gray-600">명</span>
                        </div>
                    </div>
                )}

            </div>

            <SaveSection
                defaultUserName={participants.length > 0 ? participants[0].name : "사용자"}
                onSave={onSave}
            />
            {routeCalculator}
        </div>
    );
}
