"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/app/header";
import RequireAuth from "@/components/requireAuth/RequireAuth";
import { loadTravelPlanIndex } from "@/lib/travelPlans";

type PlanListItem = ReturnType<typeof loadTravelPlanIndex>[number];

export default function MyPage() {
    const [plans, setPlans] = useState<PlanListItem[]>(() => loadTravelPlanIndex());

    useEffect(() => {
        const refresh = () => setPlans(loadTravelPlanIndex());
        window.addEventListener("focus", refresh);
        return () => window.removeEventListener("focus", refresh);
    }, []);

    return (
        <RequireAuth>
            <main className="min-h-screen bg-gray-50">
                <Header />
                <section className="mx-auto max-w-5xl px-6 py-10">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-950">내 여행 계획표</h1>
                        <p className="mt-2 text-sm text-gray-500">
                            작업하던 여행 계획을 이어서 작성할 수 있습니다.
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
                                <Link
                                    key={plan.id}
                                    href={`/createplan/${plan.id}`}
                                    className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-950 hover:shadow-md"
                                >
                                    <div className="text-lg font-bold text-gray-950">{plan.title}</div>
                                    <div className="mt-2 text-xs text-gray-500">ID: {plan.id}</div>
                                    <div className="mt-4 text-sm text-gray-600">
                                        마지막 수정: {new Date(plan.updatedAt).toLocaleString("ko-KR")}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </RequireAuth>
    );
}
