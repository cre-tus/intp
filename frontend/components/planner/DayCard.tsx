import React from "react";
import { Calendar, Trash2, Plus, GripVertical } from "lucide-react";
import type { ItineraryDay, ItineraryActivity } from "./TravelItinerary";
import SortableActivityRow from "@/components/planner/Sortable/SortableActivityRow";
import {closestCenter, DndContext, DragEndEvent} from "@dnd-kit/core";
import {SortableContext, verticalListSortingStrategy} from "@dnd-kit/sortable";

type ActivityError = { message: string } | null;

type DragHandleProps = {
    attributes?: React.HTMLAttributes<HTMLElement>;
    listeners?: React.HTMLAttributes<HTMLElement>;
    setActivatorNodeRef?: (el: HTMLElement | null) => void;
};

export default function DayCard(props: {
    day: ItineraryDay;
    dayIndex: number;
    timeErrors: Record<string, ActivityError>;

    registerDateRef: (dayId: string, el: HTMLInputElement | null) => void;
    registerTimeRef: (activityId: string, el: HTMLInputElement | null) => void;

    onFocusDate: (dayId: string) => void;
    onFocusTime: (activityId: string) => void;

    onRemoveDay: (dayId: string) => void;
    onUpdateDayTitle: (dayId: string, title: string) => void;
    onUpdateDayDate: (dayId: string, date: string) => void;

    onAddActivity: (dayId: string) => void;
    onRemoveActivity: (dayId: string, activityId: string) => void;

    onUpdateActivityField: (
        dayId: string,
        activityId: string,
        field: keyof ItineraryActivity,
        value: string | number
    ) => void;

    onSetActivityTime: (dayId: string, activityId: string, nextTime: string) => void;
    onClearTimeError: (activityId: string) => void;

    dragHandleProps?: DragHandleProps;
    onReorderActivities: (dayId: string, oldIndex: number, newIndex: number) => void;

}) {
    const { day, dayIndex } = props;
    const dayCost = day.activities.reduce((sum, a) => sum + (a.cost || 0), 0);


    const handleActivityDragEnd = (event: DragEndEvent) => {
        const {active, over} = event;
        if (!over || active.id === over.id) return;

        // 현재 day.activities에서만 reorder해야 함
        const oldIndex = day.activities.findIndex((a) => a.id === active.id);
        const newIndex = day.activities.findIndex((a) => a.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return;

        props.onReorderActivities(day.id, oldIndex, newIndex);

    }

    return (
        <div
            className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:border-gray-300">
            {/* Day Header */}
            <div
                className="bg-gradient-to-r from-gray-900 to-gray-800 px-5 py-4 flex items-center gap-3 group relative overflow-hidden">
                <div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"/>

                {/* 드래그 핸들 */}
                <button
                    type="button"
                    ref={(el) => props.dragHandleProps?.setActivatorNodeRef?.(el)}
                    {...(props.dragHandleProps?.attributes ?? {})}
                    {...(props.dragHandleProps?.listeners ?? {})}
                    className="p-2 rounded-lg hover:bg-white/20 cursor-grab active:cursor-grabbing z-10"
                    aria-label="일정 순서 변경"
                >
                    <GripVertical className="w-5 h-5 text-white"/>
                </button>

                {/* Day title (한 번만) */}
                <input
                    type="text"
                    value={day.dayTitle}
                    onChange={(e) => props.onUpdateDayTitle(day.id, e.target.value)}
                    className="flex-shrink-0 w-32 px-3 py-2 border-2 border-white/20 rounded-lg bg-white/10 backdrop-blur-sm text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 focus:bg-white/20 transition-all z-10 font-semibold"
                />

                {/* Date */}
                <div className="flex items-center gap-2 flex-1 z-10">
                    <button
                        onClick={() => props.onFocusDate(day.id)}
                        className="flex-shrink-0 hover:bg-white/20 p-2 rounded-lg transition-all hover:scale-110"
                        type="button"
                    >
                        <Calendar className="w-4 h-4 text-white cursor-pointer"/>
                    </button>

                    <input
                        ref={(el) => props.registerDateRef(day.id, el)}
                        type="date"
                        value={day.date}
                        onChange={(e) => props.onUpdateDayDate(day.id, e.target.value)}
                        className="no-date-picker bg-transparent text-white focus:outline-none placeholder-white/60"
                    />
                </div>

                {/* Delete day */}
                <button
                    onClick={() => props.onRemoveDay(day.id)}
                    className="flex-shrink-0 p-2 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded-lg transition-all hover:scale-110 z-10"
                    type="button"
                >
                    <Trash2 className="w-5 h-5 text-white"/>
                </button>
            </div>

            {/* Activities (헤더 밖!) */}
            <div className="p-5 space-y-3 bg-gradient-to-b from-white to-gray-50">
                <DndContext collisionDetection={closestCenter} onDragEnd={handleActivityDragEnd}>
                    <SortableContext
                        items={day.activities.map((a) => a.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {day.activities.map((activity, idx) => (
                            <SortableActivityRow
                                key={activity.id}
                                dayId={day.id}
                                activity={activity}
                                index={idx}
                                error={props.timeErrors[activity.id]}
                                registerTimeRef={props.registerTimeRef}
                                onFocusTime={props.onFocusTime}
                                onRemove={() => props.onRemoveActivity(day.id, activity.id)}
                                onChangeField={(field, value) =>
                                    props.onUpdateActivityField(day.id, activity.id, field, value)
                                }
                                onChangeTime={(next) => props.onSetActivityTime(day.id, activity.id, next)}
                                onClearTimeError={props.onClearTimeError}

                            />
                        ))}
                    </SortableContext>
                </DndContext>


                <button
                    onClick={() => props.onAddActivity(day.id)}
                    className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-900 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 transition-all flex items-center justify-center gap-2 text-gray-600 hover:text-gray-900 group"
                    type="button"
                >
                    <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300"/>
                    <span className="font-semibold">일정 추가</span>
                </button>

                {day.activities.length > 0 && (
                    <div
                        className="text-right pt-3 mt-3 border-t-2 border-gray-200 bg-gradient-to-r from-transparent to-gray-100 -mx-5 px-5 py-3">
            <span className="text-sm text-gray-600 font-medium">
              Day {dayIndex + 1} 총 경비:
            </span>
                        <span className="font-bold text-xl text-gray-900 ml-2">
              {dayCost.toLocaleString()}
            </span>
                        <span className="text-sm text-gray-600 ml-1">원</span>
                    </div>
                )}
            </div>
        </div>
    );
}
