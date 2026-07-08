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
    const [open, setOpen] = useState(false);
    const [submitting, setSubmitting] = useState<TokyoTripDuration | null>(null);
    const [error, setError] = useState("");

    const openDurationDialog = () => {
        window.dispatchEvent(new CustomEvent("home:focus-city", { detail: { city: "tokyo" } }));
        setOpen(true);
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
            router.push(`/createplan/${saved.id}`);
        } catch {
            setError("일정을 생성하지 못했습니다. 로그인 상태를 확인한 뒤 다시 시도해주세요.");
        } finally {
            setSubmitting(null);
        }
    };

    return (
        <>
            <button
                type="button"
                data-city-card="tokyo"
                onClick={openDurationDialog}
                className="group relative h-[360px] w-[270px] shrink-0 overflow-hidden rounded-2xl border border-white bg-gray-100 text-left shadow-xl shadow-gray-900/10 transition hover:-translate-y-1 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-gray-950/20 sm:h-[410px] sm:w-[305px]"
                aria-label="도쿄 일정 만들기"
            >
                <Image
                    src={tokyo}
                    alt="도쿄 여행지 이미지"
                    fill
                    className="object-cover transition duration-500 group-hover:scale-105"
                    sizes="305px"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent p-5 text-white">
                    <p className="text-xl font-bold">Tokyo</p>
                    <p className="mt-1 text-sm text-white/85">2박 3일 · 4박 5일 일정 만들기</p>
                </div>
            </button>

            {open && (
                <div className="tokyo-recommendation-modal fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                        <div className="text-xl font-bold text-gray-950">도쿄 일정 선택</div>
                        <p className="mt-2 text-sm leading-6 text-gray-500">
                            원하는 여행 기간을 고르면 새 도쿄 일정이 만들어집니다.
                        </p>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
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
                        </div>

                        {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{error}</p>}

                        <div className="mt-5 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-500 transition hover:bg-gray-100 hover:text-gray-950"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
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
            className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-left transition hover:border-gray-950 hover:bg-white disabled:cursor-wait disabled:opacity-60"
        >
            <div className="font-[var(--font-paperlogy)] text-lg font-bold text-gray-950">
                {loading ? "생성 중..." : title}
            </div>
            <div className="mt-1 text-sm text-gray-500">{description}</div>
        </button>
    );
}
