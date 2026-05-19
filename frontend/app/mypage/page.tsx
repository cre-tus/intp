"use client";

import Header from "@/app/header";
import RequireAuth from "@/components/requireAuth/RequireAuth";
import { deleteTravelPlan, loadTravelPlanIndex, type TravelPlanIndexItem } from "@/lib/travelPlans";
import { useAuthStore } from "@/stores/authStore";
import { Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function MyPage() {
    const { me, fetchMe } = useAuthStore();
    const [plans, setPlans] = useState<TravelPlanIndexItem[]>([]);

    useEffect(() => {
        void fetchMe();
        const refresh = () => void loadTravelPlanIndex().then(setPlans).catch(() => setPlans([]));
        refresh();
        window.addEventListener("focus", refresh);
        return () => window.removeEventListener("focus", refresh);
    }, [fetchMe]);

    const removePlan = async (plan: TravelPlanIndexItem) => {
        if (plan.tier === "PAID") {
            const agreed = window.confirm(
                `"${plan.title}"은 유료 버전 템플릿입니다.\n삭제하면 이 템플릿 ID의 유료 권한도 함께 사라집니다.\n정말 삭제할까요?`,
            );
            if (!agreed) return;
        } else if (!window.confirm(`"${plan.title}" 여행 계획을 삭제할까요?`)) {
            return;
        }
        await deleteTravelPlan(plan.id);
        setPlans(await loadTravelPlanIndex());
    };

    return (
        <RequireAuth>
            <main className="min-h-screen bg-gray-50">
                <Header />
                <section className="mx-auto max-w-6xl px-6 py-10">
                    <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h1 className="text-3xl font-bold text-gray-950">내 여행 계획</h1>
                                <p className="mt-2 text-sm text-gray-500">
                                    DB에 저장된 내 여행 계획을 관리합니다.
                                </p>
                            </div>
                            <div className="rounded-xl bg-gray-950 px-4 py-3 text-right text-white">
                                <div className="text-sm font-bold">{me?.nickname || "사용자"}</div>
                                <div className="mt-1 text-xs text-gray-300">{me?.email || "이메일 정보 없음"}</div>
                            </div>
                        </div>
                    </div>

                    {plans.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
                            <div className="text-lg font-semibold text-gray-900">표시할 여행 계획이 없습니다.</div>
                            <Link href="/" className="mt-4 inline-flex rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white">
                                새 계획 만들기
                            </Link>
                        </div>
                    ) : (
                        <PlanSection title="내가 관리하는 계획" plans={plans} onRemove={(plan) => void removePlan(plan)} />
                    )}
                </section>
            </main>
        </RequireAuth>
    );
}

function PlanSection({
    title,
    plans,
    onRemove,
}: {
    title: string;
    plans: TravelPlanIndexItem[];
    onRemove: (plan: TravelPlanIndexItem) => void;
}) {
    return (
        <section>
            <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-950">{title}</h3>
                <span className="text-sm font-semibold text-gray-500">{plans.length}개</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                {plans.map((plan) => (
                    <div key={plan.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-950 hover:shadow-md">
                        <div className="flex flex-wrap items-center gap-2">
                            <Link href={`/createplan/${plan.id}`} className="text-lg font-bold text-gray-950 hover:underline">
                                {plan.title}
                            </Link>
                            <Badge>{plan.template === "spreadsheet" ? "엑셀형" : "기본형"}</Badge>
                            <TierBadge tier={plan.tier} />
                        </div>
                        <div className="mt-2 text-xs text-gray-500">ID: {plan.id}</div>
                        <div className="mt-4 text-sm text-gray-600">
                            마지막 수정: {new Date(plan.updatedAt).toLocaleString("ko-KR")}
                        </div>
                        <div className="mt-5 flex items-center gap-2">
                            <Link href={`/createplan/${plan.id}`} className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50">
                                열기
                            </Link>
                            <div className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700" title="참여자 수">
                                <Users className="h-4 w-4" />
                                {plan.participantCount}
                            </div>
                            <button type="button" onClick={() => onRemove(plan)} className="inline-flex items-center justify-center rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

function Badge({ children }: { children: React.ReactNode }) {
    return <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-bold text-gray-700">{children}</span>;
}

function TierBadge({ tier }: { tier: TravelPlanIndexItem["tier"] }) {
    if (tier === "PAID") return <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">유료</span>;
    if (tier === "PENDING_PAID") return <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">승인 대기</span>;
    return <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">무료</span>;
}
