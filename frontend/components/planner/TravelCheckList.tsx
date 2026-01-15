"use client";

import React, {useState} from 'react';
import { Plus, Trash2, CheckSquare, Square } from 'lucide-react';


interface ChecklistItem {
    id: number; // 각 항목의 고유 식별자
    text: string; // 준비물 항목 내용
    checked: boolean // 체크여부 (true, false)
    cost: number; // 준비물 경비 (원 단위)
}

export default function TravelCheckList() {
    //체크리스트 상태 관리
    const [checklist, setChecklist] = useState<ChecklistItem[]>([]);

    //체크리스트 항목 추가
    const addChecklistItem = () => {
        const newItem: ChecklistItem = {
            id: Date.now(),
            text: '',
            checked: false,
            cost: 0
        };
        setChecklist([...checklist, newItem]);
    };

    //체크리스트 항목 삭제
    const removeChecklistItem = (itemId:number) => {
        setChecklist(checklist.filter((item) => itemId !== itemId));
    };

    //체크리스트 항목 삭제
    const toggleChecklistItem = (itemId:number) => {
        setChecklist(checklist.map(item =>
         item.id === itemId? {...item, checked: !item.checked} : item
        ));
    }

    // 체크리스트 항목 텍스트 수정
    const updateChecklistItem = (itemId: number, text: string) => {
        setChecklist(checklist.map(item =>
            item.id === itemId ? { ...item, text } : item
        ));
    };

    // 체크리스트 항목 경비 수정
    const updateChecklistItemCost = (itemId: number, cost: number) => {
        setChecklist(checklist.map(item =>
            item.id === itemId ? { ...item, cost } : item
        ));
    };

    // 총 경비 계산
    const totalCost = checklist.reduce((sum, item) => sum + (item.cost || 0), 0);

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-y-hidden">
            {/* 체크리스트 헤더 */}
            <div className="bg-gradient-to-r from-gray-700 to-gray-900 px-6 py-4">
                <h2 className="font-[var(--font-paperlogy)] font-bold text-2xl font-bold text-white">여행 전 준비물</h2>
            </div>
            <div className="p-6 space-y-3">
                {checklist.map((item) => (
                    <div key={item.id} className="flex item-center gap-3 group">
                        {/*체크박스 버튼 */}
                        <button
                            onClick={() => toggleChecklistItem(item.id)}
                            className="flex-shrink-0"
                        >
                            {item.checked ? (
                                <CheckSquare className="w-5 h-5 text-gray-900"/>
                            ) : (
                                <Square className="w-5 h-5 text-gray-400"/>
                            )}
                        </button>
                        {/* 준비물 항목 입력 필드 */}
                        <input
                            type="text"
                            value={item.text}
                            onChange={(e) => updateChecklistItem(item.id, e.target.value)}
                            placeholder="항목 입력"
                            className={`flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 ${
                                item.checked ? 'line-through text-gray-400' : ''
                            }`}
                        />
                        {/* 준비물 경비 입력 필드 */}
                        <input
                            type="number"
                            value={item.cost}
                            onChange={(e) => updateChecklistItemCost(item.id, parseFloat(e.target.value))}
                            placeholder="경비 입력 (원)"
                            className={`flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 ${
                                item.checked ? 'line-through text-gray-400' : ''
                            }`}
                        />

                        {/* 삭제 버튼 (호버 시 표시) */}
                        <button
                            onClick={() => removeChecklistItem(item.id)}
                            className="flex-shrink-0 p-2 opacity-0 group-hover:opacity-100 hover:bg-gray-100 rounded-lg transition-all"
                        >
                            <Trash2 className="w-4 h-4 text-gray-700" />
                        </button>
                    </div>
                ))}

                {/* 항목 추가 버튼 */}
                <button
                    onClick={addChecklistItem}
                    className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-900 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 text-gray-600 hover:text-gray-900"
                >
                    <Plus className="w-5 h-5" />
                    <span>항목 추가</span>
                </button>

                {/* 총 경비 표시 */}
                <div className="mt-4 text-right">
                    <span className="text-gray-500">총 경비: </span>
                    <span className="font-bold text-gray-900">{totalCost.toLocaleString()}원</span>
                </div>
            </div>
        </div>
    );
}