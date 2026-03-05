"use client";

import React, { useRef, useState } from "react";
import SortableDayCard from "@/components/planner/Sortable/SortableDayCard";
import {closestCenter, DndContext, DragEndEvent} from "@dnd-kit/core";
import {arrayMove, SortableContext, verticalListSortingStrategy} from "@dnd-kit/sortable";

{ /* 데이터 타입 */ }
export interface ItineraryActivity {
    id: string; // 활동 테이블 고유 ID
    time: string; // 활동 시간 (HH : MM)
    location: string; // 장소
    activity: string; // 활동 내용
    cost: number; //비용
}

export interface ItineraryDay {
    id: string; // 일정 테이블 고유 ID
    date: string; // 날짜 ( YYYY-MM-DD )
    dayTitle: string; // 날짜 제목 ( 첫째날 or Day 1) 등
    activities: ItineraryActivity[]; //Day의 Activity 목록들
}

{ /* 시간 에러 타입 */ }
type ActivityError =
    | { message: string } // 시간 검증 실패 시 메세지
    | null;

{/* 유틸 함수: 시간 → 분 단위 변환 */}
const timeToMinutes = (t: string) => {
    const [hh, mm] = t.split(":").map(Number);

    { /* 형식이 잘못된 경우 */ }
    if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
    return hh * 60 + mm;
};

{ /* 시간 검증 로직 */ }
const validateActivityTime = (
    day: ItineraryDay, // 현재 Day
    idx: number, // 현재 activity index
    nextTime: string, // 입력하려는 시간
    minGapMinutes = 1 // 앞/뒤 활동 시간과의 최소 간격 (분)
): { ok: boolean; message?: string } => {

    { /* 비어있는 시간은 허용 */ }
    if (!nextTime) return { ok: true };

    const nextMin = timeToMinutes(nextTime);
    if (nextMin === null) return { ok: false, message: "시간 형식이 잘못되었습니다" };

    {/* 앞 활동과 비교 */}
    if (idx > 0) {
        const prevTime = day.activities[idx - 1]?.time ?? "";
        const prevMin = prevTime ? timeToMinutes(prevTime) : null;
        if (prevMin !== null && nextMin < prevMin + minGapMinutes) {
            return {
                ok: false,
                message: ` 앞선 일정의 시간보다 이전이어야 합니다.`,
            };
        }
    }

    {/* 뒤 활동과 비교 (이미 시간이 입력된 경우) */}
    if (idx < day.activities.length - 1) {
        const afterTime = day.activities[idx + 1]?.time ?? "";
        const afterMin = afterTime ? timeToMinutes(afterTime) : null;
        if (afterMin !== null && nextMin > afterMin - minGapMinutes) {
            return {
                ok: false,
                message: ` 앞선 일정의 시간보다 이후여야 합니다.`,
            };
        }
    }

    return { ok: true };
};

{ /* 메인 컴포넌트 */}
export default function TravelItinerary() {

    {/* 전체 Day 목록 상태 */}
    const [days, setDays] = useState<ItineraryDay[]>([]);

    {/* 일정표 제목 */}
    const [title, setTitle] = useState("✈️ 여행 일정표");

    {/* 활동 시간 검증 에러 (activityId 기준) */}
    const [timeErrors, setTimeErrors] = useState<Record<string, ActivityError>>({});

    {/* Day 날짜 input ref 저장 */}
    const dateInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

    {/* Activity 시간 input ref 저장 */}
    const timeInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

    {/* Day 관련 함수 */}
    {/* 새로운 Day 추가 */}
    const addDay = () => {
        setDays((prev) => [
            ...prev,
            { id: crypto.randomUUID(), date: "", dayTitle: `Day ${prev.length + 1}`, activities: [] },
        ]);
    };

    const removeDay = (dayId: string) => {
        {/* Day 삭제 */}
        setDays((prev) => prev.filter((d) => d.id !== dayId));

        {/* 날짜 input ref 정리 */}
        dateInputRefs.current.delete(dayId);
    };

    {/* Day 제목 수정 */}
    const updateDayTitle = (dayId: string, dayTitle: string) => {
        setDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, dayTitle } : d)));
    };

    {/* Day 날짜 수정 */}
    const updateDayDate = (dayId: string, date: string) => {
        setDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, date } : d)));
    };

    {/* Activity 관련 함수 */}
    {/* Day에 활동 추가 */}
    const addActivity = (dayId: string) => {
        const newAct = { id: crypto.randomUUID(), time: "", location: "", activity: "", cost: 0 };
        setDays((prev) =>
            prev.map((d) => (d.id === dayId ? { ...d, activities: [...d.activities, newAct] } : d))
        );
    };

    {/* 시간 input ref 제거 */}
    const removeActivity = (dayId: string, activityId: string) => {
        timeInputRefs.current.delete(activityId);

        {/* 시간 에러 제거 */}
        setTimeErrors((prev) => {
            if (!prev[activityId]) return prev;
            const copy = { ...prev };
            delete copy[activityId];
            return copy;
        });

        {/* 활동 삭제 */}
        setDays((prev) =>
            prev.map((d) =>
                d.id === dayId ? { ...d, activities: d.activities.filter((a) => a.id !== activityId) } : d
            )
        );
    };

    {/* 활동 필드(time 제외) 수정 */}
    const updateActivityField = (
        dayId: string,
        activityId: string,
        field: keyof ItineraryActivity,
        value: string | number
    ) => {
        setDays((prev) =>
            prev.map((d) =>
                d.id === dayId
                    ? {
                        ...d,
                        activities: d.activities.map((a) => (a.id === activityId ? { ...a, [field]: value } : a)),
                    }
                    : d
            )
        );
    };

    {/*  시간 설정 + 검증 핵심 로직 */}
    const setTimeForActivity = (dayId: string, activityId: string, nextTime: string) => {
        const day = days.find((d) => d.id === dayId);
        if (!day) return;
        const idx = day.activities.findIndex((a) => a.id === activityId);
        if (idx === -1) return;

        const result = validateActivityTime(day, idx, nextTime, 1);
        if (!result.ok) {
            {/* 에러 메시지 저장 (값은 유지) */}
            setTimeErrors((prev) => ({
                ...prev,
                [activityId]: { message: result.message ?? "시간 입력이 잘못되었습니다" },
            }));
            return;
        }

        {/* 정상 입력 → 에러 제거 */}
        setTimeErrors((prev) => {
            if (!prev[activityId]) return prev;
            const copy = { ...prev };
            delete copy[activityId];
            return copy;
        });

        updateActivityField(dayId, activityId, "time", nextTime);
    };

    {/* input 포커스 제어 */}
    const focusDate = (dayId: string) => {
        const el = dateInputRefs.current.get(dayId);
        el?.focus();
        el?.showPicker?.();
    };

    {/* input 포커스 제어 */}
    const focusTime = (activityId: string) => {
        const el = timeInputRefs.current.get(activityId);
        el?.focus();
        el?.showPicker?.();
    };


    {/* 경비 계산 */}
    const totalCost = days.reduce(
        (acc, d) => acc + d.activities.reduce((s, a) => s + (a.cost || 0), 0),
        0
    );


    {/* 시간 에러 제거 (hover/focus 시) */}
    const clearTimeError = (activityId: string) => {
        setTimeErrors((prev) => {
            if (!prev[activityId]) return prev;
            const copy = { ...prev };
            delete copy[activityId];
            return copy;
        });
    };

    { /* 드래그 앤 드랍 이벤트 핸들러 */ }
    const handleDayDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        setDays((prev) => {
            const oldIndex = prev.findIndex((d) => d.id === active.id);
            const newIndex = prev.findIndex((d) => d.id === over.id);
            if (oldIndex < 0 || newIndex < 0) return prev;
            return arrayMove(prev, oldIndex, newIndex);
        });
    };

    { /* 활동 인덱스 재설정 */ }
    const reorderActivities = (dayId: string, oldIndex: number, newIndex: number) => {
        setDays((prev) =>
            prev.map((d) =>
                d.id === dayId
                    ? { ...d, activities: arrayMove(d.activities, oldIndex, newIndex) }
                    : d
            )
        );
    };


    return (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-black via-gray-900 to-black px-6 py-5 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full text-2xl font-bold text-white relative z-10 tracking-tight bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-white/30 rounded px-2 py-1 transition-all"
                />
            </div>

            <div className="p-6 space-y-6 bg-gradient-to-b from-gray-50 to-white">
                <DndContext collisionDetection={closestCenter} onDragEnd={handleDayDragEnd}>
                    <SortableContext
                        items={days.map((d) => d.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {days.map((day, dayIndex) => (
                            <SortableDayCard
                                key={day.id}
                                day={day}
                                dayIndex={dayIndex}
                                timeErrors={timeErrors}
                                registerDateRef={(dayId, el) => {
                                    if (!el) dateInputRefs.current.delete(dayId);
                                    else dateInputRefs.current.set(dayId, el);
                                }}
                                registerTimeRef={(activityId, el) => {
                                    if (!el) timeInputRefs.current.delete(activityId);
                                    else timeInputRefs.current.set(activityId, el);
                                }}
                                onFocusDate={focusDate}
                                onFocusTime={focusTime}
                                onRemoveDay={removeDay}
                                onUpdateDayTitle={updateDayTitle}
                                onUpdateDayDate={updateDayDate}
                                onAddActivity={addActivity}
                                onRemoveActivity={removeActivity}
                                onUpdateActivityField={updateActivityField}
                                onSetActivityTime={setTimeForActivity}
                                onClearTimeError={clearTimeError}
                                onReorderActivities={reorderActivities}

                            />
                        ))}
                    </SortableContext>
                </DndContext>

                <button
                    onClick={addDay}
                    className="w-full py-5 border-2 border-dashed border-gray-400 rounded-xl hover:border-gray-900 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 transition-all flex items-center justify-center gap-2 text-gray-600 hover:text-gray-900 group shadow-sm hover:shadow-md"
                    type="button"
                >
                    <span className="font-bold text-lg">Day 추가</span>
                </button>

                {days.length > 0 && (
                    <div className="pt-6 mt-4 border-t-2 border-gray-900 bg-gradient-to-r from-gray-900 to-gray-800 -mx-6 px-6 py-6 rounded-b-xl">
                        <div className="text-right">
                            <span className="text-lg text-gray-300 font-medium">전체 총 경비: </span>
                            <span className="text-3xl font-bold text-white ml-2 tracking-tight">
                {totalCost.toLocaleString()}
              </span>
                            <span className="text-lg text-gray-300 ml-1">원</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
