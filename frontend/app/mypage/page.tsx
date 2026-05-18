"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trash2, Users } from "lucide-react";
import Header from "@/app/header";
import RequireAuth from "@/components/requireAuth/RequireAuth";
import { deleteTravelPlan, loadTravelPlanIndex } from "@/lib/travelPlans";
import { useAuthStore } from "@/stores/authStore";

type PlanListItem = ReturnType<typeof loadTravelPlanIndex>[number];

export default function MyPage() {
    const { me, fetchMe } = useAuthStore();
    const [plans, setPlans] = useState<PlanListItem[]>(() => loadTravelPlanIndex());

    useEffect(() => {
        void fetchMe();
        const refresh = () => setPlans(loadTravelPlanIndex());
        window.addEventListener("focus", refresh);
        return () => window.removeEventListener("focus", refresh);
    }, [fetchMe]);

    const removePlan = (planId: string, title: string) => {
        if (!window.confirm(`"${title}" 여행 계획을 삭제할까요?`)) return;
        deleteTravelPlan(planId);
        setPlans(loadTravelPlanIndex());
    };

    return (
        <RequireAuth>
            <main className="min-h-screen bg-gray-50">
                <Header />
                <section className="mx-auto max-w-5xl px-6 py-10">
                    <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <h1 className="text-3xl font-bold text-gray-950">내 여행 계획표</h1>
                                <p className="mt-2 text-sm text-gray-500">
                                    작업하던 여행 계획을 이어서 작성하거나 삭제할 수 있습니다.
                                </p>
                            </div>
                            <div className="rounded-xl bg-gray-950 px-4 py-3 text-right text-white">
                                <div className="text-sm font-bold">{me?.nickname || "사용자"}</div>
                                <div className="mt-1 text-xs text-gray-300">{me?.email || "이메일 정보 없음"}</div>
                            </div>
                        </div>
                    </div>

                    <div className="mb-5 flex items-center justify-between">
                        <h2 className="text-xl font-bold text-gray-950">여행 계획 관리</h2>
                        <p className="mt-2 text-sm text-gray-500">
                            총 {plans.length}개
                        </p>
                    </div>

                    {plans.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
                            <div className="text-lg font-semibold text-gray-900">저장된 여행 계획이 없습니다.</div>
                            <Link
                                href="/"
                                className="mt-4 inline-flex rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white"
                            >
                                새 계획 만들기
                            </Link>
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {plans.map((plan) => (
                                <div
                                    key={plan.id}
                                    className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-950 hover:shadow-md"
                                >
                                    <Link href={`/createplan/${plan.id}`} className="block">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-lg font-bold text-gray-950">{plan.title}</span>
                                            <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-bold text-gray-700">
                                                {plan.template === "spreadsheet" ? "엑셀형" : "기본형"}
                                            </span>
                                        </div>
                                    </Link>
                                    <div className="mt-2 text-xs text-gray-500">ID: {plan.id}</div>
                                    <div className="mt-4 text-sm text-gray-600">
                                        마지막 수정: {new Date(plan.updatedAt).toLocaleString("ko-KR")}
                                    </div>
                                    <div className="mt-5 flex items-center gap-2">
                                        <Link
                                            href={`/createplan/${plan.id}`}
                                            className="inline-flex flex-1 items-center justify-center rounded-lg bg-gray-950 px-3 py-2 text-sm font-semibold text-white"
                                        >
                                            열기
                                        </Link>
                                        <div
                                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700"
                                            title="참여자 수"
                                        >
                                            <Users className="h-4 w-4" />
                                            {plan.participantCount}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removePlan(plan.id, plan.title)}
                                            className="inline-flex items-center justify-center rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </RequireAuth>
    );
}
