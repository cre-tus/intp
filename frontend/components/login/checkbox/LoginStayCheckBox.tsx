"use client";

import { Check } from "lucide-react";

type Props = {
    checked: boolean;
    onChange: (checked: boolean) => void;
};

export default function LoginCheckBox({ checked, onChange }: Props) {
    return (
        <div className="flex items-center gap-2">
            {/* 체크 버튼 */}
            <button
                type="button"
                onClick={() => onChange(!checked)} // ✅ 부모 상태 변경
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    checked
                        ? "bg-black border-black"
                        : "border-gray-300 bg-white"
                }`}
            >
                {checked && (
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                )}
            </button>

            {/* 라벨 클릭해도 동일하게 토글 */}
            <label
                onClick={() => onChange(!checked)} // ✅ 부모 상태 변경
                className="text-sm cursor-pointer select-none"
            >
                로그인 상태 유지
            </label>
        </div>
    );
}
