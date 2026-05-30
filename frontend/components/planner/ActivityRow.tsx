import React, { useState, useRef, useEffect } from "react";
import type { ItineraryActivity } from "./TravelItinerary";
import TimeField from "@/components/planner/ActivityField/TimeField";
import LocationField from "@/components/planner/ActivityField/LocationField";
import ActivityField from "@/components/planner/ActivityField/ActivityField";
import CostField from "@/components/planner/ActivityField/CostField";
import DeleteButton from "@/components/planner/ActivityField/DeleteButton";
import PlaceSearchModal from "@/components/planner/ActivityField/PlaceSerachModal";
import { Pin, ChevronUp, ChevronDown } from "lucide-react";

type ActivityError = { message: string } | null;

type DragHandleProps = {
    attributes?: React.HTMLAttributes<HTMLElement>;
    listeners?: React.HTMLAttributes<HTMLElement>;
    setActivatorNodeRef?: (el: HTMLElement | null) => void;
};

export default function ActivityRow(props: {
    dayId: string;
    activity: ItineraryActivity;
    index: number;
    error: ActivityError;
    registerTimeRef: (activityId: string, el: HTMLInputElement | null) => void;
    onFocusTime: (activityId: string) => void;
    onRemove: () => void;
    onChangeTime: (next: string) => void;
    onChangeField: (field: keyof ItineraryActivity, value: string | number) => void;
    onClearTimeError: (activityId: string) => void;
    dragHandleProps?: DragHandleProps;
    paidPlaces?: boolean;
    planId?: string;
    onReorderActivities?: (dayId: string, oldIndex: number, newIndex: number) => void;
    totalActivities?: number;
}) {
    const { activity, index, error } = props;
    const [placeOpen, setPlaceOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!menuOpen) return;
        const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleOutsideClick);
        document.addEventListener("touchstart", handleOutsideClick);
        return () => {
            document.removeEventListener("mousedown", handleOutsideClick);
            document.removeEventListener("touchstart", handleOutsideClick);
        };
    }, [menuOpen]);

    return (
        <div className="group grid min-w-0 gap-3 rounded-lg border border-gray-200 bg-white p-3 transition-all hover:border-gray-900 hover:shadow-md sm:grid-cols-[auto_minmax(0,130px)_minmax(0,1fr)_minmax(0,140px)_minmax(0,1fr)_minmax(0,120px)_auto] sm:items-center">
            <div className="relative flex-shrink-0">
                <button
                    type="button"
                    ref={(el) => props.dragHandleProps?.setActivatorNodeRef?.(el)}
                    {...(props.dragHandleProps?.attributes ?? {})}
                    {...(props.dragHandleProps?.listeners ?? {})}
                    onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(!menuOpen);
                    }}
                    className="flex h-8 w-8 cursor-grab select-none items-center justify-center rounded-full bg-gradient-to-br from-gray-900 to-gray-700 text-sm font-bold text-white shadow-sm active:cursor-grabbing hover:from-gray-850 hover:to-gray-650 transition-all hover:scale-105 active:scale-95"
                    aria-label="일정 순서 변경"
                >
                    {index + 1}
                </button>
                {menuOpen && (
                    <div
                        ref={popoverRef}
                        className="absolute bottom-full left-1/2 z-50 mb-3 w-28 -translate-x-1/2 rounded-xl border border-gray-200 bg-white/95 p-1 shadow-lg shadow-gray-200/50 backdrop-blur-md"
                        style={{
                            animation: "popover-in 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
                            transformOrigin: "bottom center",
                        }}
                    >
                        <style>{`
                            @keyframes popover-in {
                                from {
                                    opacity: 0;
                                    transform: translate(-50%, 8px) scale(0.95);
                                }
                                to {
                                    opacity: 1;
                                    transform: translate(-50%, 0) scale(1);
                                }
                            }
                        `}</style>
                        <div className="flex flex-col gap-0.5">
                            <button
                                type="button"
                                disabled={index === 0}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (index > 0 && props.onReorderActivities) {
                                        props.onReorderActivities(props.dayId, index, index - 1);
                                    }
                                    setMenuOpen(false);
                                }}
                                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold transition-all ${
                                    index === 0
                                        ? "text-gray-300 cursor-not-allowed opacity-50"
                                        : "text-gray-700 hover:bg-gray-50 hover:text-indigo-600 active:scale-95"
                                }`}
                            >
                                <ChevronUp className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                                <span>위로 이동</span>
                            </button>
                            <button
                                type="button"
                                disabled={props.totalActivities !== undefined && index === props.totalActivities - 1}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (
                                        props.totalActivities !== undefined &&
                                        index < props.totalActivities - 1 &&
                                        props.onReorderActivities
                                    ) {
                                        props.onReorderActivities(props.dayId, index, index + 1);
                                    }
                                    setMenuOpen(false);
                                }}
                                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold transition-all ${
                                    props.totalActivities !== undefined && index === props.totalActivities - 1
                                        ? "text-gray-300 cursor-not-allowed opacity-50"
                                        : "text-gray-700 hover:bg-gray-50 hover:text-violet-600 active:scale-95"
                                }`}
                            >
                                <ChevronDown className="h-4 w-4 text-violet-500 flex-shrink-0" />
                                <span>아래로 이동</span>
                            </button>
                        </div>
                        {/* Triangle Arrow */}
                        <div className="absolute top-full left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 border-b border-r border-gray-200 bg-white/95" />
                    </div>
                )}
            </div>

            <TimeField
                activityId={activity.id}
                value={activity.time}
                error={error}
                registerRef={props.registerTimeRef}
                onFocusPicker={props.onFocusTime}
                onChange={props.onChangeTime}
                onClearError={() => props.onClearTimeError(activity.id)}
            />

            <LocationField value={activity.location} onOpen={() => setPlaceOpen(true)} />

            <div className="flex min-w-0 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <Pin className="h-4 w-4 flex-shrink-0 text-gray-600" />
                <select
                    value={activity.routeRole ?? "NONE"}
                    onChange={(event) => props.onChangeField("routeRole", event.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-sm font-medium text-gray-800 focus:outline-none"
                    title="경로 고정"
                >
                    <option value="NONE">일반</option>
                    <option value="LODGING">숙소 왕복</option>
                    <option value="START">출발 고정</option>
                    <option value="END">도착 고정</option>
                    <option value="FIXED">예약 고정</option>
                </select>
            </div>

            <PlaceSearchModal
                open={placeOpen}
                onClose={() => setPlaceOpen(false)}
                initialQuery={activity.location}
                paidPlaces={props.paidPlaces}
                planId={props.planId}
                onSelect={(place) => {
                    props.onChangeField("location", place.title);
                    props.onChangeField("placeId", place.id);
                    props.onChangeField("placeSubtitle", place.subtitle);
                    props.onChangeField("lat", place.lat);
                    props.onChangeField("lon", place.lon);
                    setPlaceOpen(false);
                }}
            />

            <ActivityField value={activity.activity} onChange={(next) => props.onChangeField("activity", next)} />
            <CostField value={activity.cost} onChange={(next) => props.onChangeField("cost", next)} />
            <DeleteButton onClick={props.onRemove} />
        </div>
    );
}
