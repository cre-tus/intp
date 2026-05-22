"use client";

import React from "react";
import { Plus, Trash2, CheckSquare, Square } from "lucide-react";

// 체크리스트 항목 타입 정의
export interface ChecklistItem {
    id: number;        // 고유 ID
    text: string;      // 항목 내용
    checked: boolean; // 체크 여부
    cost: number;      // 비용
}

// 부모에서 state를 받아오기 위한 props
interface TravelCheckListProps {
    checklist: ChecklistItem[];
    setChecklist: React.Dispatch<React.SetStateAction<ChecklistItem[]>>;
}

export default function TravelCheckList({
                                            checklist,
                                            setChecklist,
                                        }: TravelCheckListProps) {

    // ===============================
    // 체크리스트 항목 추가
    // ===============================
    const addChecklistItem = () => {
        const newItem: ChecklistItem = {
            id: Date.now(), // 간단한 고유값
            text: "",
            checked: false,
            cost: 0,
        };

        setChecklist((prev) => [...prev, newItem]);
    };

    // ===============================
    // 체크리스트 항목 삭제
    // ❗ 기존 버그 수정됨
    // ===============================
    const removeChecklistItem = (itemId: number) => {
        setChecklist((prev) =>
            prev.filter((item) => item.id !== itemId)
        );
    };

    // ===============================
    // 체크 상태 토글
    // ===============================
    const toggleChecklistItem = (itemId: number) => {
        setChecklist((prev) =>
            prev.map((item) =>
                item.id === itemId
                    ? { ...item, checked: !item.checked }
                    : item
            )
        );
    };

    // ===============================
    // 텍스트 수정
    // ===============================
    const updateChecklistItem = (itemId: number, text: string) => {
        setChecklist((prev) =>
            prev.map((item) =>
                item.id === itemId ? { ...item, text } : item
            )
        );
    };

    // ===============================
    // 비용 수정
    // ===============================
    const updateChecklistItemCost = (itemId: number, cost: number) => {
        setChecklist((prev) =>
            prev.map((item) =>
                item.id === itemId ? { ...item, cost } : item
            )
        );
    };

    const updateChecklistItemCostInput = (itemId: number, value: string) => {
        const digits = value.replace(/\D/g, "");
        updateChecklistItemCost(itemId, digits ? Number(digits) : 0);
    };

    // ===============================
    // 총 비용 계산
    // ===============================
    const totalCost = checklist.reduce(
        (sum, item) => sum + (item.cost || 0),
        0
    );

    return (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">

            {/* ===============================
                헤더
            =============================== */}
            <div className="bg-gradient-to-r from-gray-700 to-gray-900 px-4 py-4 sm:px-6">
                <h2 className="font-[var(--font-paperlogy)] text-xl font-bold text-white sm:text-2xl">
                    여행 전 준비물
                </h2>
            </div>

            {/* ===============================
                리스트 영역
            =============================== */}
            <div className="space-y-3 p-4 sm:p-6">

                {/* 각 체크리스트 항목 */}
                {checklist.map((item) => (
                    <div key={item.id} className="group grid gap-2 rounded-lg border border-gray-100 p-2 sm:flex sm:items-center sm:border-0 sm:p-0">

                        {/* 체크 버튼 */}
                        <button
                            type="button"
                            onClick={() => toggleChecklistItem(item.id)}
                        >
                            {item.checked ? (
                                <CheckSquare className="w-5 h-5 text-gray-900" />
                            ) : (
                                <Square className="w-5 h-5 text-gray-400" />
                            )}
                        </button>

                        {/* 텍스트 입력 */}
                        <input
                            type="text"
                            value={item.text}
                            onChange={(e) =>
                                updateChecklistItem(item.id, e.target.value)
                            }
                            placeholder="항목 입력"
                            className={`min-w-0 flex-1 rounded border px-3 py-2 ${
                                item.checked ? "line-through text-gray-400" : ""
                            }`}
                        />

                        {/* 비용 입력 */}
                        <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={item.cost ? item.cost.toLocaleString() : ""}
                            onChange={(e) => updateChecklistItemCostInput(item.id, e.target.value)}
                            placeholder="경비"
                            className="w-full rounded border px-3 py-2 sm:w-32"
                        />

                        {/* 삭제 버튼 */}
                        <button
                            type="button"
                            onClick={() => removeChecklistItem(item.id)}
                            className="justify-self-end rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100"
                        >
                            <Trash2 className="w-4 h-4 text-gray-700" />
                        </button>
                    </div>
                ))}

                {/* ===============================
                    항목 추가 버튼
                =============================== */}
                <button onClick={addChecklistItem} className="w-full py-3 border-2 border-dashed">
                    + 항목 추가
                </button>

                {/* ===============================
                    총 비용 표시
                =============================== */}
                <div className="text-right text-sm font-semibold sm:text-base">
                    총 경비: {totalCost.toLocaleString()}원
                </div>
            </div>
        </div>
    );
}
