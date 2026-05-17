"use client";

import React, { useState } from "react";
import { Plus, Trash2, Users } from "lucide-react";
import { SaveSection } from "@/components/planner/SaveSection";
import { ChecklistItem } from "@/components/planner/TravelCheckList";

export interface Participant {
    id: number;
    name: string;
}

interface ParticipantsSidebarProps {
    participants: Participant[];
    setParticipants: React.Dispatch<React.SetStateAction<Participant[]>>;
    checklist: ChecklistItem[];
}

export default function ParticipantsSidebar({
                                                participants,
                                                setParticipants,
                                                checklist,
                                            }: ParticipantsSidebarProps) {
    const [newParticipantName, setNewParticipantName] = useState<string>("");

    const addParticipant = () => {
        if (newParticipantName.trim() === "") return;

        const newParticipant: Participant = {
            id: Date.now(),
            name: newParticipantName.trim(),
        };

        setParticipants((prev) => [...prev, newParticipant]);
        setNewParticipantName("");
    };

    const removeParticipant = (id: number) => {
        setParticipants((prev) => prev.filter((p) => p.id !== id));
    };

    const updateParticipantName = (id: number, name: string) => {
        setParticipants((prev) =>
            prev.map((p) => (p.id === id ? { ...p, name } : p))
        );
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") addParticipant();
    };

    return (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden sticky top-8 max-h-[calc(100vh-4rem)]">
            <div className="bg-gradient-to-r from-black via-gray-900 to-black px-5 py-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                <div className="flex items-center gap-2 relative z-10">
                    <Users className="w-5 h-5 text-white" />
                    <h3 className="text-lg font-bold text-white tracking-tight">
                        참여자 목록
                    </h3>
                </div>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto overflow-x-hidden max-h-[calc(100vh-12rem)]">
                <div className="flex gap-2 items-center">
                    <input
                        type="text"
                        value={newParticipantName}
                        onChange={(e) => setNewParticipantName(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="참여자 아이디"
                        className="flex-1 min-w-0 px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all"
                    />

                    <button
                        type="button"
                        onClick={addParticipant}
                        className="shrink-0 p-2 bg-gradient-to-br from-gray-900 to-gray-700 text-white rounded-lg hover:from-black hover:to-gray-800 transition-all shadow-sm hover:shadow-md hover:scale-105"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-2">
                    {participants.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                            <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">참여자를 추가해주세요</p>
                        </div>
                    ) : (
                        participants.map((participant, index) => (
                            <div
                                key={participant.id}
                                className="flex items-center gap-3 p-3 bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-lg hover:border-gray-900 hover:shadow-md transition-all group min-w-0"
                            >
                                <div className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-gray-900 to-gray-700 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-sm">
                                    {index + 1}
                                </div>

                                <input
                                    type="text"
                                    value={participant.name}
                                    onChange={(e) =>
                                        updateParticipantName(
                                            participant.id,
                                            e.target.value
                                        )
                                    }
                                    className="flex-1 min-w-0 bg-transparent focus:outline-none font-medium px-0.5 py-1 rounded focus:ring-2 focus:ring-gray-300"
                                />

                                <button
                                    type="button"
                                    onClick={() => removeParticipant(participant.id)}
                                    className="shrink-0 p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded-lg transition-all hover:scale-110"
                                >
                                    <Trash2 className="w-4 h-4 text-red-600" />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {participants.length > 0 && (
                    <div className="pt-4 mt-4 border-t-2 border-gray-200 bg-gradient-to-r from-gray-100 to-white -mx-5 px-5 py-3 rounded-b-xl">
                        <div className="text-center">
                            <span className="text-sm text-gray-600 font-medium">
                                총 인원:{" "}
                            </span>
                            <span className="text-xl font-bold text-gray-900 ml-1">
                                {participants.length}
                            </span>
                            <span className="text-sm text-gray-600 ml-1">명</span>
                        </div>
                    </div>
                )}
            </div>

            <SaveSection
                defaultUserName={
                    participants.length > 0 ? participants[0].name : "사용자"
                }
                checklist={checklist}
            />
        </div>
    );
}