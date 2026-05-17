"use client";

import React, { useState } from "react";
import { Copy, Plus, Trash2, Users } from "lucide-react";
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
}

export default function ParticipantsSidebar({
    participants,
    setParticipants,
    planId,
    inviteUrl,
    onSave,
}: ParticipantsSidebarProps) {
    const [newParticipantEmail, setNewParticipantEmail] = useState("");
    const [notice, setNotice] = useState("");

    const addParticipant = () => {
        const email = newParticipantEmail.trim();
        if (!email) return;

        const participant: Participant = {
            id: Date.now(),
            name: email.split("@")[0] || email,
            email,
            role: "EDITOR",
        };
        setParticipants((prev) => [...prev.filter((item) => item.email !== email), participant]);
        setNewParticipantEmail("");
        setNotice("참여자를 목록에 추가했습니다. 초대 링크는 등록된 이메일 계정만 열 수 있습니다.");
    };

    const removeParticipant = (id: number) => {
        setParticipants((prev) => prev.filter((participant) => participant.id !== id));
    };

    const copyInviteLink = async () => {
        if (!inviteUrl) return;
        await navigator.clipboard.writeText(inviteUrl);
        setNotice("초대 링크를 복사했습니다.");
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") addParticipant();
    };

    return (
        <div className="sticky top-8 max-h-[calc(100vh-4rem)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
            <div className="relative overflow-hidden bg-gradient-to-r from-black via-gray-900 to-black px-5 py-4">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                <div className="relative z-10 flex items-center gap-2">
                    <Users className="h-5 w-5 text-white" />
                    <h3 className="text-lg font-bold tracking-tight text-white">참여자 목록</h3>
                </div>
            </div>

            <div className="max-h-[calc(100vh-12rem)] space-y-4 overflow-y-auto overflow-x-hidden p-5">
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

                <div className="flex items-center gap-2">
                    <input
                        type="email"
                        value={newParticipantEmail}
                        onChange={(event) => setNewParticipantEmail(event.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="참여자 이메일"
                        className="min-w-0 flex-1 rounded-lg border-2 border-gray-300 px-3 py-2 transition-all focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />

                    <button
                        type="button"
                        onClick={addParticipant}
                        className="shrink-0 rounded-lg bg-gradient-to-br from-gray-900 to-gray-700 p-2 text-white shadow-sm transition-all hover:scale-105 hover:from-black hover:to-gray-800 hover:shadow-md"
                    >
                        <Plus className="h-5 w-5" />
                    </button>
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
                                    <div className="truncate text-sm font-semibold text-gray-950">{participant.name}</div>
                                    <div className="truncate text-xs text-gray-500">
                                        {participant.email ?? "local"} · {participant.role ?? "EDITOR"}
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => removeParticipant(participant.id)}
                                    className="shrink-0 rounded-lg p-1.5 opacity-0 transition-all hover:scale-110 hover:bg-red-50 group-hover:opacity-100"
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
        </div>
    );
}
