"use client";

import React, { useRef, useState } from "react";
import SortableDayCard from "@/components/planner/Sortable/SortableDayCard";
import { closestCenter, DndContext, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import MapRoutePanel from "@/components/planner/MapRoutePanel";

export interface ItineraryActivity {
    id: string;
    time: string;
    location: string;
    activity: string;
    cost: number;
    placeId?: string;
    placeSubtitle?: string;
    lat?: number;
    lon?: number;
    routeRole?: "NONE" | "LODGING" | "START" | "END" | "FIXED";
}

export interface ItineraryDay {
    id: string;
    date: string;
    dayTitle: string;
    activities: ItineraryActivity[];
}

type ActivityError = { message: string } | null;

const timeToMinutes = (value: string) => {
    const [hh, mm] = value.split(":").map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
    return hh * 60 + mm;
};

const validateActivityTime = (
    day: ItineraryDay,
    idx: number,
    nextTime: string,
    minGapMinutes = 1
): { ok: boolean; message?: string } => {
    if (!nextTime) return { ok: true };

    const nextMin = timeToMinutes(nextTime);
    if (nextMin === null) return { ok: false, message: "시간 형식이 올바르지 않습니다." };

    if (idx > 0) {
        const prevTime = day.activities[idx - 1]?.time ?? "";
        const prevMin = prevTime ? timeToMinutes(prevTime) : null;
        if (prevMin !== null && nextMin < prevMin + minGapMinutes) {
            return { ok: false, message: "앞 일정 시간보다 뒤여야 합니다." };
        }
    }

    if (idx < day.activities.length - 1) {
        const afterTime = day.activities[idx + 1]?.time ?? "";
        const afterMin = afterTime ? timeToMinutes(afterTime) : null;
        if (afterMin !== null && nextMin > afterMin - minGapMinutes) {
            return { ok: false, message: "다음 일정 시간보다 앞이어야 합니다." };
        }
    }

    return { ok: true };
};

export default function TravelItinerary({
    days,
    setDays,
    title,
    setTitle,
}: {
    days: ItineraryDay[];
    setDays: React.Dispatch<React.SetStateAction<ItineraryDay[]>>;
    title: string;
    setTitle: React.Dispatch<React.SetStateAction<string>>;
}) {
    const [timeErrors, setTimeErrors] = useState<Record<string, ActivityError>>({});
    const dateInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
    const timeInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

    const addDay = () => {
        setDays((prev) => [
            ...prev,
            { id: crypto.randomUUID(), date: "", dayTitle: `Day ${prev.length + 1}`, activities: [] },
        ]);
    };

    const removeDay = (dayId: string) => {
        setDays((prev) => prev.filter((day) => day.id !== dayId));
        dateInputRefs.current.delete(dayId);
    };

    const updateDayTitle = (dayId: string, dayTitle: string) => {
        setDays((prev) => prev.map((day) => (day.id === dayId ? { ...day, dayTitle } : day)));
    };

    const updateDayDate = (dayId: string, date: string) => {
        setDays((prev) => prev.map((day) => (day.id === dayId ? { ...day, date } : day)));
    };

    const addActivity = (dayId: string) => {
        const newActivity: ItineraryActivity = {
            id: crypto.randomUUID(),
            time: "",
            location: "",
            activity: "",
            cost: 0,
        };
        setDays((prev) =>
            prev.map((day) => (day.id === dayId ? { ...day, activities: [...day.activities, newActivity] } : day))
        );
    };

    const removeActivity = (dayId: string, activityId: string) => {
        timeInputRefs.current.delete(activityId);
        setTimeErrors((prev) => {
            if (!prev[activityId]) return prev;
            const copy = { ...prev };
            delete copy[activityId];
            return copy;
        });
        setDays((prev) =>
            prev.map((day) =>
                day.id === dayId
                    ? { ...day, activities: day.activities.filter((activity) => activity.id !== activityId) }
                    : day
            )
        );
    };

    const updateActivityField = (
        dayId: string,
        activityId: string,
        field: keyof ItineraryActivity,
        value: string | number
    ) => {
        setDays((prev) =>
            prev.map((day) =>
                day.id === dayId
                    ? {
                        ...day,
                        activities: day.activities.map((activity) =>
                            activity.id === activityId ? { ...activity, [field]: value } : activity
                        ),
                    }
                    : day
            )
        );
    };

    const setTimeForActivity = (dayId: string, activityId: string, nextTime: string) => {
        const day = days.find((item) => item.id === dayId);
        if (!day) return;
        const idx = day.activities.findIndex((activity) => activity.id === activityId);
        if (idx === -1) return;

        const result = validateActivityTime(day, idx, nextTime, 1);
        if (!result.ok) {
            setTimeErrors((prev) => ({
                ...prev,
                [activityId]: { message: result.message ?? "시간 입력이 올바르지 않습니다." },
            }));
            return;
        }

        setTimeErrors((prev) => {
            if (!prev[activityId]) return prev;
            const copy = { ...prev };
            delete copy[activityId];
            return copy;
        });
        updateActivityField(dayId, activityId, "time", nextTime);
    };

    const focusDate = (dayId: string) => {
        const element = dateInputRefs.current.get(dayId);
        element?.focus();
        element?.showPicker?.();
    };

    const focusTime = (activityId: string) => {
        const element = timeInputRefs.current.get(activityId);
        element?.focus();
        element?.showPicker?.();
    };

    const clearTimeError = (activityId: string) => {
        setTimeErrors((prev) => {
            if (!prev[activityId]) return prev;
            const copy = { ...prev };
            delete copy[activityId];
            return copy;
        });
    };

    const handleDayDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        setDays((prev) => {
            const oldIndex = prev.findIndex((day) => day.id === active.id);
            const newIndex = prev.findIndex((day) => day.id === over.id);
            if (oldIndex < 0 || newIndex < 0) return prev;
            return arrayMove(prev, oldIndex, newIndex);
        });
    };

    const reorderActivities = (dayId: string, oldIndex: number, newIndex: number) => {
        setDays((prev) =>
            prev.map((day) =>
                day.id === dayId
                    ? { ...day, activities: arrayMove(day.activities, oldIndex, newIndex) }
                    : day
            )
        );
    };

    const totalCost = days.reduce(
        (acc, day) => acc + day.activities.reduce((sum, activity) => sum + (activity.cost || 0), 0),
        0
    );

    return (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
            <div className="relative overflow-hidden bg-gradient-to-r from-black via-gray-900 to-black px-6 py-5">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                <input
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="relative z-10 w-full rounded bg-transparent px-2 py-1 text-2xl font-bold tracking-tight text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                />
            </div>

            <div className="space-y-6 bg-gradient-to-b from-gray-50 to-white p-6">
                <DndContext collisionDetection={closestCenter} onDragEnd={handleDayDragEnd}>
                    <SortableContext items={days.map((day) => day.id)} strategy={verticalListSortingStrategy}>
                        {days.map((day, dayIndex) => (
                            <SortableDayCard
                                key={day.id}
                                day={day}
                                dayIndex={dayIndex}
                                timeErrors={timeErrors}
                                registerDateRef={(dayId, element) => {
                                    if (!element) dateInputRefs.current.delete(dayId);
                                    else dateInputRefs.current.set(dayId, element);
                                }}
                                registerTimeRef={(activityId, element) => {
                                    if (!element) timeInputRefs.current.delete(activityId);
                                    else timeInputRefs.current.set(activityId, element);
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
                    className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-400 py-5 text-gray-600 shadow-sm transition-all hover:border-gray-900 hover:bg-gray-50 hover:text-gray-900 hover:shadow-md"
                    type="button"
                >
                    <span className="text-lg font-bold">Day 추가</span>
                </button>

                {days.length > 0 && (
                    <div className="-mx-6 mt-4 border-t-2 border-gray-900 bg-gradient-to-r from-gray-900 to-gray-800 px-6 py-6">
                        <div className="text-right">
                            <span className="text-lg font-medium text-gray-300">전체 총 경비: </span>
                            <span className="ml-2 text-3xl font-bold tracking-tight text-white">
                                {totalCost.toLocaleString()}
                            </span>
                            <span className="ml-1 text-lg text-gray-300">원</span>
                        </div>
                    </div>
                )}

                <MapRoutePanel days={days} />
            </div>
        </div>
    );
}
