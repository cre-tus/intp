"use client";

import { useState } from "react";
import TravelCheckList, {
    ChecklistItem,
} from "@/components/planner/TravelCheckList";
import TravelItinerary from "@/components/planner/TravelItinerary";
import ParticipantsSidebar, {
    Participant,
} from "@/components/planner/ParticipantsSidebar";

export default function HeroSection() {
    const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
    const [participants, setParticipants] = useState<Participant[]>([]);

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="container mx-auto px-4 py-8">
                <h1 className="mb-10 font-[var(--font-paperlogy)] font-normal text-[32px] leading-[1.05] tracking-[-0.02em] text-black">
                    여행 일정표 - 기본 템플릿
                </h1>

                <div className="flex gap-6 items-start">
                    <div className="flex-1 space-y-8">
                        <TravelCheckList
                            checklist={checklist}
                            setChecklist={setChecklist}
                        />
                        <TravelItinerary />
                    </div>

                    <div className="w-80 shrink-0">
                        <ParticipantsSidebar
                            participants={participants}
                            setParticipants={setParticipants}
                            checklist={checklist}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}