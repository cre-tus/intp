"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createEmptyTravelPlan, generatePlanId, saveTravelPlan } from "@/lib/travelPlans";
import { useAuthStore } from "@/stores/authStore";

export default function PrimaryButton() {
    const router = useRouter();
    const { me } = useAuthStore();
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState("신규 여행 일정표");

    const createPlan = () => {
        const id = generatePlanId();
        const plan = createEmptyTravelPlan(id, title.trim() || "신규 여행 일정표");
        if (me?.email) {
            plan.participants = [{
                id: me.id,
                name: me.nickname || me.email.split("@")[0] || me.email,
                email: me.email,
                role: "OWNER",
            }];
        }
        saveTravelPlan(plan);
        setOpen(false);
        router.push(`/createplan/${id}`);
    };

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="
                    flex h-[50px] items-center justify-center rounded-[12px]
                    bg-black px-[20px]
                    font-[var(--font-paperlogy)] text-[18px] font-medium
                    text-white
                "
            >
                Create
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
                        <div className="text-xl font-bold text-gray-950">템플릿 선택</div>
                        <p className="mt-1 text-sm text-gray-500">
                            우선 기본 템플릿으로 여행 계획을 생성합니다.
                        </p>

                        <label className="mt-5 block text-sm font-semibold text-gray-700">
                            여행 계획 이름
                        </label>
                        <input
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-gray-950 focus:outline-none focus:ring-2 focus:ring-gray-950"
                        />

                        <button
                            type="button"
                            className="mt-5 w-full rounded-lg border-2 border-gray-950 bg-gray-50 p-4 text-left"
                        >
                            <div className="font-bold text-gray-950">기본 템플릿</div>
                            <div className="mt-1 text-sm text-gray-500">
                                체크리스트, Day별 일정, 지도/TSP 경로 패널을 포함합니다.
                            </div>
                        </button>

                        <div className="mt-6 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-900"
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={createPlan}
                                className="rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white"
                            >
                                생성
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
