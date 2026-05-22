import React from "react";
import { Calendar, GripVertical, Plus, Trash2 } from "lucide-react";
import type { ItineraryActivity, ItineraryDay } from "./TravelItinerary";
import SortableActivityRow from "@/components/planner/Sortable/SortableActivityRow";
import { closestCenter, DndContext, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

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
        value: string | number,
    ) => void;
    onSetActivityTime: (dayId: string, activityId: string, nextTime: string) => void;
    onClearTimeError: (activityId: string) => void;
    onReorderActivities: (dayId: string, oldIndex: number, newIndex: number) => void;
    dragHandleProps?: DragHandleProps;
    paidPlaces?: boolean;
    planId?: string;
}) {
    const { day, dayIndex } = props;
    const dayCost = day.activities.reduce((sum, activity) => sum + (activity.cost || 0), 0);

    const handleActivityDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = day.activities.findIndex((activity) => activity.id === active.id);
        const newIndex = day.activities.findIndex((activity) => activity.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return;
        props.onReorderActivities(day.id, oldIndex, newIndex);
    };

    return (
        <div className="min-w-0 overflow-hidden rounded-xl border-2 border-gray-200 bg-white shadow-md transition-all duration-300 hover:border-gray-300 hover:shadow-xl">
            <div className="group relative grid min-w-0 gap-3 overflow-hidden bg-gradient-to-r from-gray-900 to-gray-800 px-4 py-4 sm:grid-cols-[auto_minmax(0,180px)_minmax(0,1fr)_auto] sm:items-center sm:px-5">
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                <button
                    type="button"
                    ref={(el) => props.dragHandleProps?.setActivatorNodeRef?.(el)}
                    {...(props.dragHandleProps?.attributes ?? {})}
                    {...(props.dragHandleProps?.listeners ?? {})}
                    className="z-10 w-fit cursor-grab rounded-lg p-2 hover:bg-white/20 active:cursor-grabbing"
                    aria-label="일정 순서 변경"
                >
                    <GripVertical className="h-5 w-5 text-white" />
                </button>

                <input
                    type="text"
                    value={day.dayTitle}
                    onChange={(event) => props.onUpdateDayTitle(day.id, event.target.value)}
                    className="z-10 min-w-0 rounded-lg border-2 border-white/20 bg-white/10 px-3 py-2 font-semibold text-white backdrop-blur-sm transition-all placeholder-white/60 focus:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
                />

                <div className="z-10 flex min-w-0 items-center gap-2">
                    <button
                        onClick={() => props.onFocusDate(day.id)}
                        className="flex-shrink-0 rounded-lg p-2 transition-all hover:scale-110 hover:bg-white/20"
                        type="button"
                        aria-label="날짜 선택"
                    >
                        <Calendar className="h-4 w-4 cursor-pointer text-white" />
                    </button>

                    <input
                        ref={(el) => props.registerDateRef(day.id, el)}
                        type="date"
                        value={day.date}
                        onChange={(event) => props.onUpdateDayDate(day.id, event.target.value)}
                        className="no-date-picker min-w-0 flex-1 bg-transparent text-white placeholder-white/60 focus:outline-none"
                    />
                </div>

                <button
                    onClick={() => props.onRemoveDay(day.id)}
                    className="z-10 w-fit rounded-lg p-2 text-white transition-all hover:scale-110 hover:bg-red-500/20 sm:justify-self-end sm:opacity-0 sm:group-hover:opacity-100"
                    type="button"
                    aria-label="일정 삭제"
                >
                    <Trash2 className="h-5 w-5" />
                </button>
            </div>

            <div className="space-y-3 bg-gradient-to-b from-white to-gray-50 p-3 sm:p-5">
                <DndContext collisionDetection={closestCenter} onDragEnd={handleActivityDragEnd}>
                    <SortableContext items={day.activities.map((activity) => activity.id)} strategy={verticalListSortingStrategy}>
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
                                paidPlaces={props.paidPlaces}
                                planId={props.planId}
                            />
                        ))}
                    </SortableContext>
                </DndContext>

                <button
                    onClick={() => props.onAddActivity(day.id)}
                    className="group flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 py-3 text-gray-600 transition-all hover:border-gray-900 hover:bg-gray-50 hover:text-gray-900"
                    type="button"
                >
                    <Plus className="h-5 w-5 transition-transform duration-300 group-hover:rotate-90" />
                    <span className="font-semibold">일정 추가</span>
                </button>

                {day.activities.length > 0 && (
                    <div className="-mx-3 mt-3 border-t-2 border-gray-200 bg-gradient-to-r from-transparent to-gray-100 px-3 py-3 text-right sm:-mx-5 sm:px-5">
                        <span className="text-sm font-medium text-gray-600">Day {dayIndex + 1} 총 경비:</span>
                        <span className="ml-2 text-xl font-bold text-gray-900">{dayCost.toLocaleString()}</span>
                        <span className="ml-1 text-sm text-gray-600">원</span>
                    </div>
                )}
            </div>
        </div>
    );
}
