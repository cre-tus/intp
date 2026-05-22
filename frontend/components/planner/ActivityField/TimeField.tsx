"use client";

import React from "react";
import { Clock } from "lucide-react";

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

    return (
        <div
            className="group/time relative flex w-full items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 sm:w-[130px]"
            onMouseEnter={() => props.onClearError?.()}
            onFocusCapture={() => props.onClearError?.()}
        >

            <Clock
                className="h-4 w-4 cursor-pointer text-gray-600"
                onClick={() => props.onFocusPicker(activityId)}
            />

            <input
                ref={(el) => props.registerRef(activityId, el)}
                type="time"
                value={value}
                onChange={(e) => props.onChange(e.target.value)}
                className={[
                    "no-time-picker min-w-0 w-full bg-transparent px-1 py-1 text-sm font-medium focus:outline-none",

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

