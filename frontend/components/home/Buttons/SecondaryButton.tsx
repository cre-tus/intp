"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SecondaryButton() {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [inviteValue, setInviteValue] = useState("");
    const [error, setError] = useState("");

    const joinPlan = () => {
        const planId = extractPlanId(inviteValue);
        if (!planId) {
            setError("초대 링크 또는 계획 ID를 입력해주세요.");
            return;
        }

        setError("");
        setOpen(false);
        router.push(`/createplan/${encodeURIComponent(planId)}`);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") joinPlan();
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
                    text-black tracking-[-0.09px]
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
                            받은 초대 링크나 계획 ID를 입력하면 해당 일정으로 이동합니다.
                        </p>

                        <label className="mt-5 block text-sm font-semibold text-gray-700">
                            초대 링크 또는 계획 ID
                        </label>
                        <input
                            value={inviteValue}
                            onChange={(event) => setInviteValue(event.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="http://localhost/createplan/... 또는 계획 ID"
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
                                onClick={joinPlan}
                                className="rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white"
                            >
                                참여
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
        // Plain IDs are allowed.
    }

    const plainSegments = trimmed.split("/").filter(Boolean);
    return plainSegments[plainSegments.length - 1] ?? "";
}
