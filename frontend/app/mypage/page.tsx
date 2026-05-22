"use client";

import Header from "@/app/header";
import PrimaryButton from "@/components/home/Buttons/PrimaryButton";
import RequireAuth from "@/components/requireAuth/RequireAuth";
import {
    deleteTravelPlan,
    loadSharedTravelPlanIndex,
    loadTravelPlanIndex,
    type TravelPlanIndexItem,
} from "@/lib/travelPlans";
import { useAuthStore } from "@/stores/authStore";
import { Bell, ChevronRight, Globe2, Shield, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function MyPage() {
    const { me, fetchMe } = useAuthStore();
    const [plans, setPlans] = useState<TravelPlanIndexItem[]>([]);
    const [sharedPlans, setSharedPlans] = useState<TravelPlanIndexItem[]>([]);
    const [showAllPlans, setShowAllPlans] = useState(false);
    const [showAllSharedPlans, setShowAllSharedPlans] = useState(false);

    useEffect(() => {
        void fetchMe();
        const refresh = () => {
            void Promise.all([
                loadTravelPlanIndex().catch(() => []),
                loadSharedTravelPlanIndex().catch(() => []),
            ]).then(([owned, shared]) => {
                setPlans(owned);
                setSharedPlans(shared);
            });
        };
        refresh();
        window.addEventListener("focus", refresh);
        return () => window.removeEventListener("focus", refresh);
    }, [fetchMe]);

    const sortedPlans = useSortedPlans(plans);
    const sortedSharedPlans = useSortedPlans(sharedPlans);
    const visiblePlans = showAllPlans ? sortedPlans : sortedPlans.slice(0, 3);
    const visibleSharedPlans = showAllSharedPlans ? sortedSharedPlans : sortedSharedPlans.slice(0, 3);

    const removePlan = async (plan: TravelPlanIndexItem) => {
        if (!window.confirm(`"${plan.title}" 계획표를 삭제할까요?`)) return;
        try {
            await deleteTravelPlan(plan.id);
        } catch (error) {
            window.alert(readDeleteError(error));
        } finally {
            setPlans(await loadTravelPlanIndex());
            setSharedPlans(await loadSharedTravelPlanIndex());
        }
    };

    return (
        <RequireAuth>
            <main className="min-h-screen bg-gray-50">
                <Header />
                <section className="mx-auto max-w-3xl px-5 py-8">
                    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                        <div className="h-24 bg-gradient-to-r from-slate-900 to-slate-600" />
                        <div className="px-6 pb-6">
                            <div className="-mt-10 flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-black text-2xl font-black text-white">
                                {(me?.nickname || me?.email || "김").slice(0, 1)}
                            </div>
                            <div className="mt-4">
                                <h1 className="text-2xl font-black text-gray-950">{me?.nickname || "김인팁"}</h1>
                                <p className="mt-1 text-sm text-gray-500">여행을 사랑하는 사람</p>
                            </div>
                            <div className="mt-6 grid grid-cols-3 overflow-hidden rounded-2xl border border-gray-100">
                                <Stat value={plans.length} label="총 계획표" />
                                <Stat value={0} label="팔로워 수" />
                                <Stat value={0} label="팔로우 수" />
                            </div>
                        </div>
                    </section>

                    <SectionTitle title="계정 정보" />
                    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                        <InfoRow label="이름" value={me?.nickname || "김인팁"} />
                        <InfoRow label="이메일" value={me?.email || "inteam@example.com"} />
                        <InfoRow label="전화번호" value="010-1234-5678" />
                    </div>

                    <PlanSection
                        title="여행 계획표"
                        plans={visiblePlans}
                        totalCount={sortedPlans.length}
                        showAll={showAllPlans}
                        onToggleShowAll={() => setShowAllPlans((value) => !value)}
                        emptyText="아직 만든 계획표가 없습니다."
                        emptyAction
                        onRemove={(plan) => void removePlan(plan)}
                    />

                    <PlanSection
                        title="참여 가능한 계획표"
                        plans={visibleSharedPlans}
                        totalCount={sortedSharedPlans.length}
                        showAll={showAllSharedPlans}
                        onToggleShowAll={() => setShowAllSharedPlans((value) => !value)}
                        emptyText="참여 가능한 계획표가 없습니다."
                    />

                    <SectionTitle title="설정" />
                    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                        <SettingRow
                            icon={<Bell className="h-4 w-4" />}
                            label="푸시 알림"
                            trailing={<span className="h-6 w-11 rounded-full bg-black p-1"><span className="ml-auto block h-4 w-4 rounded-full bg-white" /></span>}
                        />
                        <SettingRow icon={<Globe2 className="h-4 w-4" />} label="언어" trailing={<span className="text-sm text-gray-400">한국어</span>} />
                        <SettingRow icon={<Shield className="h-4 w-4" />} label="보안 설정" trailing={<ChevronRight className="h-4 w-4 text-gray-300" />} />
                    </div>
                </section>
            </main>
        </RequireAuth>
    );
}

function useSortedPlans(plans: TravelPlanIndexItem[]) {
    return useMemo(
        () => [...plans].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
        [plans],
    );
}

function readDeleteError(error: unknown) {
    if (typeof error === "object" && error !== null && "response" in error) {
        const response = (error as { response?: { data?: unknown } }).response;
        if (typeof response?.data === "string" && response.data.trim()) return response.data;
    }
    return "계획표를 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.";
}

function PlanSection({
    title,
    plans,
    totalCount,
    showAll,
    onToggleShowAll,
    emptyText,
    emptyAction = false,
    onRemove,
}: {
    title: string;
    plans: TravelPlanIndexItem[];
    totalCount: number;
    showAll: boolean;
    onToggleShowAll: () => void;
    emptyText: string;
    emptyAction?: boolean;
    onRemove?: (plan: TravelPlanIndexItem) => void;
}) {
    return (
        <>
            <div className="mt-7 mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-500">{title}</h2>
                {totalCount > 3 && (
                    <button type="button" onClick={onToggleShowAll} className="text-sm font-semibold text-gray-600 hover:text-gray-950">
                        {showAll ? "접기" : "전체 보기"}
                    </button>
                )}
            </div>
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                {plans.length === 0 ? (
                    <div className="px-5 py-8 text-center">
                        <p className="text-sm font-semibold text-gray-700">{emptyText}</p>
                        {emptyAction && (
                            <div className="mt-4 flex justify-center">
                                <PrimaryButton />
                            </div>
                        )}
                    </div>
                ) : (
                    plans.map((plan) => <PlanRow key={plan.id} plan={plan} onRemove={onRemove ? () => onRemove(plan) : undefined} />)
                )}
            </div>
        </>
    );
}

function Stat({ value, label }: { value: number; label: string }) {
    return (
        <div className="border-r border-gray-100 px-4 py-4 text-center last:border-r-0">
            <div className="text-lg font-black text-gray-950">{value}</div>
            <div className="mt-1 text-xs font-medium text-gray-500">{label}</div>
        </div>
    );
}

function SectionTitle({ title }: { title: string }) {
    return <h2 className="mt-7 mb-3 text-sm font-bold text-gray-500">{title}</h2>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 last:border-b-0">
            <div>
                <div className="text-xs font-medium text-gray-400">{label}</div>
                <div className="mt-1 text-sm font-semibold text-gray-950">{value}</div>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-300" />
        </div>
    );
}

function PlanRow({ plan, onRemove }: { plan: TravelPlanIndexItem; onRemove?: () => void }) {
    return (
        <div className="flex items-center gap-4 border-b border-gray-100 px-5 py-4 last:border-b-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-xs font-black text-gray-500">
                {new Date(plan.updatedAt).getDate()}일
            </div>
            <Link href={`/createplan/${plan.id}`} className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-black text-gray-950">{plan.title}</span>
                    <PlanBadge>{templateLabel(plan.template)}</PlanBadge>
                    <PlanBadge tone={plan.tier === "PAID" ? "paid" : plan.tier === "PENDING_PAID" ? "pending" : "free"}>
                        {tierLabel(plan.tier)}
                    </PlanBadge>
                </div>
                <div className="mt-1 text-xs text-gray-500">{new Date(plan.updatedAt).toLocaleDateString("ko-KR")}</div>
            </Link>
            <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-500" title="참여자 수">
                    <Users className="h-4 w-4" />
                    {plan.participantCount}
                </span>
                {onRemove && (
                    <button type="button" onClick={onRemove} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="계획표 삭제">
                        <Trash2 className="h-4 w-4" />
                    </button>
                )}
                <ChevronRight className="h-4 w-4 text-gray-300" />
            </div>
        </div>
    );
}

function PlanBadge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "free" | "pending" | "paid" }) {
    const toneClass = {
        neutral: "bg-gray-100 text-gray-600",
        free: "bg-slate-100 text-slate-700",
        pending: "bg-amber-100 text-amber-700",
        paid: "bg-emerald-100 text-emerald-700",
    }[tone];

    return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black ${toneClass}`}>{children}</span>;
}

function templateLabel(template: TravelPlanIndexItem["template"]) {
    return template === "spreadsheet" ? "엑셀형 템플릿" : "기본형 템플릿";
}

function tierLabel(tier: TravelPlanIndexItem["tier"]) {
    if (tier === "PAID") return "유료";
    if (tier === "PENDING_PAID") return "승인 대기";
    return "무료";
}

function SettingRow({ icon, label, trailing }: { icon: React.ReactNode; label: string; trailing: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 last:border-b-0">
            <div className="flex items-center gap-3 text-sm font-semibold text-gray-950">
                <span className="text-gray-500">{icon}</span>
                {label}
            </div>
            {trailing}
        </div>
    );
}
