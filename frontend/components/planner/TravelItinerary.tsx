"use client";

import React, { useEffect, useRef, useState } from "react";
import SortableDayCard from "@/components/planner/Sortable/SortableDayCard";
import { closestCenter, DndContext, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { FileSpreadsheet, Plus, Trash2 } from "lucide-react";
import type { TravelPlanDraft } from "@/lib/travelPlans";
import PlaceSearchModal from "@/components/planner/ActivityField/PlaceSerachModal";
import type { PlaceResult } from "@/components/planner/ActivityField/PlaceSerachInput";

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
const DEFAULT_COST_ROWS = ["아침", "점심", "저녁", "교통", "기타"];

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
    preparationCost = 0,
    onCostSelectionChange,
}: {
    days: ItineraryDay[];
    setDays: React.Dispatch<React.SetStateAction<ItineraryDay[]>>;
    title: string;
    setTitle: React.Dispatch<React.SetStateAction<string>>;
    template?: TravelPlanDraft["template"];
    tier?: TravelPlanDraft["tier"];
    planId?: string;
    preparationCost?: number;
    onCostSelectionChange?: (cells: SelectedCostCell[]) => void;
}) {
    const [timeErrors, setTimeErrors] = useState<Record<string, ActivityError>>({});
    const [spreadsheetPlaceTarget, setSpreadsheetPlaceTarget] = useState<{
        dayId: string;
        rowKey: string;
        query: string;
        fixed: boolean;
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

    const addSpreadsheetDay = () => {
        setDays((prev) => {
            const rowKeys = spreadsheetRowKeys(prev);
            return [
                ...prev,
                {
                    id: crypto.randomUUID(),
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
        const rowKey = `__custom__:${crypto.randomUUID()}:${label.trim()}`;
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
                                    {preparationCost > 0 && (
                                        <div className="mt-1 text-xs font-medium text-gray-400">
                                            준비물 {preparationCost.toLocaleString()}원 포함
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
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
                                            className="rounded p-1 text-red-500 opacity-0 transition hover:bg-red-50 group-hover:opacity-100"
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
                                                className="rounded p-1 text-red-500 opacity-0 transition hover:bg-red-50 group-hover:opacity-100"
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
        id: crypto.randomUUID(),
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
