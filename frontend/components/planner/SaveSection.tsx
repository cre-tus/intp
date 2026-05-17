import React, { useState } from 'react';
import { Save } from 'lucide-react';

type ChecklistSaveItem = {
    text: string;
    cost: number;
    checked: boolean;
};

interface SaveSectionProps {
    checklist: ChecklistSaveItem[];
    defaultUserName?: string;
}

export function SaveSection({ defaultUserName = '사용자' , checklist }: SaveSectionProps) {
    const [lastSaved, setLastSaved] = useState<{ date: string; user: string } | null>(null);

    const handleSave = async () => {

        const payload = {
            planId: 1, // 테스트용
            checklistItems: checklist.map(item => ({
                itemName: item.text,
                cost: item.cost,
                checked: item.checked
            }))
        };

        console.log(payload); // 먼저 콘솔 확인

        await fetch("http://localhost:8081/api/plans/checklist-test", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });
        const currentDate = new Date().toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });

        setLastSaved({
            date: currentDate,
            user: defaultUserName
        });
    };

    return (
        <div className="border-t-2 border-gray-200 bg-gradient-to-r from-gray-50 to-white p-5 space-y-3">
            {/* 저장 버튼 */}
            <button
                onClick={handleSave}
                className="w-full bg-gradient-to-r from-black via-gray-900 to-black text-white py-3 px-4 rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2 font-bold hover:scale-105 relative overflow-hidden group"
            >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                <Save className="w-5 h-5 relative z-10" />
                <span className="relative z-10">저장하기</span>
            </button>

            {/* 저장 정보 표시 */}
            {lastSaved && (
                <div className="bg-white border-2 border-gray-200 rounded-lg p-3 space-y-1.5">
                    <div className="flex items-start gap-2">
                        <span className="text-xs font-semibold text-gray-500 min-w-[60px]">저장 날짜:</span>
                        <span className="text-xs text-gray-700 font-medium">{lastSaved.date}</span>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="text-xs font-semibold text-gray-500 min-w-[60px]">저장한 사람:</span>
                        <span className="text-xs text-gray-700 font-medium">{lastSaved.user}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

