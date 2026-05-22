import React, { useState } from "react";
import { Save } from "lucide-react";

interface SaveSectionProps {
    defaultUserName?: string;
    onSave?: () => void;
}

export function SaveSection({ defaultUserName = "사용자", onSave }: SaveSectionProps) {
    const [lastSaved, setLastSaved] = useState<{ date: string; user: string } | null>(null);

    const handleSave = () => {
        onSave?.();
        const currentDate = new Date().toLocaleString("ko-KR", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
        setLastSaved({ date: currentDate, user: defaultUserName });
    };

    return (
        <div className="space-y-3 border-t-2 border-gray-200 bg-gradient-to-r from-gray-50 to-white p-4 sm:p-5">
            <button
                type="button"
                onClick={handleSave}
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-lg bg-gradient-to-r from-black via-gray-900 to-black px-4 py-3 font-bold text-white transition-all hover:shadow-lg sm:hover:scale-105"
            >
                <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-[100%]" />
                <Save className="relative z-10 h-5 w-5" />
                <span className="relative z-10">저장하기</span>
            </button>

            {lastSaved && (
                <div className="space-y-1.5 rounded-lg border-2 border-gray-200 bg-white p-3">
                    <div className="flex min-w-0 items-start gap-2">
                        <span className="shrink-0 text-xs font-semibold text-gray-500">저장 일시:</span>
                        <span className="min-w-0 break-words text-xs font-medium text-gray-700">{lastSaved.date}</span>
                    </div>
                    <div className="flex min-w-0 items-start gap-2">
                        <span className="shrink-0 text-xs font-semibold text-gray-500">저장자:</span>
                        <span className="min-w-0 break-words text-xs font-medium text-gray-700">{lastSaved.user}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
