"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import tokyo from "@/image/Tokyo.png";
import { createTokyoRecommendedPlan, type TokyoTripDuration } from "@/lib/tokyoRecommendedPlans";
import { generatePlanId, saveTravelPlan } from "@/lib/travelPlans";
import { useAuthStore } from "@/stores/authStore";

export default function TokyoRecommendationCard() {
    const router = useRouter();
    const { isLoggedIn, me } = useAuthStore();
    const [expanded, setExpanded] = useState(false);
    const [submitting, setSubmitting] = useState<TokyoTripDuration | null>(null);
    const [error, setError] = useState("");

    const expandCard = () => {
        window.dispatchEvent(new CustomEvent("home:focus-city", { detail: { city: "tokyo" } }));
        setExpanded(true);
    };

    const collapseCard = () => {
        setExpanded(false);
        setError("");
        window.dispatchEvent(new CustomEvent("home:clear-focus-city"));
    };

    const createPlan = async (duration: TokyoTripDuration) => {
        if (isLoggedIn === false) {
            router.push("/login");
            return;
        }

        setSubmitting(duration);
        setError("");
        try {
            const id = generatePlanId();
            const plan = createTokyoRecommendedPlan(
                id,
                duration,
                me?.email
                    ? {
                        id: me.id,
                        email: me.email,
                        name: me.nickname || me.email.split("@")[0] || me.email,
                    }
                    : undefined,
            );
            const saved = await saveTravelPlan(plan);
            window.dispatchEvent(new CustomEvent("home:clear-focus-city"));
            router.push(`/createplan/${saved.id}`);
        } catch {
            setError("일정을 생성하지 못했습니다. 다시 시도해주세요.");
        } finally {
            setSubmitting(null);
        }
    };

    return (
        <div
            data-city-card="tokyo"
            className="group relative h-[360px] w-[270px] shrink-0 overflow-hidden rounded-2xl border border-white bg-gray-100 text-left shadow-xl shadow-gray-900/10 transition hover:-translate-y-1 hover:shadow-2xl sm:h-[410px] sm:w-[305px]"
        >
            <button
                type="button"
                onClick={expanded ? undefined : expandCard}
                className="absolute inset-0 text-left focus:outline-none focus:ring-4 focus:ring-gray-950/20"
                aria-label="Tokyo 일정 만들기"
            >
                <Image
                    src={tokyo}
                    alt="도쿄 여행지 이미지"
                    fill
                    className={`object-cover transition duration-500 ${expanded ? "scale-105 brightness-[0.62]" : "group-hover:scale-105"}`}
                    sizes="305px"
                />
            </button>

            <div
                className={`absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-5 text-white transition-all duration-300 ${
                    expanded ? "pt-24" : ""
                }`}
            >
                <p className="text-xl font-bold">Tokyo</p>
                <p className="mt-1 text-sm text-white/85">{expanded ? "추천 일정표를 바로 만들기" : "2박 3일 · 4박 5일 일정 만들기"}</p>

                <div className={`grid overflow-hidden transition-all duration-300 ${expanded ? "mt-4 max-h-64 gap-2 opacity-100" : "max-h-0 opacity-0"}`}>
                    <DurationButton
                        title="2박 3일"
                        description="핵심 명소 위주"
                        loading={submitting === "2n3d"}
                        onClick={() => void createPlan("2n3d")}
                    />
                    <DurationButton
                        title="4박 5일"
                        description="동네 산책까지 여유롭게"
                        loading={submitting === "4n5d"}
                        onClick={() => void createPlan("4n5d")}
                    />
                    {error && <p className="rounded-lg bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-100">{error}</p>}
                    <button
                        type="button"
                        onClick={collapseCard}
                        className="rounded-lg px-3 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
                    >
                        돌아가기
                    </button>
                </div>
            </div>
        </div>
    );
}

function DurationButton({
    title,
    description,
    loading,
    onClick,
}: {
    title: string;
    description: string;
    loading: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={loading}
            className="rounded-xl border border-white/20 bg-white/12 px-4 py-3 text-left text-white backdrop-blur transition hover:bg-white/20 disabled:cursor-wait disabled:opacity-60"
        >
            <div className="font-[var(--font-paperlogy)] text-base font-bold">
                {loading ? "생성 중..." : title}
            </div>
            <div className="mt-0.5 text-xs text-white/75">{description}</div>
        </button>
    );
}
