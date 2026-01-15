"use client";

import { useState } from "react";
import { Check } from "lucide-react"

export default function LoginCheckBox() {
    const [rememberMe, setRememberMe] = useState(false);

    return (
        <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={() => setRememberMe((v) => !v)}
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    rememberMe
                        ? "bg-black border-black"
                        : "border-gray-300 bg-white"
                }`}
            >
                {rememberMe && (
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                )}
            </button>

            <label
                onClick={() => setRememberMe((v) => !v)}
                className="text-sm cursor-pointer select-none"
            >
                로그인 상태 유지
            </label>
        </div>
    );
}
