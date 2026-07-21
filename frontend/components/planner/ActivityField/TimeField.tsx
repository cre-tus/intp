"use client";

import React, { useEffect, useRef, useState } from "react";
import { Clock, Minus, Plus } from "lucide-react";

type ActivityError = { message: string } | null;

export default function TimeField(props: {
    activityId: string;
    value: string;
    error: ActivityError;

    registerRef: (activityId: string, el: HTMLInputElement | null) => void;
    onFocusPicker: (activityId: string) => void;
    onChange: (next: string) => void;
    onClearError?: () => void;

}) {
    const { activityId, value, error } = props;
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!menuOpen) return;
        const handleOutside = (event: MouseEvent | TouchEvent) => {
            if (!menuRef.current?.contains(event.target as Node)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleOutside);
        document.addEventListener("touchstart", handleOutside);
        return () => {
            document.removeEventListener("mousedown", handleOutside);
            document.removeEventListener("touchstart", handleOutside);
        };
    }, [menuOpen]);

    const shiftTime = (minutes: number) => {
        props.onChange(addMinutes(value, minutes));
    };

    return (
        <div
            className="planner-time-field group/time relative flex w-full items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 sm:w-[150px]"
            onMouseEnter={() => props.onClearError?.()}
            onFocusCapture={() => props.onClearError?.()}
        >

            <button
                type="button"
                onClick={() => {
                    props.onClearError?.();
                    setMenuOpen((open) => !open);
                }}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-600 transition hover:bg-white hover:text-gray-900"
                aria-label="시간 빠른 조절"
                title="시간 빠른 조절"
            >
                <Clock className="planner-field-icon h-4 w-4" />
            </button>

            <input
                ref={(el) => props.registerRef(activityId, el)}
                type="time"
                step={300}
                value={value}
                onChange={(e) => props.onChange(e.target.value)}
                onKeyDown={(event) => {
                    if (event.key === "ArrowUp") {
                        event.preventDefault();
                        shiftTime(15);
                    }
                    if (event.key === "ArrowDown") {
                        event.preventDefault();
                        shiftTime(-15);
                    }
                }}
                className={[
                    "planner-inline-input no-time-picker min-w-[72px] w-full bg-transparent px-1 py-1 text-sm font-bold tabular-nums focus:outline-none",

                    error
                        ? [
                            "ring-2 ring-red-500",
                            "animate-[shake_0.18s_ease-in-out_0s_2]",

                            // ✅ 커서 올리면 링(테두리) 제거
                            "group-hover/time:ring-0",

                            // (원하면) hover 시 애니메이션도 같이 제거
                            "group-hover/time:animate-none",
                        ].join(" ")
                        : "",
                ].join(" ")}
            />

            {menuOpen && (
                <div
                    ref={menuRef}
                    className="absolute left-0 top-full z-40 mt-2 w-44 rounded-xl border border-gray-200 bg-white p-2 shadow-xl shadow-gray-200/60"
                >
                    <div className="grid grid-cols-2 gap-1">
                        <TimeAdjustButton label="-30분" onClick={() => shiftTime(-30)} icon={<Minus className="h-3.5 w-3.5" />} />
                        <TimeAdjustButton label="+30분" onClick={() => shiftTime(30)} icon={<Plus className="h-3.5 w-3.5" />} />
                        <TimeAdjustButton label="-15분" onClick={() => shiftTime(-15)} icon={<Minus className="h-3.5 w-3.5" />} />
                        <TimeAdjustButton label="+15분" onClick={() => shiftTime(15)} icon={<Plus className="h-3.5 w-3.5" />} />
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            props.onFocusPicker(activityId);
                            setMenuOpen(false);
                        }}
                        className="mt-1 w-full rounded-lg px-2 py-1.5 text-xs font-bold text-gray-600 transition hover:bg-gray-50 hover:text-gray-950"
                    >
                        직접 선택
                    </button>
                </div>
            )}

            {error && (
                <div
                    className="pointer-events-none absolute left-0 -top-10 z-20 opacity-0 transition-opacity group-hover/time:opacity-100">
                    <div className="whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs text-white shadow-lg">
                        {error.message}
                    </div>
                </div>
            )}
        </div>
    );
}

function TimeAdjustButton({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-gray-700 transition hover:bg-gray-100"
        >
            {icon}
            {label}
        </button>
    );
}

function addMinutes(value: string, minutes: number) {
    const base = parseTime(value) ?? 9 * 60;
    const day = 24 * 60;
    const next = (base + minutes + day) % day;
    const hours = Math.floor(next / 60);
    const mins = next % 60;
    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function parseTime(value: string) {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return hours * 60 + minutes;
}

