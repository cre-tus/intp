"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SecondaryButton() {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [inviteValue, setInviteValue] = useState("");
    const [error, setError] = useState("");
    const [checking, setChecking] = useState(false);

    const joinPlan = async () => {
        const planId = extractPlanId(inviteValue);
        if (!planId) {
            setError("초대 링크 또는 계획 ID를 입력해주세요.");
            return;
        }

        setChecking(true);
        setError("");
        try {
            const response = await fetch(`/api/travel-plans/${encodeURIComponent(planId)}`, {
                credentials: "include",
            });
            if (!response.ok) {
                setError("존재하지 않거나 접근 권한이 없는 계획 ID입니다.");
                return;
            }
            setOpen(false);
            router.push(`/createplan/${encodeURIComponent(planId)}`);
        } catch {
            setError("계획표를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.");
        } finally {
            setChecking(false);
        }
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") void joinPlan();
    };

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="
                    relative flex h-[50px] items-center justify-center rounded-[12px]
                    border-2 border-[rgba(0,0,0,0.15)] bg-white px-[20px]
                    font-[var(--font-paperlogy)] text-[18px] font-medium
                    text-black
                "
            >
                <span
                    aria-hidden={true}
                    className="pointer-events-none absolute inset-0 rounded-[12px] border-2 border-[rgba(0,0,0,0.15)]"
                />
                Join
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
                        <div className="text-xl font-bold text-gray-950">여행 계획 참여</div>
                        <p className="mt-1 text-sm text-gray-500">
                            DB에 저장된 계획 ID나 초대 링크만 입장할 수 있습니다.
                        </p>

                        <label className="mt-5 block text-sm font-semibold text-gray-700">
                            초대 링크 또는 계획 ID
                        </label>
                        <input
                            value={inviteValue}
                            onChange={(event) => setInviteValue(event.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="https://tuk-intp.kro.kr/createplan/... 또는 계획 ID"
                            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-gray-950 focus:outline-none focus:ring-2 focus:ring-gray-950"
                        />
                        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

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
                                onClick={() => void joinPlan()}
                                disabled={checking}
                                className="rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:bg-gray-400"
                            >
                                {checking ? "확인 중" : "참여"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

function extractPlanId(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return "";

    try {
        const url = new URL(trimmed);
        const segments = url.pathname.split("/").filter(Boolean);
        const createPlanIndex = segments.findIndex((segment) => segment.toLowerCase() === "createplan");
        if (createPlanIndex >= 0 && segments[createPlanIndex + 1]) {
            return decodeURIComponent(segments[createPlanIndex + 1]);
        }
    } catch {
        // Plain IDs are allowed after server validation.
    }

    const plainSegments = trimmed.split("/").filter(Boolean);
    return plainSegments[plainSegments.length - 1] ?? "";
}
