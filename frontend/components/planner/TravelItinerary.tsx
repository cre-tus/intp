"use client";

import React, { useEffect, useRef, useState } from "react";
import SortableDayCard from "@/components/planner/Sortable/SortableDayCard";
import { closestCenter, DndContext, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, Clock, FileSpreadsheet, GripVertical, MapPin, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import type { TravelCountryCode, TravelPlanDraft } from "@/lib/travelPlans";
import PlaceSearchModal from "@/components/planner/ActivityField/PlaceSerachModal";
import type { PlaceResult, PlaceSearchOrigin } from "@/components/planner/ActivityField/PlaceSerachInput";
import { createClientId } from "@/lib/ids";
import { DEFAULT_CURRENCY, formatCurrencyAmount, type CurrencyRate } from "@/lib/currency";

export interface ItineraryActivity {
    id: string;
    time: string;
    location: string;
    activity: string;
    cost: number;
    placeId?: string;
    placeSubtitle?: string;
    markerColor?: string;
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

export type SelectedCostCell = {
    key: string;
    dayTitle: string;
    rowLabel: string;
    amount: number;
};

type ActivityError = { message: string } | null;
const LODGING_ROW_KEY = "__lodging__";
const PLACE_SEARCH_COMMAND = "/장소검색";
const TIME_ROWS = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, "0")}:00`);
const DEFAULT_COST_ROWS = ["입장", "식사", "숙박", "교통", "기타"];
const ROUTE_MARKER_COLORS = [
    { label: "Blue", value: "#2563eb" },
    { label: "Sky", value: "#0284c7" },
    { label: "Cyan", value: "#0891b2" },
    { label: "Teal", value: "#0f766e" },
    { label: "Green", value: "#16a34a" },
    { label: "Lime", value: "#65a30d" },
    { label: "Yellow", value: "#ca8a04" },
    { label: "Rose", value: "#e11d48" },
    { label: "Pink", value: "#db2777" },
    { label: "Fuchsia", value: "#c026d3" },
    { label: "Amber", value: "#d97706" },
    { label: "Orange", value: "#ea580c" },
    { label: "Red", value: "#dc2626" },
    { label: "Violet", value: "#7c3aed" },
    { label: "Purple", value: "#9333ea" },
    { label: "Indigo", value: "#4f46e5" },
    { label: "Gray", value: "#4b5563" },
    { label: "Slate", value: "#334155" },
];

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
    template = "basic",
    tier = "FREE",
    planId,
    countryCode = "KR",
    preparationCost = 0,
    currency = DEFAULT_CURRENCY,
    onCostSelectionChange,
}: {
    days: ItineraryDay[];
    setDays: React.Dispatch<React.SetStateAction<ItineraryDay[]>>;
    title: string;
    setTitle: React.Dispatch<React.SetStateAction<string>>;
    template?: TravelPlanDraft["template"];
    tier?: TravelPlanDraft["tier"];
    planId?: string;
    countryCode?: TravelCountryCode;
    preparationCost?: number;
    currency?: CurrencyRate;
    onCostSelectionChange?: (cells: SelectedCostCell[]) => void;
}) {
    const [timeErrors, setTimeErrors] = useState<Record<string, ActivityError>>({});
    const [spreadsheetPlaceTarget, setSpreadsheetPlaceTarget] = useState<{
        dayId: string;
        rowKey: string;
        query: string;
        fixed: boolean;
        origin: PlaceSearchOrigin | null;
    } | null>(null);
    const [activityPlaceTarget, setActivityPlaceTarget] = useState<{
        dayId: string;
        activityId: string;
        query: string;
        origin: PlaceSearchOrigin | null;
    } | null>(null);
    const [selectedCostCellKeys, setSelectedCostCellKeys] = useState<Set<string>>(new Set());
    const [isCostCellDragging, setIsCostCellDragging] = useState(false);
    const costDragAnchorRef = useRef<{ dayId: string; rowKey: string } | null>(null);
    const costDragBaseSelectionRef = useRef<Set<string>>(new Set());
    const dateInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
    const timeInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

    const addDay = () => {
        setDays((prev) => [
            ...prev,
            { id: createClientId("day"), date: "", dayTitle: `Day ${prev.length + 1}`, activities: [] },
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
            id: createClientId("activity"),
            time: "",
            location: "",
            activity: "",
            cost: 0,
            markerColor: template === "route_sheet" ? ROUTE_MARKER_COLORS[0].value : undefined,
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

    const reorderRouteStops = (dayId: string, activeId: string, overId: string) => {
        setDays((prev) =>
            prev.map((day) => {
                if (day.id !== dayId) return day;
                const routeStops = day.activities.filter((activity) => !isRouteSheetFood(activity));
                const hiddenRows = day.activities.filter(isRouteSheetFood);
                const oldIndex = routeStops.findIndex((activity) => activity.id === activeId);
                const newIndex = routeStops.findIndex((activity) => activity.id === overId);
                if (oldIndex < 0 || newIndex < 0) return day;
                return { ...day, activities: [...arrayMove(routeStops, oldIndex, newIndex), ...hiddenRows] };
            })
        );
    };

    const addSpreadsheetDay = () => {
        setDays((prev) => {
            const rowKeys = spreadsheetRowKeys(prev);
            return [
                ...prev,
                {
                    id: createClientId("day"),
                    date: "",
                    dayTitle: `Day ${prev.length + 1}`,
                    activities: rowKeys.map((rowKey) => spreadsheetActivity(rowKey)),
                },
            ];
        });
    };

    const addSpreadsheetRow = () => {
        const label = window.prompt("추가할 행 이름을 입력하세요.");
        if (!label?.trim()) return;
        const rowKey = `__custom__:${createClientId("row")}:${label.trim()}`;
        setDays((prev) =>
            prev.map((day) => ({
                ...day,
                activities: [...day.activities, spreadsheetActivity(rowKey)],
            }))
        );
    };

    useEffect(() => {
        if (template !== "spreadsheet") {
            onCostSelectionChange?.([]);
            return;
        }
        const selected = Array.from(selectedCostCellKeys).flatMap((key) => {
            const [dayId, rowKey] = key.split("::");
            const day = days.find((item) => item.id === dayId);
            if (!day || !isSpreadsheetCostRow(rowKey)) return [];
            const activity = day.activities.find((item) => item.time === rowKey);
            return [{
                key,
                dayTitle: day.dayTitle,
                rowLabel: spreadsheetRowLabel(rowKey),
                amount: parseCostAmount(activity?.activity || activity?.location || ""),
            }];
        });
        onCostSelectionChange?.(selected);
    }, [days, onCostSelectionChange, selectedCostCellKeys, template]);

    const updateSpreadsheetCell = (dayId: string, rowKey: string, value: string) => {
        const isCostRow = isSpreadsheetCostRow(rowKey);
        const nextValue = isCostRow ? formatCostInput(value) : value;
        const nextCost = isCostRow ? parseCostAmount(nextValue) : 0;
        setDays((prev) =>
            prev.map((day) => {
                if (day.id !== dayId) return day;
                const exists = day.activities.some((activity) => activity.time === rowKey);
                const patch = {
                    activity: nextValue,
                    location: nextValue,
                    cost: nextCost,
                    placeId: undefined,
                    placeSubtitle: undefined,
                    lat: undefined,
                    lon: undefined,
                    routeRole: rowKey === LODGING_ROW_KEY ? "LODGING" as const : "NONE" as const,
                };
                return {
                    ...day,
                    activities: exists
                        ? day.activities.map((activity) =>
                            activity.time === rowKey ? { ...activity, ...patch } : activity
                        )
                        : [...day.activities, { ...spreadsheetActivity(rowKey), ...patch }],
                };
            })
        );
    };

    const selectSpreadsheetCostCell = (dayId: string, rowKey: string, additive: boolean) => {
        if (!isSpreadsheetCostRow(rowKey)) return;
        costDragAnchorRef.current = { dayId, rowKey };
        setSelectedCostCellKeys((prev) => {
            const base = additive ? new Set(prev) : new Set<string>();
            costDragBaseSelectionRef.current = new Set(base);
            const range = spreadsheetCostRangeKeys(days, { dayId, rowKey }, { dayId, rowKey });
            const next = new Set(base);
            range.forEach((key) => next.add(key));
            return next;
        });
    };

    const addDraggedSpreadsheetCostCell = (dayId: string, rowKey: string) => {
        if (!isCostCellDragging || !isSpreadsheetCostRow(rowKey)) return;
        const anchor = costDragAnchorRef.current;
        if (!anchor) return;
        const range = spreadsheetCostRangeKeys(days, anchor, { dayId, rowKey });
        const next = new Set(costDragBaseSelectionRef.current);
        range.forEach((key) => next.add(key));
        setSelectedCostCellKeys(next);
    };

    const openSpreadsheetPlaceSearch = (dayId: string, rowKey: string, value: string) => {
        const trimmed = value.trim();
        if (!trimmed.startsWith(PLACE_SEARCH_COMMAND)) return;
        setSpreadsheetPlaceTarget({
            dayId,
            rowKey,
            query: trimmed.slice(PLACE_SEARCH_COMMAND.length).trim(),
            fixed: rowKey !== LODGING_ROW_KEY,
            origin: previousPlaceOrigin(days, dayId, rowKey),
        });
    };

    const applySpreadsheetPlace = (place: PlaceResult) => {
        if (!spreadsheetPlaceTarget) return;
        const { dayId, rowKey } = spreadsheetPlaceTarget;
        const title = place.displayTitle || place.titleKo || place.title || "";
        setDays((prev) =>
            prev.map((day) => {
                if (day.id !== dayId) return day;
                const exists = day.activities.some((activity) => activity.time === rowKey);
                const placePatch = {
                    activity: title,
                    location: title,
                    placeId: place.id,
                    placeSubtitle: place.subtitle,
                    lat: place.lat,
                    lon: place.lon,
                    routeRole: rowKey === LODGING_ROW_KEY
                        ? "LODGING" as const
                        : spreadsheetPlaceTarget.fixed
                            ? "FIXED" as const
                            : "NONE" as const,
                };
                return {
                    ...day,
                    activities: exists
                        ? day.activities.map((activity) =>
                            activity.time === rowKey ? { ...activity, ...placePatch } : activity
                        )
                        : [...day.activities, { ...spreadsheetActivity(rowKey), ...placePatch }],
                };
            })
        );
        setSpreadsheetPlaceTarget(null);
    };

    const openActivityPlaceSearch = (dayId: string, activityId: string, query: string) => {
        setActivityPlaceTarget({
            dayId,
            activityId,
            query,
            origin: previousPlaceOrigin(days, dayId, activityId),
        });
    };

    const applyActivityPlace = (place: PlaceResult) => {
        if (!activityPlaceTarget) return;
        const { dayId, activityId } = activityPlaceTarget;
        const title = place.displayTitle || place.titleKo || place.title || "";
        setDays((prev) =>
            prev.map((day) =>
                day.id === dayId
                    ? {
                        ...day,
                        activities: day.activities.map((activity) =>
                            activity.id === activityId
                                ? {
                                    ...activity,
                                    location: title,
                                    placeId: place.id,
                                    placeSubtitle: place.subtitle,
                                    lat: place.lat,
                                    lon: place.lon,
                                }
                                : activity
                        ),
                    }
                    : day
            )
        );
        setActivityPlaceTarget(null);
    };

    const removeSpreadsheetDay = (dayId: string) => {
        setDays((prev) => prev.filter((day) => day.id !== dayId));
    };

    const removeSpreadsheetRow = (rowKey: string) => {
        if (!rowKey.startsWith("__custom__:")) return;
        setDays((prev) =>
            prev.map((day) => ({
                ...day,
                activities: day.activities.filter((activity) => activity.time !== rowKey),
            }))
        );
    };

    const itineraryCost = days.reduce(
        (acc, day) => acc + day.activities.reduce((sum, activity) => sum + (activity.cost || 0), 0),
        0
    );
    const totalCost = itineraryCost + preparationCost;

    return (
        <div className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
            <div className="relative overflow-hidden bg-gradient-to-r from-black via-gray-900 to-black px-4 py-4 sm:px-6 sm:py-5">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                <input
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="relative z-10 w-full rounded bg-transparent px-2 py-1 text-xl font-bold tracking-tight text-white focus:outline-none focus:ring-2 focus:ring-white/30 sm:text-2xl"
                />
            </div>

            <div className="min-w-0 space-y-6 bg-gradient-to-b from-gray-50 to-white p-3 sm:p-6">
                {template === "spreadsheet" && (
                    <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-2 shadow-sm sm:p-4">
                        <div className="flex items-center gap-2 text-base font-bold text-gray-950">
                            <FileSpreadsheet className="h-5 w-5" />
                            엑셀형 여행 템플릿
                        </div>
                        <p className="mt-1 text-sm text-gray-500">
                            날짜별 열과 일정/식비 행으로 보는 여행표입니다.
                        </p>
                        <SpreadsheetTemplate
                            days={days}
                            onAddDay={addSpreadsheetDay}
                            onAddRow={addSpreadsheetRow}
                            onChangeCell={updateSpreadsheetCell}
                            onSearchPlace={openSpreadsheetPlaceSearch}
                            onRemoveDay={removeSpreadsheetDay}
                            onRemoveRow={removeSpreadsheetRow}
                            selectedCostCellKeys={selectedCostCellKeys}
                            onSelectCostCell={selectSpreadsheetCostCell}
                            onDragCostCell={addDraggedSpreadsheetCostCell}
                            onSetCostCellDragging={setIsCostCellDragging}
                        />
                    </div>
                )}

                {template === "basic" && (
                    <>
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
                                        paidPlaces={tier === "PAID"}
                                        planId={planId}
                                        currency={currency}
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
                                        {formatCurrencyAmount(totalCost, currency)}
                                    </span>
                                    {preparationCost > 0 && (
                                        <div className="mt-1 text-xs font-medium text-gray-400">
                                            준비물 {formatCurrencyAmount(preparationCost, currency)} 포함
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {template === "timeline" && (
                    <TimelineTemplate
                        days={days}
                        title={title}
                        totalCost={totalCost}
                        preparationCost={preparationCost}
                        currency={currency}
                        onAddDay={addDay}
                        onRemoveDay={removeDay}
                        onUpdateDayTitle={updateDayTitle}
                        onUpdateDayDate={updateDayDate}
                        onAddActivity={addActivity}
                        onRemoveActivity={removeActivity}
                        onUpdateActivityField={updateActivityField}
                        onSetActivityTime={setTimeForActivity}
                        onSearchPlace={openActivityPlaceSearch}
                    />
                )}

                {template === "route_sheet" && (
                    <RouteSheetTemplate
                        days={days}
                        onAddDay={addDay}
                        onRemoveDay={removeDay}
                        onUpdateDayTitle={updateDayTitle}
                        onUpdateDayDate={updateDayDate}
                        onAddActivity={addActivity}
                        onRemoveActivity={removeActivity}
                        onUpdateActivityField={updateActivityField}
                        onSetActivityTime={setTimeForActivity}
                        onReorderRouteStops={reorderRouteStops}
                        onSearchPlace={openActivityPlaceSearch}
                    />
                )}
            </div>
            <PlaceSearchModal
                open={Boolean(spreadsheetPlaceTarget)}
                onClose={() => setSpreadsheetPlaceTarget(null)}
                onSelect={applySpreadsheetPlace}
                initialQuery={spreadsheetPlaceTarget?.query}
                showFixedOption={Boolean(spreadsheetPlaceTarget && spreadsheetPlaceTarget.rowKey !== LODGING_ROW_KEY)}
                fixedOptionChecked={spreadsheetPlaceTarget?.fixed ?? false}
                onFixedOptionChange={(fixed) => {
                    setSpreadsheetPlaceTarget((current) => current ? { ...current, fixed } : current);
                }}
                paidPlaces={tier === "PAID"}
                planId={planId}
                countryCode={countryCode}
                origin={spreadsheetPlaceTarget?.origin}
            />
            <PlaceSearchModal
                open={Boolean(activityPlaceTarget)}
                onClose={() => setActivityPlaceTarget(null)}
                onSelect={applyActivityPlace}
                initialQuery={activityPlaceTarget?.query}
                paidPlaces={tier === "PAID"}
                planId={planId}
                countryCode={countryCode}
                origin={activityPlaceTarget?.origin}
            />
        </div>
    );
}

function SpreadsheetTemplate({
    days,
    onAddDay,
    onAddRow,
    onChangeCell,
    onSearchPlace,
    onRemoveDay,
    onRemoveRow,
    selectedCostCellKeys,
    onSelectCostCell,
    onDragCostCell,
    onSetCostCellDragging,
}: {
    days: ItineraryDay[];
    onAddDay: () => void;
    onAddRow: () => void;
    onChangeCell: (dayId: string, rowKey: string, value: string) => void;
    onSearchPlace: (dayId: string, rowKey: string, value: string) => void;
    onRemoveDay: (dayId: string) => void;
    onRemoveRow: (rowKey: string) => void;
    selectedCostCellKeys: Set<string>;
    onSelectCostCell: (dayId: string, rowKey: string, additive: boolean) => void;
    onDragCostCell: (dayId: string, rowKey: string) => void;
    onSetCostCellDragging: (dragging: boolean) => void;
}) {
    const rowKeys = spreadsheetRowKeys(days);

    return (
        <div className="mt-4 max-w-full space-y-3 overflow-hidden">
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={onAddDay}
                    className="inline-flex items-center gap-2 rounded-lg bg-gray-950 px-3 py-2 text-xs font-semibold text-white sm:text-sm"
                >
                    <Plus className="h-4 w-4" />
                    열 추가
                </button>
                <button
                    type="button"
                    onClick={onAddRow}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-900 sm:text-sm"
                >
                    <Plus className="h-4 w-4" />
                    행 추가
                </button>
            </div>
            <div
                className="max-w-full overflow-hidden rounded-lg border border-gray-300 bg-white"
                onMouseLeave={() => onSetCostCellDragging(false)}
                onMouseUp={() => onSetCostCellDragging(false)}
            >
            <div className="max-w-full overflow-x-auto">
                    <table className="min-w-max border-collapse text-center text-[11px] sm:text-xs">
                    <thead>
                    <tr className="bg-gray-100">
                            <th className="sticky left-0 z-10 w-20 min-w-20 border border-gray-300 bg-gray-100 px-2 py-2 text-left font-bold sm:w-24 sm:min-w-24">
                                시간
                            </th>
                            {days.map((day, index) => (
                                <th key={day.id} className="group w-32 min-w-32 border border-gray-300 px-2 py-2 font-bold sm:w-40 sm:min-w-40 xl:w-44 xl:min-w-44">
                                    <div className="flex items-center justify-center gap-2">
                                        <span>{index + 1}일차</span>
                                        <button
                                            type="button"
                                            onClick={() => onRemoveDay(day.id)}
                                            className="rounded p-1 text-red-500 transition hover:bg-red-50 sm:opacity-0 sm:group-hover:opacity-100"
                                            aria-label={`${index + 1}일차 삭제`}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                    <div className="mt-1 text-[11px] font-medium text-gray-500">{day.date || day.dayTitle}</div>
                            </th>
                        ))}
                    </tr>
                    </thead>
                    <tbody>
                        {rowKeys.map((rowKey) => (
                            <tr key={rowKey} className={spreadsheetRowClass(rowKey)}>
                                <th className="group sticky left-0 z-10 h-11 border border-gray-300 bg-gray-100 px-2 py-2 text-left font-bold sm:h-12">
                                    <div className="flex items-center justify-between gap-2">
                                        <span>{spreadsheetRowLabel(rowKey)}</span>
                                        {rowKey.startsWith("__custom__:") && (
                                            <button
                                                type="button"
                                                onClick={() => onRemoveRow(rowKey)}
                                                className="rounded p-1 text-red-500 transition hover:bg-red-50 sm:opacity-0 sm:group-hover:opacity-100"
                                                aria-label={`${spreadsheetRowLabel(rowKey)} 행 삭제`}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </th>
                                {days.map((day) => {
                                    const isCostRow = isSpreadsheetCostRow(rowKey);
                                    const cellKey = spreadsheetCellKey(day.id, rowKey);
                                    const isSelected = selectedCostCellKeys.has(cellKey);
                                    return (
                                    <td
                                        key={`${day.id}-${rowKey}`}
                                        className={`h-11 border border-gray-300 p-0 align-middle sm:h-12 ${
                                            isSelected ? "ring-2 ring-inset ring-gray-950" : ""
                                        }`}
                                        onMouseDown={(event) => {
                                            if (!isCostRow) return;
                                            onSetCostCellDragging(true);
                                            onSelectCostCell(day.id, rowKey, event.ctrlKey || event.metaKey);
                                        }}
                                        onMouseEnter={() => onDragCostCell(day.id, rowKey)}
                                    >
                                        <input
                                            value={spreadsheetCellText(day, rowKey)}
                                            onChange={(event) => onChangeCell(day.id, rowKey, event.target.value)}
                                            onKeyDown={(event) => {
                                                if (event.key !== "Enter") return;
                                                onSearchPlace(day.id, rowKey, event.currentTarget.value);
                                            }}
                                            placeholder={rowKey === LODGING_ROW_KEY || TIME_ROWS.includes(rowKey) ? "/장소검색 신주쿠" : undefined}
                                            inputMode={isCostRow ? "numeric" : undefined}
                                            className={`h-full w-full min-w-32 bg-transparent px-2 text-center text-[11px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-950 sm:min-w-40 sm:text-xs xl:min-w-44 ${
                                                isCostRow ? "font-semibold tabular-nums" : ""
                                            }`}
                                        />
                                </td>
                                    );
                                })}
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
        </div>
    );
}

function TimelineTemplate({
    days,
    title,
    totalCost,
    preparationCost,
    currency,
    onAddDay,
    onRemoveDay,
    onUpdateDayTitle,
    onUpdateDayDate,
    onAddActivity,
    onRemoveActivity,
    onUpdateActivityField,
    onSetActivityTime,
    onSearchPlace,
}: {
    days: ItineraryDay[];
    title: string;
    totalCost: number;
    preparationCost: number;
    currency: CurrencyRate;
    onAddDay: () => void;
    onRemoveDay: (dayId: string) => void;
    onUpdateDayTitle: (dayId: string, title: string) => void;
    onUpdateDayDate: (dayId: string, date: string) => void;
    onAddActivity: (dayId: string) => void;
    onRemoveActivity: (dayId: string, activityId: string) => void;
    onUpdateActivityField: (dayId: string, activityId: string, field: keyof ItineraryActivity, value: string | number) => void;
    onSetActivityTime: (dayId: string, activityId: string, nextTime: string) => void;
    onSearchPlace: (dayId: string, activityId: string, query: string) => void;
}) {
    return (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 bg-white px-4 py-5 sm:px-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="min-w-0">
                        <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-black text-gray-700">
                            <Sparkles className="h-3.5 w-3.5 text-rose-500" />
                            트립 보드
                        </div>
                        <h2 className="mt-3 truncate text-2xl font-black text-gray-950">{title || "여행 계획"}</h2>
                        <p className="mt-1 text-sm font-semibold text-gray-500">
                            날짜별 카드에 시간, 장소, 메모, 비용을 정리하는 일정표입니다.
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                            <div className="text-xs font-bold text-gray-500">총 경비</div>
                            <div className="text-lg font-black text-gray-950">{formatCurrencyAmount(totalCost, currency)}</div>
                        </div>
                        {preparationCost > 0 && (
                            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                                <div className="text-xs font-bold text-gray-500">준비물 비용</div>
                                <div className="text-lg font-black text-gray-950">{formatCurrencyAmount(preparationCost, currency)}</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-gray-50 p-3 sm:p-5">
                <div className="grid gap-4 xl:grid-cols-3">
                    {days.map((day, dayIndex) => {
                        const dayCost = day.activities.reduce((sum, activity) => sum + (Number(activity.cost) || 0), 0);
                        return (
                            <section key={day.id} className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                                <div className="border-b border-gray-200 bg-gray-950 px-4 py-4 text-white">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="text-xs font-black uppercase tracking-wide text-white/55">
                                                보드 {String(dayIndex + 1).padStart(2, "0")}
                                            </div>
                                            <input
                                                value={day.dayTitle}
                                                onChange={(event) => onUpdateDayTitle(day.id, event.target.value)}
                                                className="mt-2 w-full min-w-0 bg-transparent text-lg font-black text-white placeholder:text-white/50 focus:outline-none"
                                                placeholder={`Day ${dayIndex + 1}`}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => onRemoveDay(day.id)}
                                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
                                            aria-label="Day 삭제"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                                        <label className="flex min-w-0 items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
                                            <CalendarDays className="h-4 w-4 text-white/65" />
                                            <input
                                                type="date"
                                                value={day.date}
                                                onChange={(event) => onUpdateDayDate(day.id, event.target.value)}
                                                className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white focus:outline-none"
                                            />
                                        </label>
                                        <div className="rounded-lg bg-white px-3 py-2 text-sm font-black text-gray-950">
                                            {formatCurrencyAmount(dayCost, currency)}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3 bg-gray-50 p-3">
                                    {day.activities.map((activity, activityIndex) => (
                                        <article key={activity.id} className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                                            <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-3 py-2">
                                                <span className="rounded-full bg-gray-950 px-2.5 py-1 text-xs font-black text-white">
                                                    스팟 {activityIndex + 1}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => onRemoveActivity(day.id, activity.id)}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"
                                                    aria-label="스팟 삭제"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                            <div className="space-y-2 p-3">
                                                <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                                                    <Clock className="h-4 w-4 text-gray-500" />
                                                    <input
                                                        type="time"
                                                        value={activity.time}
                                                        onChange={(event) => onSetActivityTime(day.id, activity.id, event.target.value)}
                                                        className="min-w-0 flex-1 bg-transparent text-sm font-black text-gray-900 focus:outline-none"
                                                    />
                                                </label>
                                                <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
                                                    <MapPin className="h-4 w-4 shrink-0 text-gray-500" />
                                                    <input
                                                        value={activity.location}
                                                        onChange={(event) => onUpdateActivityField(day.id, activity.id, "location", event.target.value)}
                                                        className="min-w-0 flex-1 bg-transparent text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:outline-none"
                                                        placeholder="장소"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => onSearchPlace(day.id, activity.id, activity.location)}
                                                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-950"
                                                        aria-label="장소 검색"
                                                    >
                                                        <Search className="h-4 w-4" />
                                                    </button>
                                                </label>
                                                <textarea
                                                    value={activity.activity}
                                                    onChange={(event) => onUpdateActivityField(day.id, activity.id, "activity", event.target.value)}
                                                    className="min-h-20 w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold leading-5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-950/10"
                                                    placeholder="일정 메모"
                                                />
                                                <input
                                                    value={activity.cost ? String(activity.cost) : ""}
                                                    inputMode="numeric"
                                                    onChange={(event) => onUpdateActivityField(day.id, activity.id, "cost", Number(event.target.value.replace(/[^\d]/g, "")) || 0)}
                                                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-black text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-950/10"
                                                    placeholder="비용"
                                                />
                                            </div>
                                        </article>
                                    ))}

                                    <button
                                        type="button"
                                        onClick={() => onAddActivity(day.id)}
                                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-4 py-3 text-sm font-black text-gray-700 hover:border-gray-950 hover:text-gray-950"
                                    >
                                        <Plus className="h-4 w-4" />
                                        스팟 추가
                                    </button>
                                </div>
                            </section>
                        );
                    })}
                    <button
                        type="button"
                        onClick={onAddDay}
                        className="flex min-h-64 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white py-5 text-sm font-black text-gray-700 shadow-sm hover:border-gray-950 hover:text-gray-950"
                    >
                        <Plus className="h-5 w-5" />
                        Day 추가
                    </button>
                </div>
            </div>
        </div>
    );
}

function RouteSheetTemplate({
    days,
    onAddDay,
    onRemoveDay,
    onUpdateDayTitle,
    onUpdateDayDate,
    onAddActivity,
    onRemoveActivity,
    onUpdateActivityField,
    onSetActivityTime,
    onReorderRouteStops,
    onSearchPlace,
}: {
    days: ItineraryDay[];
    onAddDay: () => void;
    onRemoveDay: (dayId: string) => void;
    onUpdateDayTitle: (dayId: string, title: string) => void;
    onUpdateDayDate: (dayId: string, date: string) => void;
    onAddActivity: (dayId: string) => void;
    onRemoveActivity: (dayId: string, activityId: string) => void;
    onUpdateActivityField: (dayId: string, activityId: string, field: keyof ItineraryActivity, value: string | number) => void;
    onSetActivityTime: (dayId: string, activityId: string, nextTime: string) => void;
    onReorderRouteStops: (dayId: string, activeId: string, overId: string) => void;
    onSearchPlace: (dayId: string, activityId: string, query: string) => void;
}) {
    const handleRouteDragEnd = (dayId: string, event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        onReorderRouteStops(dayId, String(active.id), String(over.id));
    };

    return (
        <div className="space-y-5">
            {days.map((day, dayIndex) => {
                const routeStops = day.activities.filter((activity) => !isRouteSheetFood(activity));
                return (
                    <section key={day.id} className="overflow-visible rounded-xl border border-gray-200 bg-white shadow-sm">
                        <div className="border-b border-gray-200 bg-white px-4 py-4 sm:px-5">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div className="min-w-0">
                                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                                        <span className="rounded-full bg-gray-950 px-2.5 py-1 text-xs font-black text-white">
                                            Route Plan {String(dayIndex + 1).padStart(2, "0")}
                                        </span>
                                        <input
                                            value={day.dayTitle}
                                            onChange={(event) => onUpdateDayTitle(day.id, event.target.value)}
                                            className="min-w-0 flex-1 bg-transparent text-xl font-black text-gray-950 focus:outline-none"
                                            placeholder={`Day ${dayIndex + 1}`}
                                        />
                                    </div>
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                        <input
                                            type="date"
                                            value={day.date}
                                            onChange={(event) => onUpdateDayDate(day.id, event.target.value)}
                                            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-950/10"
                                        />
                                        <span className="rounded-lg bg-gray-50 px-3 py-2 text-sm font-black text-gray-500">
                                            {routeStops.length} stops
                                        </span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onRemoveDay(day.id)}
                                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-black text-gray-500 hover:bg-red-50 hover:text-red-600"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    Day 삭제
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4 bg-gray-50 p-3 sm:p-5">
                            <div className="overflow-x-auto overflow-y-visible rounded-xl border border-gray-200 bg-white p-3 pb-6 [scrollbar-color:#111827_#e5e7eb] [scrollbar-width:thin]">
                                <DndContext collisionDetection={closestCenter} onDragEnd={(event) => handleRouteDragEnd(day.id, event)}>
                                    <SortableContext items={routeStops.map((activity) => activity.id)} strategy={rectSortingStrategy}>
                                        <RouteLineDiagram
                                            dayId={day.id}
                                            stops={routeStops}
                                            onRemoveActivity={onRemoveActivity}
                                            onUpdateActivityField={onUpdateActivityField}
                                            onSetActivityTime={onSetActivityTime}
                                            onSearchPlace={onSearchPlace}
                                        />
                                    </SortableContext>
                                </DndContext>
                                <button
                                    type="button"
                                    onClick={() => onAddActivity(day.id)}
                                    className="mt-3 inline-flex min-w-[920px] items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-3 text-sm font-black text-gray-700 hover:border-gray-950 hover:text-gray-950"
                                >
                                    <Plus className="h-4 w-4" />
                                    스팟 추가
                                </button>
                            </div>

                            <DndContext collisionDetection={closestCenter} onDragEnd={(event) => handleRouteDragEnd(day.id, event)}>
                                <SortableContext items={routeStops.map((activity) => activity.id)} strategy={rectSortingStrategy}>
                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                        {routeStops.map((activity, index) => (
                                            <SortableRouteSpotCard
                                                key={activity.id}
                                                activity={activity}
                                                index={index}
                                                total={routeStops.length}
                                            />
                                        ))}
                                    </div>
                                </SortableContext>
                            </DndContext>
                        </div>
                    </section>
                );
            })}

            <button
                type="button"
                onClick={onAddDay}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white py-5 text-sm font-black text-gray-700 shadow-sm hover:border-gray-950 hover:text-gray-950"
            >
                <Plus className="h-5 w-5" />
                Route Plan Day 추가
            </button>
        </div>
    );
}

function RouteLineDiagram({
    dayId,
    stops,
    onRemoveActivity,
    onUpdateActivityField,
    onSetActivityTime,
    onSearchPlace,
}: {
    dayId: string;
    stops: ItineraryActivity[];
    onRemoveActivity: (dayId: string, activityId: string) => void;
    onUpdateActivityField: (dayId: string, activityId: string, field: keyof ItineraryActivity, value: string | number) => void;
    onSetActivityTime: (dayId: string, activityId: string, nextTime: string) => void;
    onSearchPlace: (dayId: string, activityId: string, query: string) => void;
}) {
    const points = routeSheetPoints(stops.length);
    const path = routeSheetPath(points);
    const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
    const selectedStopIndex = stops.findIndex((stop) => stop.id === selectedStopId);
    const selectedStop = selectedStopIndex >= 0 ? stops[selectedStopIndex] : null;
    const selectedPoint = selectedStop ? points[selectedStopIndex] ?? points[points.length - 1] : null;
    const panelOpensLeft = selectedPoint ? selectedPoint.x > 68 : false;
    const panelTop = selectedPoint ? Math.max(3, Math.min(72, selectedPoint.y - 5)) : 0;

    return (
        <div className="relative h-[430px] w-[920px] max-w-none overflow-visible rounded-xl bg-white">
            <div className="absolute inset-0 bg-[linear-gradient(#f3f4f6_1px,transparent_1px),linear-gradient(90deg,#f3f4f6_1px,transparent_1px)] bg-[size:28px_28px]" />
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
                <path d={path} fill="none" stroke="#111827" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
            </svg>
            {stops.map((activity, index) => {
                const point = points[index] ?? points[points.length - 1];
                const isSelected = activity.id === selectedStopId;
                return (
                    <SortableRouteMarker
                        key={activity.id}
                        activity={activity}
                        index={index}
                        total={stops.length}
                        point={point}
                        selected={isSelected}
                        onSelect={() => setSelectedStopId(activity.id)}
                    />
                );
            })}
            {selectedStop && selectedPoint && (
                <div
                    className="absolute z-20 w-[min(22rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 bg-white/95 p-3 shadow-xl backdrop-blur"
                    style={{
                        left: `${panelOpensLeft ? selectedPoint.x - 2 : selectedPoint.x + 2}%`,
                        top: `${panelTop}%`,
                        transform: panelOpensLeft ? "translateX(-100%)" : "translateX(0)",
                    }}
                >
                    <span
                        className={`absolute h-3 w-3 rotate-45 border bg-white/95 ${
                            panelOpensLeft ? "-right-1.5 border-b-0 border-l-0" : "-left-1.5 border-r-0 border-t-0"
                        } top-6 border-gray-200`}
                    />
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="min-w-0 text-sm font-black text-gray-950">선택한 스팟</div>
                        <button
                            type="button"
                            onClick={() => {
                                onRemoveActivity(dayId, selectedStop.id);
                                setSelectedStopId(null);
                            }}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"
                            aria-label="루트 스팟 삭제"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="max-h-[min(25rem,calc(100vh-8rem))] space-y-2 overflow-y-auto pr-1">
                        <label className="block">
                            <span className="mb-1 block text-xs font-black text-gray-500">시간</span>
                            <input
                                type="time"
                                value={selectedStop.time}
                                onChange={(event) => onSetActivityTime(dayId, selectedStop.id, event.target.value)}
                                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                            />
                        </label>
                        <label className="block">
                            <span className="mb-1 block text-xs font-black text-gray-500">장소</span>
                            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-yellow-300">
                                <input
                                    value={selectedStop.location}
                                    onChange={(event) => onUpdateActivityField(dayId, selectedStop.id, "location", event.target.value)}
                                    className="min-w-0 flex-1 bg-transparent text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:outline-none"
                                    placeholder="장소"
                                />
                                <button
                                    type="button"
                                    onClick={() => onSearchPlace(dayId, selectedStop.id, selectedStop.location)}
                                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-950"
                                    aria-label="장소 검색"
                                >
                                    <Search className="h-4 w-4" />
                                </button>
                            </div>
                        </label>
                        <div>
                            <span className="mb-1 block text-xs font-black text-gray-500">마커 색상</span>
                            <div className="grid grid-cols-9 gap-1.5">
                                {ROUTE_MARKER_COLORS.map((color) => {
                                    const isActive = (selectedStop.markerColor ?? "") === color.value;
                                    return (
                                        <button
                                            key={color.value}
                                            type="button"
                                            onClick={() => onUpdateActivityField(dayId, selectedStop.id, "markerColor", color.value)}
                                            className={`h-7 rounded-md border transition ${isActive ? "border-gray-950 ring-2 ring-gray-950/15" : "border-white hover:border-gray-400"}`}
                                            style={{ backgroundColor: color.value }}
                                            aria-label={`마커 색상 ${color.label}`}
                                        />
                                    );
                                })}
                            </div>
                            <label className="mt-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2 py-2">
                                <span className="text-xs font-black text-gray-500">직접 선택</span>
                                <input
                                    type="color"
                                    value={selectedStop.markerColor ?? routeMarkerColor(selectedStop, selectedStopIndex, stops.length)}
                                    onChange={(event) => onUpdateActivityField(dayId, selectedStop.id, "markerColor", event.target.value)}
                                    className="ml-auto h-7 w-12 cursor-pointer rounded border-0 bg-transparent p-0"
                                    aria-label="사용자 지정 마커 색상"
                                />
                            </label>
                        </div>
                        <label className="block">
                            <span className="mb-1 block text-xs font-black text-gray-500">내용</span>
                            <textarea
                                value={selectedStop.activity}
                                onChange={(event) => onUpdateActivityField(dayId, selectedStop.id, "activity", event.target.value)}
                                className="min-h-28 w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold leading-5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                                placeholder="일정 내용"
                            />
                        </label>
                        <label className="block">
                            <span className="mb-1 block text-xs font-black text-gray-500">소요 시간</span>
                            <input
                                value={selectedStop.placeSubtitle ?? ""}
                                onChange={(event) => onUpdateActivityField(dayId, selectedStop.id, "placeSubtitle", event.target.value)}
                                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                                placeholder="예: 50분"
                            />
                        </label>
                    </div>
                </div>
            )}
        </div>
    );
}

function SortableRouteMarker({
    activity,
    index,
    total,
    point,
    selected,
    onSelect,
}: {
    activity: ItineraryActivity;
    index: number;
    total: number;
    point: { x: number; y: number };
    selected: boolean;
    onSelect: () => void;
}) {
    const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition, isDragging } = useSortable({ id: activity.id });
    const markerColor = routeMarkerColor(activity, index, total);
    const style: React.CSSProperties = {
        left: `${point.x}%`,
        top: `${point.y}%`,
        transform: `${CSS.Transform.toString(transform) ?? ""} translate(-50%, -50%)`,
        transition,
        zIndex: isDragging ? 30 : 10,
    };

    return (
        <div ref={setNodeRef} className="absolute flex w-28 flex-col items-center text-center" style={style}>
            <button
                type="button"
                onClick={onSelect}
                className={`relative flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-md transition focus:outline-none focus:ring-4 focus:ring-gray-950/20 ${selected ? "ring-4 ring-gray-950/20" : "hover:scale-105"}`}
                aria-label={`${activity.location || `스팟 ${index + 1}`} 입력 열기`}
            >
                <MapPin className="h-10 w-10 drop-shadow-sm" fill="currentColor" strokeWidth={2.2} style={{ color: markerColor }} />
                <span className="absolute top-2 text-[11px] font-black text-white">
                    {index + 1}
                </span>
                <span
                    ref={setActivatorNodeRef}
                    onClick={(event) => event.stopPropagation()}
                    className="absolute -right-2 -top-2 inline-flex h-6 w-6 cursor-grab items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm active:cursor-grabbing"
                    aria-label="마커 순서 변경"
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className="h-3.5 w-3.5" />
                </span>
            </button>
            <div className="mt-1 max-w-28 rounded-full bg-white/95 px-2 py-1 text-xs font-black leading-4 text-gray-950 shadow-sm">
                <div className="truncate">{activity.location || "장소"}</div>
                <div className="text-[10px] font-bold text-gray-500">{activity.time || "--:--"}</div>
            </div>
        </div>
    );
}

function SortableRouteSpotCard({
    activity,
    index,
    total,
}: {
    activity: ItineraryActivity;
    index: number;
    total: number;
}) {
    const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition, isDragging } = useSortable({ id: activity.id });
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.85 : 1,
        zIndex: isDragging ? 20 : undefined,
    };

    return (
        <article ref={setNodeRef} style={style} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                    <button
                        type="button"
                        ref={setActivatorNodeRef}
                        className="inline-flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 active:cursor-grabbing"
                        aria-label="스팟 순서 변경"
                        {...attributes}
                        {...listeners}
                    >
                        <GripVertical className="h-4 w-4" />
                    </button>
                    <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: routeMarkerColor(activity, index, total) }}
                    />
                    <span className="truncate text-sm font-black text-gray-950">
                        {activity.location || `스팟 ${index + 1}`}
                    </span>
                </div>
                <span className="shrink-0 text-xs font-black text-gray-500">{activity.time || "--:--"}</span>
            </div>
            <p className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-gray-600">
                {activity.activity || "일정 내용"}
            </p>
            <div className="mt-3 rounded-lg bg-gray-50 px-2 py-1.5 text-xs font-black text-gray-500">
                {activity.placeSubtitle || "소요 시간"}
            </div>
        </article>
    );
}

function routeMarkerColor(activity: ItineraryActivity, index: number, total: number) {
    if (activity.markerColor) return activity.markerColor;
    if (index === 0) return ROUTE_MARKER_COLORS[1].value;
    if (index === total - 1) return ROUTE_MARKER_COLORS[2].value;
    return ROUTE_MARKER_COLORS[index % ROUTE_MARKER_COLORS.length].value;
}

function routeSheetPoints(count: number) {
    const base = [
        { x: 8, y: 20 },
        { x: 26, y: 20 },
        { x: 46, y: 20 },
        { x: 66, y: 20 },
        { x: 86, y: 20 },
        { x: 86, y: 48 },
        { x: 66, y: 48 },
        { x: 46, y: 48 },
        { x: 26, y: 48 },
        { x: 8, y: 48 },
        { x: 8, y: 76 },
        { x: 30, y: 76 },
        { x: 52, y: 76 },
        { x: 74, y: 76 },
        { x: 92, y: 76 },
    ];
    if (count <= base.length) return base.slice(0, Math.max(count, 1));
    const extra = Array.from({ length: count - base.length }, (_, index) => ({
        x: 92 - ((index + 1) * 16) % 84,
        y: 90,
    }));
    return [...base, ...extra];
}

function routeSheetPath(points: Array<{ x: number; y: number }>) {
    if (points.length === 0) return "";
    return points.reduce((path, point, index) => {
        if (index === 0) return `M ${point.x} ${point.y}`;
        const previous = points[index - 1];
        const controlX = (previous.x + point.x) / 2;
        const controlY = previous.y === point.y ? previous.y : (previous.y + point.y) / 2;
        return `${path} Q ${controlX} ${controlY} ${point.x} ${point.y}`;
    }, "");
}

function isRouteSheetFood(activity: ItineraryActivity) {
    return activity.time === "__food__";
}

function previousPlaceOrigin(days: ItineraryDay[], dayId: string, targetKey: string): PlaceSearchOrigin | null {
    const day = days.find((item) => item.id === dayId);
    if (!day) return null;

    const activityIndex = day.activities.findIndex((activity) => activity.id === targetKey);
    if (activityIndex >= 0) {
        for (let index = activityIndex - 1; index >= 0; index--) {
            const origin = activityToPlaceOrigin(day.activities[index]);
            if (origin) return origin;
        }
        return null;
    }

    const targetRowIndex = spreadsheetRouteRowIndex(targetKey);
    if (targetRowIndex === -1) return null;

    return day.activities
        .map((activity) => ({ activity, rowIndex: spreadsheetRouteRowIndex(activity.time) }))
        .filter((item) => item.rowIndex >= 0 && item.rowIndex < targetRowIndex)
        .sort((left, right) => right.rowIndex - left.rowIndex)
        .map((item) => activityToPlaceOrigin(item.activity))
        .find((origin): origin is PlaceSearchOrigin => Boolean(origin)) ?? null;
}

function activityToPlaceOrigin(activity?: ItineraryActivity): PlaceSearchOrigin | null {
    if (!activity || !Number.isFinite(activity.lat) || !Number.isFinite(activity.lon)) return null;
    return {
        name: activity.location || activity.activity || undefined,
        lat: activity.lat as number,
        lon: activity.lon as number,
    };
}

function spreadsheetRouteRowIndex(rowKey: string) {
    if (rowKey === LODGING_ROW_KEY) return 0;
    const timeIndex = TIME_ROWS.indexOf(rowKey);
    if (timeIndex >= 0) return timeIndex + 1;
    return -1;
}

function spreadsheetRowKeys(days: ItineraryDay[]) {
    const customRows = new Map<string, string>();
    days.forEach((day) => {
        day.activities.forEach((activity) => {
            if (activity.time.startsWith("__custom__:")) customRows.set(activity.time, activity.time);
        });
    });
    return [
        LODGING_ROW_KEY,
        ...TIME_ROWS,
        ...DEFAULT_COST_ROWS.map((label) => `__cost__:${label}`),
        ...Array.from(customRows.keys()),
    ];
}

function spreadsheetActivity(rowKey: string): ItineraryActivity {
    return {
        id: createClientId("activity"),
        time: rowKey,
        location: "",
        activity: "",
        cost: 0,
        routeRole: rowKey === LODGING_ROW_KEY ? "LODGING" : "NONE",
    };
}

function spreadsheetRowLabel(rowKey: string) {
    if (rowKey === LODGING_ROW_KEY) return "숙소 위치";
    if (rowKey.startsWith("__cost__:")) return rowKey.replace("__cost__:", "");
    if (rowKey.startsWith("__custom__:")) return rowKey.split(":").slice(2).join(":") || "추가 행";
    return rowKey;
}

function spreadsheetRowClass(rowKey: string) {
    if (rowKey === LODGING_ROW_KEY) return "bg-sky-50";
    if (rowKey.startsWith("__cost__:")) return "bg-green-50";
    if (rowKey.startsWith("__custom__:")) return "bg-green-50";
    return "bg-orange-50";
}

function isSpreadsheetCostRow(rowKey: string) {
    return rowKey.startsWith("__cost__:") || rowKey.startsWith("__custom__:");
}

function spreadsheetCellKey(dayId: string, rowKey: string) {
    return `${dayId}::${rowKey}`;
}

function spreadsheetCostRangeKeys(
    days: ItineraryDay[],
    start: { dayId: string; rowKey: string },
    end: { dayId: string; rowKey: string }
) {
    const dayIds = days.map((day) => day.id);
    const costRows = spreadsheetRowKeys(days).filter(isSpreadsheetCostRow);
    const startDayIndex = dayIds.indexOf(start.dayId);
    const endDayIndex = dayIds.indexOf(end.dayId);
    const startRowIndex = costRows.indexOf(start.rowKey);
    const endRowIndex = costRows.indexOf(end.rowKey);
    if (startDayIndex < 0 || endDayIndex < 0 || startRowIndex < 0 || endRowIndex < 0) return [];

    const minDay = Math.min(startDayIndex, endDayIndex);
    const maxDay = Math.max(startDayIndex, endDayIndex);
    const minRow = Math.min(startRowIndex, endRowIndex);
    const maxRow = Math.max(startRowIndex, endRowIndex);
    const keys: string[] = [];
    for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
        for (let dayIndex = minDay; dayIndex <= maxDay; dayIndex += 1) {
            keys.push(spreadsheetCellKey(dayIds[dayIndex], costRows[rowIndex]));
        }
    }
    return keys;
}

function parseCostAmount(value: string) {
    const normalized = value.replace(/,/g, "").replace(/[^\d]/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
}

function formatCostInput(value: string) {
    const digits = value.replace(/[^\d]/g, "");
    if (!digits) return "";
    return Number(digits).toLocaleString("ko-KR");
}

function spreadsheetCellText(day: ItineraryDay, rowKey: string) {
    const activity = day.activities.find((item) => item.time === rowKey);
    return activity?.activity || activity?.location || "";
}
