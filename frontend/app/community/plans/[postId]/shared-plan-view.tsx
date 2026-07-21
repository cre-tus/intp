"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock, Coins, MapPin, Route, Sparkles } from "lucide-react";
import { loadCommunityPlanView } from "@/lib/community";
import type { TravelPlanDraft } from "@/lib/travelPlans";
import type { ChecklistItem } from "@/components/planner/TravelCheckList";
import type { ItineraryActivity, ItineraryDay } from "@/components/planner/TravelItinerary";

type SharedPlanState = Awaited<ReturnType<typeof loadCommunityPlanView>>;

export default function SharedPlanView({ postId }: { postId: number }) {
    const [data, setData] = useState<SharedPlanState | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const invalidPostId = !Number.isFinite(postId) || postId <= 0;

    useEffect(() => {
        if (invalidPostId) return;
        loadCommunityPlanView(postId)
            .then(setData)
            .catch(() => setError("공유된 여행 계획을 불러오지 못했습니다."))
            .finally(() => setLoading(false));
    }, [invalidPostId, postId]);

    if (invalidPostId) {
        return <ErrorState message="공유된 여행 계획을 찾을 수 없습니다." />;
    }

    if (loading) {
        return (
            <section className="min-h-screen bg-gray-50 px-4 py-12">
                <div className="mx-auto max-w-5xl rounded-xl border border-gray-200 bg-white p-8 text-center text-sm font-bold text-gray-500 shadow-sm">
                    여행 계획을 불러오는 중입니다.
                </div>
            </section>
        );
    }

    if (error || !data) {
        return <ErrorState message={error || "계획을 찾을 수 없습니다."} />;
    }

    return <ReadonlyPlan data={data} plan={data.content} />;
}

function ErrorState({ message }: { message: string }) {
    return (
        <section className="min-h-screen bg-gray-50 px-4 py-12">
            <div className="mx-auto max-w-5xl rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
                <Link href="/community" className="inline-flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-gray-950">
                    <ArrowLeft className="h-4 w-4" />
                    커뮤니티로 돌아가기
                </Link>
                <h1 className="mt-6 text-2xl font-black text-gray-950">{message}</h1>
            </div>
        </section>
    );
}

function ReadonlyPlan({ data, plan }: { data: SharedPlanState; plan: TravelPlanDraft }) {
    const totalCost = useMemo(() => {
        const checklistCost = plan.checklist.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);
        const itineraryCost = plan.days.reduce(
            (daySum, day) => daySum + day.activities.reduce((sum, activity) => sum + (Number(activity.cost) || 0), 0),
            0,
        );
        return checklistCost + itineraryCost;
    }, [plan]);

    return (
        <section className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
                <Link href="/community" className="inline-flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-gray-950">
                    <ArrowLeft className="h-4 w-4" />
                    커뮤니티로 돌아가기
                </Link>

                <div className="mt-5 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="bg-gradient-to-r from-gray-950 via-gray-900 to-gray-800 px-5 py-8 text-white sm:px-8">
                        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/85">
                            <Sparkles className="h-3.5 w-3.5" />
                            커뮤니티 공유 계획
                        </div>
                        <h1 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">{plan.title}</h1>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
                            {data.author}님이 공유한 읽기 전용 여행 계획입니다. 이 화면에서는 일정 확인만 가능하고 원본 계획은 수정되지 않습니다.
                        </p>
                        <div className="mt-6 grid gap-3 sm:grid-cols-3">
                            <HeroMetric icon={<CalendarDays className="h-4 w-4" />} label="일정" value={`${plan.days.length}개 Day`} />
                            <HeroMetric icon={<Route className="h-4 w-4" />} label="템플릿" value={planTemplateLabel(plan.template)} />
                            <HeroMetric icon={<Coins className="h-4 w-4" />} label="예상 경비" value={`${totalCost.toLocaleString("ko-KR")}원`} />
                        </div>
                    </div>

                    <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                        <div className="space-y-5">
                            {plan.days.length === 0 ? (
                                <EmptyPanel title="공개된 일정이 없습니다." />
                            ) : (
                                plan.days.map((day, index) => <DayPanel key={day.id || index} day={day} index={index} />)
                            )}
                        </div>

                        <aside className="space-y-5">
                            <section className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                                <h2 className="text-sm font-black text-gray-950">공유 정보</h2>
                                <InfoRow label="게시글" value={data.postTitle} />
                                <InfoRow label="작성자" value={data.author} />
                                <InfoRow label="업데이트" value={new Date(data.updatedAt).toLocaleDateString("ko-KR")} />
                            </section>

                            <ChecklistPanel items={plan.checklist} />
                        </aside>
                    </div>
                </div>
            </div>
        </section>
    );
}

function HeroMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
    return (
        <div className="rounded-lg bg-white/10 p-3">
            <div className="flex items-center gap-2 text-xs font-bold text-white/65">
                {icon}
                {label}
            </div>
            <div className="mt-1 text-lg font-black">{value}</div>
        </div>
    );
}

function DayPanel({ day, index }: { day: ItineraryDay; index: number }) {
    const dayCost = day.activities.reduce((sum, activity) => sum + (Number(activity.cost) || 0), 0);
    return (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3">
                <div>
                    <h2 className="text-lg font-black text-gray-950">{day.dayTitle || `Day ${index + 1}`}</h2>
                    {day.date && <p className="mt-1 text-xs font-bold text-gray-500">{day.date}</p>}
                </div>
                <div className="rounded-full bg-gray-950 px-3 py-1.5 text-xs font-black text-white">
                    {dayCost.toLocaleString("ko-KR")}원
                </div>
            </div>

            <div className="divide-y divide-gray-100">
                {day.activities.length === 0 ? (
                    <EmptyPanel title="이 Day에는 공개된 일정이 없습니다." compact />
                ) : (
                    day.activities.map((activity, idx) => <ActivityItem key={activity.id || idx} activity={activity} />)
                )}
            </div>
        </section>
    );
}

function ActivityItem({ activity }: { activity: ItineraryActivity }) {
    return (
        <div className="grid gap-3 px-4 py-3 sm:grid-cols-[90px_minmax(0,1fr)_120px] sm:items-center">
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-black text-gray-700">
                <Clock className="h-3.5 w-3.5" />
                {displayText(activity.time, "시간 미정")}
            </div>
            <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-black text-gray-950">
                    <MapPin className="h-4 w-4 shrink-0 text-gray-400" />
                    <span className="truncate">{displayText(activity.location, "장소 미정")}</span>
                </div>
                <p className="mt-1 text-sm leading-6 text-gray-600">{displayText(activity.activity, "활동 내용 없음")}</p>
            </div>
            <div className="text-left text-sm font-black text-gray-950 sm:text-right">
                {(Number(activity.cost) || 0).toLocaleString("ko-KR")}원
            </div>
        </div>
    );
}

function ChecklistPanel({ items }: { items: ChecklistItem[] }) {
    return (
        <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-black text-gray-950">준비물 체크리스트</h2>
            {items.length === 0 ? (
                <p className="mt-3 text-sm font-semibold text-gray-500">공개된 준비물이 없습니다.</p>
            ) : (
                <div className="mt-3 space-y-2">
                    {items.map((item) => (
                        <div key={item.id} className="flex items-start gap-2 rounded-lg bg-gray-50 p-3">
                            <CheckCircle2 className={`mt-0.5 h-4 w-4 ${item.checked ? "text-emerald-500" : "text-gray-300"}`} />
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-bold text-gray-800">{item.text}</div>
                                <div className="mt-1 text-xs font-semibold text-gray-500">{(Number(item.cost) || 0).toLocaleString("ko-KR")}원</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="mt-3 flex items-start justify-between gap-3 border-t border-gray-200 pt-3 text-sm">
            <span className="font-bold text-gray-500">{label}</span>
            <span className="text-right font-black text-gray-950">{value}</span>
        </div>
    );
}

function EmptyPanel({ title, compact = false }: { title: string; compact?: boolean }) {
    return (
        <div className={`${compact ? "p-4" : "rounded-xl border border-gray-200 bg-white p-8"} text-center text-sm font-bold text-gray-500`}>
            {title}
        </div>
    );
}

function displayText(value: string | undefined, fallback: string) {
    return value && value.trim() ? value : fallback;
}

function planTemplateLabel(template: TravelPlanDraft["template"]) {
    if (template === "spreadsheet") return "일정표형";
    if (template === "timeline") return "트립 보드";
    if (template === "route_sheet") return "루트 시트";
    return "기본형";
}
