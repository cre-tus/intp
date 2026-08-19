"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SortableDayCard from "@/components/planner/Sortable/SortableDayCard";
import { closestCenter, DndContext, DragEndEvent, pointerWithin, useDroppable } from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, Clock, Eye, FileSpreadsheet, GripVertical, MapPin, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
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
    rowHeight?: number;
    placeId?: string;
    placeSubtitle?: string;
    address?: string;
    markerColor?: string;
    lat?: number;
    lon?: number;
    routeRole?: "NONE" | "LODGING" | "START" | "END" | "FIXED";
}

export interface ItineraryDay {
    id: string;
    date: string;
    dayTitle: string;
    tableColumnWidth?: number;
    activities: ItineraryActivity[];
}

export type SelectedCostCell = {
    key: string;
    dayTitle: string;
    rowLabel: string;
    amount: number;
};

type ActivityError = { message: string } | null;
type RouteStopSelectionSource = "marker" | "card";
type RouteStopSelection = { id: string; source: RouteStopSelectionSource } | null;
type LatLngTuple = [number, number];
type LeafletLayer = {
    addTo(map: LeafletMap): LeafletLayer;
    on?(event: string, handler: () => void): void;
};
type LeafletMap = {
    setView(center: LatLngTuple, zoom: number): LeafletMap;
    fitBounds(bounds: LatLngTuple[], options?: { padding: [number, number] }): void;
    remove(): void;
    invalidateSize(): LeafletMap;
    on(event: string, handler: () => void): void;
    off(event: string, handler: () => void): void;
    getSize(): { x: number; y: number };
    latLngToContainerPoint(latLng: LatLngTuple): { x: number; y: number };
    __fallbackTilesAdded?: boolean;
};
type LeafletApi = {
    map(element: HTMLElement, options: Record<string, unknown>): LeafletMap;
    tileLayer(url: string, options: Record<string, unknown>): LeafletLayer;
};
const LODGING_ROW_KEY = "__lodging__";
const PLACE_SEARCH_COMMAND = "/장소검색";
const DEFAULT_COST_ROWS = ["입장", "식사", "숙박", "교통", "기타"];
const DEFAULT_TABLE_COLUMN_WIDTH = 176;
const MIN_TABLE_COLUMN_WIDTH = 112;
const MAX_TABLE_COLUMN_WIDTH = 360;
const TABLE_ROW_HEADER_WIDTH = 96;
const DEFAULT_TABLE_ROW_HEIGHT = 48;
const MIN_TABLE_ROW_HEIGHT = 40;
const MAX_TABLE_ROW_HEIGHT = 120;
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
const ROUTE_ROLE_OPTIONS: Array<{ value: NonNullable<ItineraryActivity["routeRole"]>; label: string }> = [
    { value: "NONE", label: "일반 스팟" },
    { value: "LODGING", label: "숙소 고정" },
    { value: "START", label: "출발 고정" },
    { value: "END", label: "도착 고정" },
    { value: "FIXED", label: "일정 고정" },
];
const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const TILE_URL = process.env.NEXT_PUBLIC_TILE_URL || "/tiles/{z}/{x}/{y}.png";

function loadLeaflet(): Promise<LeafletApi> {
    if (typeof window === "undefined") return Promise.reject(new Error("Browser only"));
    const browserWindow = window as Window & { L?: LeafletApi };
    if (browserWindow.L) return Promise.resolve(browserWindow.L);

    return new Promise<LeafletApi>((resolve, reject) => {
        if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = LEAFLET_CSS;
            document.head.appendChild(link);
        }

        const existing = document.querySelector<HTMLScriptElement>(`script[src="${LEAFLET_JS}"]`);
        if (existing) {
            existing.addEventListener("load", () => browserWindow.L ? resolve(browserWindow.L) : reject(new Error("Leaflet load failed")));
            existing.addEventListener("error", () => reject(new Error("Leaflet load failed")));
            return;
        }

        const script = document.createElement("script");
        script.src = LEAFLET_JS;
        script.async = true;
        script.onload = () => browserWindow.L ? resolve(browserWindow.L) : reject(new Error("Leaflet load failed"));
        script.onerror = () => reject(new Error("Leaflet load failed"));
        document.body.appendChild(script);
    });
}

const timeToMinutes = (value: string) => {
    const [hh, mm] = value.split(":").map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
    return hh * 60 + mm;
};

const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const addDaysIso = (value: string, offsetDays: number) => {
    if (!isIsoDate(value)) return "";
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + offsetDays));
    return date.toISOString().slice(0, 10);
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
    onTierPending,
    onTierSynced,
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
    onTierPending?: () => void;
    onTierSynced?: (tier: TravelPlanDraft["tier"]) => void;
}) {
    const [timeErrors, setTimeErrors] = useState<Record<string, ActivityError>>({});
    const [spreadsheetPlaceTarget, setSpreadsheetPlaceTarget] = useState<{
        dayId: string;
        rowKey: string;
        query: string;
        lat?: number;
        lon?: number;
        fixed: boolean;
        origin: PlaceSearchOrigin | null;
    } | null>(null);
    const [activityPlaceTarget, setActivityPlaceTarget] = useState<{
        dayId: string;
        activityId: string;
        query: string;
        lat?: number;
        lon?: number;
        origin: PlaceSearchOrigin | null;
    } | null>(null);
    const [selectedCostCellKeys, setSelectedCostCellKeys] = useState<Set<string>>(new Set());
    const [isCostCellDragging, setIsCostCellDragging] = useState(false);
    const costDragAnchorRef = useRef<{ dayId: string; rowKey: string } | null>(null);
    const costDragBaseSelectionRef = useRef<Set<string>>(new Set());
    const dateInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
    const timeInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
    const knownPlaces = useMemo<PlaceResult[]>(() => {
        const places = new Map<string, PlaceResult>();
        days.flatMap((day) => day.activities).forEach((activity) => {
            if (!activity.placeId || !activity.location || activity.lat == null || activity.lon == null) return;
            places.set(activity.placeId, {
                id: activity.placeId,
                title: activity.location,
                displayTitle: activity.location,
                subtitle: activity.address ?? activity.placeSubtitle ?? "",
                lat: activity.lat,
                lon: activity.lon,
                provider: "plan",
            });
        });
        return [...places.values()];
    }, [days]);

    const addDay = () => {
        setDays((prev) => [
            ...prev,
            {
                id: createClientId("day"),
                date: prev[0]?.date ? addDaysIso(prev[0].date, prev.length) : "",
                dayTitle: `Day ${prev.length + 1}`,
                activities: [],
            },
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
        setDays((prev) => {
            const dayIndex = prev.findIndex((day) => day.id === dayId);
            if (dayIndex !== 0 || !isIsoDate(date)) {
                return prev.map((day) => (day.id === dayId ? { ...day, date } : day));
            }

            return prev.map((day, index) => ({
                ...day,
                date: addDaysIso(date, index),
            }));
        });
    };

    const addActivity = (dayId: string) => {
        const currentDay = days.find((day) => day.id === dayId);
        const newActivity: ItineraryActivity = {
            id: createClientId("activity"),
            time: "",
            location: "",
            activity: "",
            cost: 0,
            markerColor: template === "route_sheet" ? randomRouteMarkerColor(currentDay?.activities) : undefined,
        };
        setDays((prev) =>
            prev.map((day) => (day.id === dayId ? { ...day, activities: [...day.activities, newActivity] } : day))
        );
    };

    const addPreviousLodgingActivity = (dayId: string) => {
        setDays((prev) => {
            const dayIndex = prev.findIndex((day) => day.id === dayId);
            if (dayIndex <= 0) return prev;

            const previousLodging = [...prev.slice(0, dayIndex)]
                .reverse()
                .flatMap((day) => [...day.activities].reverse())
                .find((activity) => activity.routeRole === "LODGING");
            if (!previousLodging) return prev;

            const lodgingActivity: ItineraryActivity = {
                ...previousLodging,
                id: createClientId("activity"),
                time: "",
                activity: previousLodging.activity || "숙소",
                cost: 0,
                routeRole: "LODGING",
                markerColor: randomRouteMarkerColor(prev[dayIndex].activities),
            };

            return prev.map((day) =>
                day.id === dayId
                    ? { ...day, activities: [...day.activities, lodgingActivity] }
                    : day
            );
        });
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

    const moveTimelineActivity = (activeId: string, overId: string) => {
        setDays((prev) => {
            const source = findActivityLocation(prev, activeId);
            if (!source) return prev;

            const targetDayId = parseTimelineDayDropId(overId);
            const target = targetDayId
                ? { dayId: targetDayId, activityIndex: prev.find((day) => day.id === targetDayId)?.activities.length ?? -1 }
                : findActivityLocation(prev, overId);
            if (!target || target.activityIndex < 0) return prev;

            if (source.dayId === target.dayId && source.activityIndex === target.activityIndex) return prev;

            const movingActivity = prev
                .find((day) => day.id === source.dayId)
                ?.activities[source.activityIndex];
            if (!movingActivity) return prev;

            return prev.map((day) => {
                if (day.id !== source.dayId && day.id !== target.dayId) return day;

                if (source.dayId === target.dayId) {
                    const nextIndex = Math.min(target.activityIndex, day.activities.length - 1);
                    return { ...day, activities: arrayMove(day.activities, source.activityIndex, nextIndex) };
                }

                if (day.id === source.dayId) {
                    return {
                        ...day,
                        activities: day.activities.filter((activity) => activity.id !== activeId),
                    };
                }

                const nextActivities = [...day.activities];
                nextActivities.splice(Math.min(Math.max(target.activityIndex, 0), nextActivities.length), 0, movingActivity);
                return { ...day, activities: nextActivities };
            });
        });
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
                    tableColumnWidth: DEFAULT_TABLE_COLUMN_WIDTH,
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

    const addSpreadsheetTimeRow = () => {
        const normalized = nextSpreadsheetTimeRow(days);
        setDays((prev) => {
            return prev.map((day) => ({
                ...day,
                activities: [...day.activities, spreadsheetActivity(normalized)],
            }));
        });
    };

    const renameSpreadsheetTimeRow = (rowKey: string, nextValue: string) => {
        const normalized = normalizeSpreadsheetTime(nextValue);
        if (!normalized) return false;
        if (normalized === rowKey) return true;
        if (days.some((day) => day.activities.some((activity) => activity.time === normalized))) return false;
        setDays((prev) => {
            return prev.map((day) => ({
                ...day,
                activities: day.activities.map((activity) =>
                    activity.time === rowKey ? { ...activity, time: normalized } : activity
                ),
            }));
        });
        return true;
    };

    const resizeSpreadsheetColumn = (dayId: string, width: number) => {
        const nextWidth = clampTableSize(width, MIN_TABLE_COLUMN_WIDTH, MAX_TABLE_COLUMN_WIDTH);
        setDays((prev) => prev.map((day) => day.id === dayId ? { ...day, tableColumnWidth: nextWidth } : day));
    };

    const resizeSpreadsheetRow = (rowKey: string, height: number) => {
        const nextHeight = clampTableSize(height, MIN_TABLE_ROW_HEIGHT, MAX_TABLE_ROW_HEIGHT);
        setDays((prev) => prev.map((day) => ({
            ...day,
            activities: day.activities.map((activity) =>
                activity.time === rowKey ? { ...activity, rowHeight: nextHeight } : activity
            ),
        })));
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
                    address: undefined,
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
        const targetDay = days.find((d) => d.id === dayId);
        const targetActivity = targetDay?.activities.find((a) => a.time === rowKey);
        setSpreadsheetPlaceTarget({
            dayId,
            rowKey,
            query: trimmed.slice(PLACE_SEARCH_COMMAND.length).trim(),
            lat: targetActivity?.lat,
            lon: targetActivity?.lon,
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
                    address: place.subtitle,
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
        const targetDay = days.find((d) => d.id === dayId);
        const targetActivity = targetDay?.activities.find((a) => a.id === activityId);
        setActivityPlaceTarget({
            dayId,
            activityId,
            query,
            lat: targetActivity?.lat,
            lon: targetActivity?.lon,
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
                                    address: place.subtitle,
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
        if (rowKey === LODGING_ROW_KEY || rowKey.startsWith("__cost__:")) return;
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
                            테이블형 여행 템플릿
                        </div>
                        <p className="mt-1 text-sm text-gray-500">
                            날짜별 열과 일정/식비 행으로 보는 여행표입니다.
                        </p>
                        <SpreadsheetTemplate
                            days={days}
                            onAddDay={addSpreadsheetDay}
                            onAddRow={addSpreadsheetRow}
                            onAddTimeRow={addSpreadsheetTimeRow}
                            onRenameTimeRow={renameSpreadsheetTimeRow}
                            onResizeColumn={resizeSpreadsheetColumn}
                            onResizeRow={resizeSpreadsheetRow}
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
                                        tier={tier}
                                        planId={planId}
                                        planTitle={title}
                                        countryCode={countryCode}
                                        onUpgradeRequested={onTierPending}
                                        onTierSynced={onTierSynced}
                                        currency={currency}
                                        knownPlaces={knownPlaces}
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
                        timeErrors={timeErrors}
                        onSearchPlace={openActivityPlaceSearch}
                        onMoveActivity={moveTimelineActivity}
                    />
                )}

                {template === "route_sheet" && (
                    <RouteSheetTemplate
                        days={days}
                        currency={currency}
                        onAddDay={addDay}
                        onRemoveDay={removeDay}
                        onUpdateDayTitle={updateDayTitle}
                        onUpdateDayDate={updateDayDate}
                        onAddActivity={addActivity}
                        onAddPreviousLodging={addPreviousLodgingActivity}
                        onRemoveActivity={removeActivity}
                        onUpdateActivityField={updateActivityField}
                        onSetActivityTime={setTimeForActivity}
                        timeErrors={timeErrors}
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
                initialLat={spreadsheetPlaceTarget?.lat}
                initialLon={spreadsheetPlaceTarget?.lon}
                showFixedOption={Boolean(spreadsheetPlaceTarget && spreadsheetPlaceTarget.rowKey !== LODGING_ROW_KEY)}
                fixedOptionChecked={spreadsheetPlaceTarget?.fixed ?? false}
                onFixedOptionChange={(fixed) => {
                    setSpreadsheetPlaceTarget((current) => current ? { ...current, fixed } : current);
                }}
                paidPlaces={tier === "PAID"}
                tier={tier}
                planId={planId}
                planTitle={title}
                countryCode={countryCode}
                origin={spreadsheetPlaceTarget?.origin}
                knownPlaces={knownPlaces}
                onUpgradeRequested={onTierPending}
                onTierSynced={onTierSynced}
            />
            <PlaceSearchModal
                open={Boolean(activityPlaceTarget)}
                onClose={() => setActivityPlaceTarget(null)}
                onSelect={applyActivityPlace}
                initialQuery={activityPlaceTarget?.query}
                initialLat={activityPlaceTarget?.lat}
                initialLon={activityPlaceTarget?.lon}
                paidPlaces={tier === "PAID"}
                tier={tier}
                planId={planId}
                planTitle={title}
                countryCode={countryCode}
                origin={activityPlaceTarget?.origin}
                knownPlaces={knownPlaces}
                onUpgradeRequested={onTierPending}
                onTierSynced={onTierSynced}
            />
        </div>
    );
}

function SpreadsheetTemplate({
    days,
    onAddDay,
    onAddRow,
    onAddTimeRow,
    onRenameTimeRow,
    onResizeColumn,
    onResizeRow,
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
    onAddTimeRow: () => void;
    onRenameTimeRow: (rowKey: string, nextValue: string) => boolean;
    onResizeColumn: (dayId: string, width: number) => void;
    onResizeRow: (rowKey: string, height: number) => void;
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
    const tableWidth = TABLE_ROW_HEADER_WIDTH + days.reduce((sum, day) => sum + spreadsheetColumnWidth(day), 0);

    const beginColumnResize = (event: React.MouseEvent, day: ItineraryDay) => {
        event.preventDefault();
        const startX = event.clientX;
        const startWidth = spreadsheetColumnWidth(day);
        const handleMove = (moveEvent: MouseEvent) => {
            onResizeColumn(day.id, startWidth + moveEvent.clientX - startX);
        };
        const handleUp = () => {
            window.removeEventListener("mousemove", handleMove);
            window.removeEventListener("mouseup", handleUp);
        };
        window.addEventListener("mousemove", handleMove);
        window.addEventListener("mouseup", handleUp);
    };

    const beginRowResize = (event: React.MouseEvent, rowKey: string) => {
        event.preventDefault();
        const startY = event.clientY;
        const startHeight = spreadsheetRowHeight(days, rowKey);
        const handleMove = (moveEvent: MouseEvent) => {
            onResizeRow(rowKey, startHeight + moveEvent.clientY - startY);
        };
        const handleUp = () => {
            window.removeEventListener("mousemove", handleMove);
            window.removeEventListener("mouseup", handleUp);
        };
        window.addEventListener("mousemove", handleMove);
        window.addEventListener("mouseup", handleUp);
    };

    const commitTimeInput = (rowKey: string, input: HTMLInputElement) => {
        const normalized = normalizeSpreadsheetTime(input.value);
        if (!normalized || !onRenameTimeRow(rowKey, normalized)) {
            input.value = rowKey;
            return;
        }
        input.value = normalized;
    };

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
                    onClick={onAddTimeRow}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-900 sm:text-sm"
                >
                    <Clock className="h-4 w-4" />
                    시간 행 추가
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
                    <table
                        className="table-fixed border-collapse text-center text-[11px] sm:text-xs"
                        style={{ width: tableWidth, minWidth: tableWidth }}
                    >
                    <colgroup>
                        <col style={{ width: TABLE_ROW_HEADER_WIDTH, minWidth: TABLE_ROW_HEADER_WIDTH }} />
                        {days.map((day) => (
                            <col key={day.id} style={{ width: spreadsheetColumnWidth(day), minWidth: spreadsheetColumnWidth(day) }} />
                        ))}
                    </colgroup>
                    <thead>
                    <tr className="bg-gray-100">
                            <th
                                className="sticky left-0 z-10 border border-gray-300 bg-gray-100 px-2 py-2 text-left font-bold"
                                style={{ width: TABLE_ROW_HEADER_WIDTH, minWidth: TABLE_ROW_HEADER_WIDTH }}
                            >
                                시간
                            </th>
                            {days.map((day, index) => (
                                <th
                                    key={day.id}
                                    className="group relative border border-gray-300 px-2 py-2 font-bold"
                                    style={{ width: spreadsheetColumnWidth(day), minWidth: spreadsheetColumnWidth(day) }}
                                >
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
                                    <div
                                        role="separator"
                                        aria-label={`${index + 1}일차 열 너비 조절`}
                                        title="열 너비 조절"
                                        onMouseDown={(event) => beginColumnResize(event, day)}
                                        className="absolute -right-1 top-0 h-full w-2 cursor-col-resize bg-transparent after:absolute after:inset-y-1 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-gray-300 hover:after:w-1 hover:after:bg-gray-950"
                                    />
                            </th>
                        ))}
                    </tr>
                    </thead>
                    <tbody>
                        {rowKeys.map((rowKey) => (
                            <tr key={rowKey} className={spreadsheetRowClass(rowKey)}>
                                <th
                                    className="group sticky left-0 z-10 border border-gray-300 bg-gray-100 px-2 py-2 text-left font-bold"
                                    style={{ height: spreadsheetRowHeight(days, rowKey), minHeight: spreadsheetRowHeight(days, rowKey) }}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        {isSpreadsheetTimeRow(rowKey) ? (
                                            <input
                                                type="text"
                                                defaultValue={rowKey}
                                                inputMode="numeric"
                                                pattern="[0-9]{1,2}:[0-9]{2}"
                                                onBlur={(event) => commitTimeInput(rowKey, event.currentTarget)}
                                                onKeyDown={(event) => {
                                                    if (event.key !== "Enter") return;
                                                    commitTimeInput(rowKey, event.currentTarget);
                                                }}
                                                className="w-20 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs font-black tabular-nums text-gray-950 focus:border-gray-300 focus:bg-white focus:outline-none"
                                                aria-label={`${rowKey} 시간 수정`}
                                            />
                                        ) : (
                                            <span>{spreadsheetRowLabel(rowKey)}</span>
                                        )}
                                        {(rowKey.startsWith("__custom__:") || isSpreadsheetTimeRow(rowKey)) && (
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
                                    <div
                                        role="separator"
                                        aria-label={`${spreadsheetRowLabel(rowKey)} 행 높이 조절`}
                                        title="행 높이 조절"
                                        onMouseDown={(event) => beginRowResize(event, rowKey)}
                                        className="absolute -bottom-1 left-0 h-2 w-full cursor-row-resize bg-transparent after:absolute after:left-1 after:right-1 after:top-1/2 after:h-px after:-translate-y-1/2 after:bg-gray-300 hover:after:h-1 hover:after:bg-gray-950"
                                    />
                                </th>
                                {days.map((day) => {
                                    const isCostRow = isSpreadsheetCostRow(rowKey);
                                    const activity = spreadsheetCellActivity(day, rowKey);
                                    const hasLinkedPlace = !isCostRow && spreadsheetActivityHasPlace(activity);
                                    const columnHasLinkedPlace = spreadsheetDayHasPlace(day);
                                    const cellKey = spreadsheetCellKey(day.id, rowKey);
                                    const isSelected = selectedCostCellKeys.has(cellKey);
                                    return (
                                    <td
                                        key={`${day.id}-${rowKey}`}
                                        className={`border border-gray-300 p-0 align-middle ${
                                            hasLinkedPlace ? spreadsheetLinkedPlaceCellClass(rowKey) : ""
                                        } ${
                                            isSelected ? "ring-2 ring-inset ring-gray-950" : ""
                                        }`}
                                        style={{
                                            width: spreadsheetColumnWidth(day),
                                            minWidth: spreadsheetColumnWidth(day),
                                            height: spreadsheetRowHeight(days, rowKey),
                                            minHeight: spreadsheetRowHeight(days, rowKey),
                                        }}
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
                                            placeholder={!columnHasLinkedPlace && (rowKey === LODGING_ROW_KEY || isSpreadsheetTimeRow(rowKey)) ? "/장소검색 신주쿠" : undefined}
                                            inputMode={isCostRow ? "numeric" : undefined}
                                            className={`h-full w-full bg-transparent px-2 text-center text-[11px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-950 sm:text-xs ${
                                                isCostRow ? "font-semibold tabular-nums" : ""
                                            } ${
                                                hasLinkedPlace ? "font-black text-gray-950" : ""
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
    timeErrors,
    onSearchPlace,
    onMoveActivity,
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
    timeErrors: Record<string, ActivityError>;
    onSearchPlace: (dayId: string, activityId: string, query: string) => void;
    onMoveActivity: (activeId: string, overId: string) => void;
}) {
    const [overviewOpen, setOverviewOpen] = useState(false);
    const timelineScrollRef = useRef<HTMLDivElement | null>(null);
    const timelineDayRefs = useRef(new Map<string, HTMLElement>());

    const handleActivityDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        onMoveActivity(String(active.id), String(over.id));
    };

    const scrollToLastDay = () => {
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                const element = timelineScrollRef.current;
                if (!element) return;
                element.scrollTo({ left: element.scrollWidth, behavior: "smooth" });
            });
        });
    };

    const addDayAndReveal = () => {
        onAddDay();
        scrollToLastDay();
    };

    const revealDay = (dayId: string) => {
        const element = timelineDayRefs.current.get(dayId);
        element?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    };

    const openInputPicker = (event: React.PointerEvent<HTMLLabelElement>) => {
        if (event.target instanceof HTMLInputElement) return;
        const input = event.currentTarget.querySelector("input");
        input?.focus();
        try {
            input?.showPicker?.();
        } catch {
            // Browser fallback: focusing the native input is enough when showPicker is unavailable.
        }
    };

    return (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 bg-white px-4 py-5 sm:px-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                        <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-black text-gray-700">
                            <Sparkles className="h-3.5 w-3.5 text-rose-500" />
                            트립 보드
                        </div>
                        <h2 className="mt-3 truncate text-2xl font-black text-gray-950">{title || "여행 계획"}</h2>
                    </div>
                    <button
                        type="button"
                        onClick={() => setOverviewOpen(true)}
                        className="inline-flex w-fit shrink-0 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-black text-gray-800 shadow-sm transition hover:border-gray-950 hover:text-gray-950 lg:ml-auto"
                    >
                        <Eye className="h-4 w-4" />
                        한눈에 보기
                    </button>
                </div>
            </div>

            <div className="bg-gray-50 p-3 sm:p-5">
                <div ref={timelineScrollRef} className="max-w-full overflow-x-auto overscroll-x-contain pb-3 [scrollbar-gutter:stable]">
                    <DndContext collisionDetection={pointerWithin} onDragEnd={handleActivityDragEnd}>
                        <div className="flex w-max min-w-full items-stretch gap-4">
                            {days.map((day, dayIndex) => {
                                const dayCost = day.activities.reduce((sum, activity) => sum + (Number(activity.cost) || 0), 0);
                                return (
                                    <section
                                        key={day.id}
                                        ref={(element) => {
                                            if (element) timelineDayRefs.current.set(day.id, element);
                                            else timelineDayRefs.current.delete(day.id);
                                        }}
                                        className="w-[min(86vw,22rem)] shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm sm:w-80 xl:w-96"
                                    >
                                        <div
                                            className="cursor-pointer border-b border-gray-200 bg-gray-950 px-4 py-4 text-white"
                                            onClick={() => revealDay(day.id)}
                                        >
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
                                            <div className="mt-4 space-y-2">
                                                <label
                                                    className="flex min-w-0 cursor-pointer items-center gap-2 rounded-lg bg-white/10 px-3 py-2"
                                                    onPointerDown={openInputPicker}
                                                >
                                                    <CalendarDays className="h-4 w-4 text-white/65" />
                                                    <input
                                                        type="date"
                                                        value={day.date}
                                                        onChange={(event) => onUpdateDayDate(day.id, event.target.value)}
                                                        className="min-w-0 flex-1 cursor-pointer bg-transparent text-sm font-bold text-white focus:outline-none [&::-webkit-calendar-picker-indicator]:hidden"
                                                    />
                                                </label>
                                                <div className="rounded-lg bg-white px-3 py-2 text-right text-sm font-black text-gray-950">
                                                    {formatCurrencyAmount(dayCost, currency)}
                                                </div>
                                            </div>
                                        </div>

                                        <SortableContext items={day.activities.map((activity) => activity.id)} strategy={verticalListSortingStrategy}>
                                            <TimelineDayDropArea dayId={day.id}>
                                                {day.activities.map((activity, activityIndex) => (
                                                    <SortableTimelineActivityCard
                                                        key={activity.id}
                                                        activity={activity}
                                                        activityIndex={activityIndex}
                                                        dayId={day.id}
                                                        timeError={timeErrors[activity.id]}
                                                        onRemoveActivity={onRemoveActivity}
                                                        onUpdateActivityField={onUpdateActivityField}
                                                        onSetActivityTime={onSetActivityTime}
                                                        onSearchPlace={onSearchPlace}
                                                        openInputPicker={openInputPicker}
                                                    />
                                                ))}
                                                <button
                                                    type="button"
                                                    onClick={() => onAddActivity(day.id)}
                                                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-4 py-3 text-sm font-black text-gray-700 hover:border-gray-950 hover:text-gray-950"
                                                >
                                                    <Plus className="h-4 w-4" />
                                                    스팟 추가
                                                </button>
                                            </TimelineDayDropArea>
                                        </SortableContext>
                                    </section>
                                );
                            })}
                            <button
                                type="button"
                                onClick={addDayAndReveal}
                                className="flex min-h-64 w-[min(70vw,16rem)] shrink-0 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-300 bg-white px-5 py-5 text-sm font-black text-gray-700 shadow-sm transition hover:border-gray-950 hover:bg-gray-50 hover:text-gray-950"
                            >
                                <Plus className="h-6 w-6" />
                                Day 추가
                            </button>
                        </div>
                    </DndContext>
                </div>
                <div className="mt-4 rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <div className="text-xs font-black text-gray-500">총 경비</div>
                            <div className="mt-1 text-2xl font-black tracking-normal text-gray-950">{formatCurrencyAmount(totalCost, currency)}</div>
                        </div>
                        <div className="flex flex-wrap gap-2 text-sm font-bold text-gray-500">
                            <span>{days.length}일 일정</span>
                            {preparationCost > 0 && <span>준비물 비용 {formatCurrencyAmount(preparationCost, currency)} 포함</span>}
                        </div>
                    </div>
                </div>
            </div>
            {overviewOpen && (
                <div className="fixed inset-0 z-50 bg-gray-950/60 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true">
                    <div className="mx-auto flex max-h-[calc(100vh-1.5rem)] max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl sm:max-h-[calc(100vh-3rem)]">
                        <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-4 sm:px-6">
                            <div className="min-w-0">
                                <div className="text-xs font-black text-gray-500">전체 일정</div>
                                <h3 className="truncate text-xl font-black text-gray-950">{title || "여행 계획"}</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setOverviewOpen(false)}
                                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-950"
                                aria-label="한눈에 보기 닫기"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="overflow-auto p-4 sm:p-6">
                            <div className="grid gap-4 lg:grid-cols-2">
                                {days.map((day, dayIndex) => (
                                    <section key={day.id} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                                        <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3">
                                            <div className="min-w-0">
                                                <div className="text-xs font-black text-gray-500">Day {dayIndex + 1}</div>
                                                <div className="truncate text-base font-black text-gray-950">{day.dayTitle || `Day ${dayIndex + 1}`}</div>
                                            </div>
                                            {day.date && <div className="shrink-0 text-sm font-bold text-gray-500">{day.date}</div>}
                                        </div>
                                        <div className="divide-y divide-gray-100">
                                            {day.activities.length === 0 ? (
                                                <div className="px-4 py-5 text-sm font-semibold text-gray-400">등록된 스팟이 없습니다.</div>
                                            ) : (
                                                day.activities.map((activity, activityIndex) => (
                                                    <div key={activity.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 px-4 py-3">
                                                        <div className="text-sm font-black tabular-nums text-gray-950">{activity.time || "--:--"}</div>
                                                        <div className="min-w-0">
                                                            <div className="truncate text-sm font-black text-gray-950">
                                                                {activity.location || `스팟 ${activityIndex + 1}`}
                                                            </div>
                                                            {activity.activity && (
                                                                <div className="mt-1 line-clamp-2 text-sm font-medium leading-5 text-gray-500">{activity.activity}</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </section>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function TimelineDayDropArea({ dayId, children }: { dayId: string; children: React.ReactNode }) {
    const { isOver, setNodeRef } = useDroppable({ id: timelineDayDropId(dayId) });
    return (
        <div
            ref={setNodeRef}
            className={`min-h-28 space-y-3 bg-gray-50 p-3 transition-colors ${isOver ? "bg-gray-100 ring-2 ring-inset ring-gray-950/10" : ""}`}
        >
            {children}
        </div>
    );
}

function SortableTimelineActivityCard({
    activity,
    activityIndex,
    dayId,
    timeError,
    onRemoveActivity,
    onUpdateActivityField,
    onSetActivityTime,
    onSearchPlace,
    openInputPicker,
}: {
    activity: ItineraryActivity;
    activityIndex: number;
    dayId: string;
    timeError: ActivityError;
    onRemoveActivity: (dayId: string, activityId: string) => void;
    onUpdateActivityField: (dayId: string, activityId: string, field: keyof ItineraryActivity, value: string | number) => void;
    onSetActivityTime: (dayId: string, activityId: string, nextTime: string) => void;
    onSearchPlace: (dayId: string, activityId: string, query: string) => void;
    openInputPicker: (event: React.PointerEvent<HTMLLabelElement>) => void;
}) {
    const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition, isDragging } = useSortable({ id: activity.id });
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.82 : 1,
        zIndex: isDragging ? 20 : undefined,
    };

    return (
        <article ref={setNodeRef} style={style} className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                    <button
                        type="button"
                        ref={setActivatorNodeRef}
                        className="inline-flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 active:cursor-grabbing"
                        aria-label={`스팟 ${activityIndex + 1} 순서 변경`}
                        {...attributes}
                        {...listeners}
                    >
                        <GripVertical className="h-4 w-4" />
                    </button>
                    <span className="shrink-0 rounded-full bg-gray-950 px-2.5 py-1 text-xs font-black text-white">
                        스팟 {activityIndex + 1}
                    </span>
                    <select
                        value={activity.routeRole ?? "NONE"}
                        onChange={(event) => onUpdateActivityField(dayId, activity.id, "routeRole", event.target.value)}
                        className="min-w-0 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-black text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-950/10"
                        aria-label={`스팟 ${activityIndex + 1} 고정 설정`}
                    >
                        {ROUTE_ROLE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </div>
                <button
                    type="button"
                    onClick={() => onRemoveActivity(dayId, activity.id)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="스팟 삭제"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
            <div className="space-y-2 p-3">
                <label
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 ${
                        timeError ? "border-red-300 bg-red-50" : "border-gray-200 bg-gray-50"
                    }`}
                    onPointerDown={openInputPicker}
                >
                    <Clock className="h-4 w-4 shrink-0 text-gray-500" />
                    <input
                        type="time"
                        value={activity.time}
                        onChange={(event) => onSetActivityTime(dayId, activity.id, event.target.value)}
                        className="min-w-0 flex-1 cursor-pointer bg-transparent text-sm font-black text-gray-900 focus:outline-none [&::-webkit-calendar-picker-indicator]:hidden"
                    />
                </label>
                {timeError?.message && <p className="px-1 text-xs font-semibold text-red-600">{timeError.message}</p>}
                <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
                    <MapPin className="h-4 w-4 shrink-0 text-gray-500" />
                    <input
                        value={activity.location}
                        onChange={(event) => onUpdateActivityField(dayId, activity.id, "location", event.target.value)}
                        onClick={() => onSearchPlace(dayId, activity.id, activity.location)}
                        className="min-w-0 flex-1 bg-transparent text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:outline-none"
                        placeholder="장소"
                    />
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            onSearchPlace(dayId, activity.id, activity.location);
                        }}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-950"
                        aria-label="장소 검색"
                    >
                        <Search className="h-4 w-4" />
                    </button>
                </label>
                <textarea
                    value={activity.activity}
                    onChange={(event) => onUpdateActivityField(dayId, activity.id, "activity", event.target.value)}
                    className="min-h-20 w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold leading-5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-950/10"
                    placeholder="일정 메모"
                />
                <input
                    value={activity.cost ? String(activity.cost) : ""}
                    inputMode="numeric"
                    onChange={(event) => onUpdateActivityField(dayId, activity.id, "cost", Number(event.target.value.replace(/[^\d]/g, "")) || 0)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-black text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-950/10"
                    placeholder="비용"
                />
            </div>
        </article>
    );
}

function RouteSheetTemplate({
    days,
    currency,
    onAddDay,
    onRemoveDay,
    onUpdateDayTitle,
    onUpdateDayDate,
    onAddActivity,
    onAddPreviousLodging,
    onRemoveActivity,
    onUpdateActivityField,
    onSetActivityTime,
    timeErrors,
    onReorderRouteStops,
    onSearchPlace,
}: {
    days: ItineraryDay[];
    currency: CurrencyRate;
    onAddDay: () => void;
    onRemoveDay: (dayId: string) => void;
    onUpdateDayTitle: (dayId: string, title: string) => void;
    onUpdateDayDate: (dayId: string, date: string) => void;
    onAddActivity: (dayId: string) => void;
    onAddPreviousLodging: (dayId: string) => void;
    onRemoveActivity: (dayId: string, activityId: string) => void;
    onUpdateActivityField: (dayId: string, activityId: string, field: keyof ItineraryActivity, value: string | number) => void;
    onSetActivityTime: (dayId: string, activityId: string, nextTime: string) => void;
    timeErrors: Record<string, ActivityError>;
    onReorderRouteStops: (dayId: string, activeId: string, overId: string) => void;
    onSearchPlace: (dayId: string, activityId: string, query: string) => void;
}) {
    const [selectedRouteStops, setSelectedRouteStops] = useState<Record<string, RouteStopSelection>>({});
    const routeEditorScrollKeyRef = useRef<string | null>(null);

    const handleRouteDragEnd = (dayId: string, event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        onReorderRouteStops(dayId, String(active.id), String(over.id));
    };

    const selectRouteStop = (dayId: string, activityId: string | null, source: RouteStopSelectionSource = "card") => {
        if (!activityId || source === "card") routeEditorScrollKeyRef.current = null;
        setSelectedRouteStops((prev) => ({ ...prev, [dayId]: activityId ? { id: activityId, source } : null }));
    };

    const scrollRouteEditorIntoView = (element: HTMLDivElement | null, key: string) => {
        if (!element || routeEditorScrollKeyRef.current === key) return;
        routeEditorScrollKeyRef.current = key;
        window.requestAnimationFrame(() => {
            element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        });
    };

    return (
        <div className="space-y-5">
            {days.map((day, dayIndex) => {
                const routeStops = day.activities.filter((activity) => !isRouteSheetFood(activity));
                const previousLodging = dayIndex > 0
                    ? days
                        .slice(0, dayIndex)
                        .flatMap((previousDay) => previousDay.activities)
                        .findLast((activity) => activity.routeRole === "LODGING")
                    : null;
                const canAddPreviousLodging = Boolean(previousLodging);
                const selectedRouteStop = selectedRouteStops[day.id] ?? null;
                const selectedRouteStopId = selectedRouteStop?.id ?? null;
                const selectedRouteActivity = routeStops.find((activity) => activity.id === selectedRouteStopId) ?? null;
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
                                <RouteLineDiagram
                                    dayId={day.id}
                                    stops={routeStops}
                                    currency={currency}
                                    selectedStopId={selectedRouteStopId}
                                    selectedSource={selectedRouteStop?.source ?? null}
                                    onSelectStop={(activityId, source) => selectRouteStop(day.id, activityId, source)}
                                    onRemoveActivity={onRemoveActivity}
                                    onUpdateActivityField={onUpdateActivityField}
                                    onSetActivityTime={onSetActivityTime}
                                    timeErrors={timeErrors}
                                    onSearchPlace={onSearchPlace}
                                />
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
                                                currency={currency}
                                                selected={activity.id === selectedRouteStopId}
                                                onSelect={() => selectRouteStop(day.id, activity.id, "card")}
                                            />
                                        ))}
                                    </div>
                                    {selectedRouteActivity && selectedRouteStop?.source === "card" && (
                                        <div
                                            ref={(element) => scrollRouteEditorIntoView(element, `${day.id}:${selectedRouteActivity.id}`)}
                                            className="mt-3 rounded-xl border border-gray-200 bg-white p-3 shadow-lg"
                                        >
                                            <RouteStopEditor
                                                dayId={day.id}
                                                stop={selectedRouteActivity}
                                                stopIndex={routeStops.findIndex((activity) => activity.id === selectedRouteActivity.id)}
                                                totalStops={routeStops.length}
                                                timeError={timeErrors[selectedRouteActivity.id]}
                                                onClose={() => selectRouteStop(day.id, null)}
                                                onRemove={() => {
                                                    onRemoveActivity(day.id, selectedRouteActivity.id);
                                                    selectRouteStop(day.id, null);
                                                }}
                                                onUpdateActivityField={onUpdateActivityField}
                                                onSetActivityTime={onSetActivityTime}
                                                onSearchPlace={onSearchPlace}
                                            />
                                        </div>
                                    )}
                                </SortableContext>
                            </DndContext>
                            <div className="grid gap-2 sm:grid-cols-2">
                                <button
                                    type="button"
                                    onClick={() => onAddActivity(day.id)}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-3 text-sm font-black text-gray-700 hover:border-gray-950 hover:text-gray-950"
                                >
                                    <Plus className="h-4 w-4" />
                                    스팟 추가
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onAddPreviousLodging(day.id)}
                                    disabled={!canAddPreviousLodging}
                                    title={dayIndex === 0 ? "Day 2부터 이전 숙소를 추가할 수 있습니다." : canAddPreviousLodging ? `${previousLodging?.location || "이전 숙소"} 추가` : "이전 일정에 숙소 고정 스팟이 없습니다."}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-3 text-sm font-black text-gray-700 hover:border-gray-950 hover:text-gray-950 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
                                >
                                    <MapPin className="h-4 w-4" />
                                    숙소 추가
                                </button>
                            </div>
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
    currency,
    selectedStopId,
    selectedSource,
    onSelectStop,
    onRemoveActivity,
    onUpdateActivityField,
    onSetActivityTime,
    timeErrors,
    onSearchPlace,
}: {
    dayId: string;
    stops: ItineraryActivity[];
    currency: CurrencyRate;
    selectedStopId: string | null;
    selectedSource: RouteStopSelectionSource | null;
    onSelectStop: (activityId: string | null, source?: RouteStopSelectionSource) => void;
    onRemoveActivity: (dayId: string, activityId: string) => void;
    onUpdateActivityField: (dayId: string, activityId: string, field: keyof ItineraryActivity, value: string | number) => void;
    onSetActivityTime: (dayId: string, activityId: string, nextTime: string) => void;
    timeErrors: Record<string, ActivityError>;
    onSearchPlace: (dayId: string, activityId: string, query: string) => void;
}) {
    const lineStops = routeSheetLineStops(stops);
    const fallbackPoints = routeSheetMapPoints(lineStops);
    const [mapPoints, setMapPoints] = useState<Array<{ x: number; y: number }>>(fallbackPoints);
    const points = mapPoints.length === lineStops.length ? mapPoints : fallbackPoints;
    const segments = routeSheetSegments(points);
    const panelRef = useRef<HTMLDivElement | null>(null);
    const selectedStopIndex = stops.findIndex((stop) => stop.id === selectedStopId);
    const selectedStop = selectedStopIndex >= 0 ? stops[selectedStopIndex] : null;
    const selectedPoint = selectedStop ? routePointForStop(selectedStop, lineStops, points) ?? points[selectedStopIndex] ?? points[points.length - 1] : null;
    const panelOpensLeft = selectedPoint ? selectedPoint.x > 68 : false;
    const panelTop = selectedPoint ? Math.max(3, Math.min(72, selectedPoint.y - 5)) : 0;
    const selectedTimeError = selectedStop ? timeErrors[selectedStop.id] : null;

    useEffect(() => {
        if (!selectedStopId) return;

        const closeOnOutsidePointerDown = (event: PointerEvent) => {
            const target = event.target as HTMLElement | null;
            if (!target) return;
            if (panelRef.current?.contains(target)) return;
            if (target.closest("[data-route-marker='true']")) return;
            if (target.closest("[data-route-spot-card='true']")) return;
            if (target.closest("[data-route-editor='true']")) return;
            onSelectStop(null);
        };

        document.addEventListener("pointerdown", closeOnOutsidePointerDown);
        return () => document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
    }, [onSelectStop, selectedStopId]);

    return (
        <div className="relative isolate h-[430px] w-[920px] max-w-none overflow-visible rounded-xl bg-gray-100">
            <RoutePlanMapBackground stops={lineStops} fallbackPoints={fallbackPoints} onPointsChange={setMapPoints} />
            <div className="pointer-events-none absolute inset-0 z-10 bg-white/10" />
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 z-20 h-full w-full">
                <defs>
                    {segments.map((segment, index) => (
                        <linearGradient key={segment.id} id={segment.id} x1={`${segment.from.x}%`} y1={`${segment.from.y}%`} x2={`${segment.to.x}%`} y2={`${segment.to.y}%`}>
                            <stop offset="0%" stopColor={routeMarkerColor(lineStops[index], index, lineStops.length)} />
                            <stop offset="100%" stopColor={routeMarkerColor(lineStops[index + 1], index + 1, lineStops.length)} />
                        </linearGradient>
                    ))}
                </defs>
                {segments.map((segment) => (
                    <path key={`${segment.id}-base`} d={segment.path} fill="none" stroke="#ffffff" strokeWidth="5.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.88" />
                ))}
                {segments.map((segment) => (
                    <path key={segment.id} d={segment.path} fill="none" stroke={`url(#${segment.id})`} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.94" />
                ))}
            </svg>
            {segments.map((segment, index) => {
                const cost = Number(lineStops[index + 1]?.cost) || 0;
                if (cost <= 0) return null;
                return (
                    <div
                        key={`${segment.id}-cost`}
                        className="pointer-events-none absolute z-30 rounded-full border border-emerald-100 bg-white/95 px-2 py-1 text-[10px] font-black text-emerald-700 shadow-sm"
                        style={{
                            left: `${segment.mid.x}%`,
                            top: `${segment.mid.y}%`,
                            transform: "translate(-50%, -50%)",
                        }}
                    >
                        {formatCurrencyAmount(cost, currency)}
                    </div>
                );
            })}
            {stops.map((activity, index) => {
                const point = routePointForStop(activity, lineStops, points) ?? points[index] ?? points[points.length - 1];
                const isSelected = activity.id === selectedStopId;
                return (
                    <RouteMarker
                        key={activity.id}
                        activity={activity}
                        index={index}
                        total={stops.length}
                        point={point}
                        selected={isSelected}
                        onSelect={() => onSelectStop(activity.id, "marker")}
                    />
                );
            })}
            {selectedStop && selectedPoint && selectedSource === "marker" && (
                <div
                    ref={panelRef}
                    className="absolute z-50 w-[min(22rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 bg-white/95 p-3 shadow-xl backdrop-blur"
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
                    <RouteStopEditor
                        dayId={dayId}
                        stop={selectedStop}
                        stopIndex={selectedStopIndex}
                        totalStops={stops.length}
                        timeError={selectedTimeError}
                        onClose={() => onSelectStop(null)}
                        onRemove={() => {
                            onRemoveActivity(dayId, selectedStop.id);
                            onSelectStop(null);
                        }}
                        onUpdateActivityField={onUpdateActivityField}
                        onSetActivityTime={onSetActivityTime}
                        onSearchPlace={onSearchPlace}
                    />
                </div>
            )}
        </div>
    );
}

function RouteStopEditor({
    dayId,
    stop,
    stopIndex,
    totalStops,
    timeError,
    onClose,
    onRemove,
    onUpdateActivityField,
    onSetActivityTime,
    onSearchPlace,
}: {
    dayId: string;
    stop: ItineraryActivity;
    stopIndex: number;
    totalStops: number;
    timeError: ActivityError;
    onClose: () => void;
    onRemove: () => void;
    onUpdateActivityField: (dayId: string, activityId: string, field: keyof ItineraryActivity, value: string | number) => void;
    onSetActivityTime: (dayId: string, activityId: string, nextTime: string) => void;
    onSearchPlace: (dayId: string, activityId: string, query: string) => void;
}) {
    const openTimePicker = (event: React.PointerEvent<HTMLInputElement>) => {
        try {
            event.currentTarget.showPicker?.();
        } catch {
            event.currentTarget.focus();
        }
    };
    const openPlaceSearch = () => onSearchPlace(dayId, stop.id, stop.location);

    return (
        <div data-route-editor="true">
            <div className="mb-2 flex items-center justify-between gap-2">
                <div className="min-w-0 text-sm font-black text-gray-950">선택한 스팟</div>
                <div className="flex shrink-0 items-center gap-1">
                    <button
                        type="button"
                        onClick={onRemove}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"
                        aria-label="루트 스팟 삭제"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        aria-label="스팟 수정 닫기"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>
            <div className="max-h-[min(25rem,calc(100vh-8rem))] space-y-2 overflow-y-auto pr-1">
                <label className="block">
                    <span className="mb-1 block text-xs font-black text-gray-500">시간</span>
                    <input
                        type="time"
                        value={stop.time}
                        onPointerDown={openTimePicker}
                        onChange={(event) => onSetActivityTime(dayId, stop.id, event.target.value)}
                        className={`w-full rounded-lg border bg-white px-3 py-2 text-sm font-black text-gray-900 focus:outline-none focus:ring-2 ${
                            timeError
                                ? "border-red-300 focus:ring-red-200"
                                : "border-gray-200 focus:ring-yellow-300"
                        }`}
                    />
                    {timeError && (
                        <p className="mt-1 rounded-lg bg-red-50 px-2 py-1 text-xs font-black text-red-600">
                            {timeError.message}
                        </p>
                    )}
                </label>
                <label className="block">
                    <span className="mb-1 block text-xs font-black text-gray-500">장소</span>
                    <button
                        type="button"
                        onClick={openPlaceSearch}
                        className="flex w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                    >
                        <span className="min-w-0 flex-1 truncate text-sm font-bold text-gray-900">
                            {stop.location || "장소 검색"}
                        </span>
                        <Search className="h-4 w-4 shrink-0 text-gray-500" />
                    </button>
                </label>
                <label className="block">
                    <span className="mb-1 block text-xs font-black text-gray-500">주소</span>
                    <input
                        value={routeStopAddress(stop)}
                        onChange={(event) => onUpdateActivityField(dayId, stop.id, "address", event.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                        placeholder="주소"
                    />
                </label>
                <label className="block">
                    <span className="mb-1 block text-xs font-black text-gray-500">비용</span>
                    <input
                        inputMode="numeric"
                        value={stop.cost ? formatCostInput(String(stop.cost)) : ""}
                        onChange={(event) => onUpdateActivityField(dayId, stop.id, "cost", parseCostAmount(event.target.value))}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                        placeholder="비용"
                    />
                </label>
                <label className="block">
                    <span className="mb-1 block text-xs font-black text-gray-500">스팟 고정</span>
                    <select
                        value={stop.routeRole ?? "NONE"}
                        onChange={(event) => onUpdateActivityField(dayId, stop.id, "routeRole", event.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                    >
                        {ROUTE_ROLE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </label>
                <div>
                    <span className="mb-1 block text-xs font-black text-gray-500">마커 색상</span>
                    <div className="grid grid-cols-9 gap-1.5">
                        {ROUTE_MARKER_COLORS.map((color) => {
                            const isActive = (stop.markerColor ?? "") === color.value;
                            return (
                                <button
                                    key={color.value}
                                    type="button"
                                    onClick={() => onUpdateActivityField(dayId, stop.id, "markerColor", color.value)}
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
                            value={stop.markerColor ?? routeMarkerColor(stop, stopIndex, totalStops)}
                            onChange={(event) => onUpdateActivityField(dayId, stop.id, "markerColor", event.target.value)}
                            className="ml-auto h-7 w-12 cursor-pointer rounded border-0 bg-transparent p-0"
                            aria-label="사용자 지정 마커 색상"
                        />
                    </label>
                </div>
                <label className="block">
                    <span className="mb-1 block text-xs font-black text-gray-500">내용</span>
                    <textarea
                        value={stop.activity}
                        onChange={(event) => onUpdateActivityField(dayId, stop.id, "activity", event.target.value)}
                        className="min-h-28 w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold leading-5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                        placeholder="일정 내용"
                    />
                </label>
                <label className="block">
                    <span className="mb-1 block text-xs font-black text-gray-500">소요 시간</span>
                    <input
                        value={routeStopDuration(stop)}
                        onChange={(event) => onUpdateActivityField(dayId, stop.id, "placeSubtitle", event.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                        placeholder="예: 50분"
                    />
                </label>
            </div>
        </div>
    );
}

function RouteMarker({
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
    const markerColor = routeMarkerColor(activity, index, total);
    const style: React.CSSProperties = {
        left: `${point.x}%`,
        top: `${point.y}%`,
        transform: "translate(-50%, -50%)",
        zIndex: 30,
    };

    return (
        <div className="absolute flex w-36 flex-col items-center text-center" style={style}>
            <button
                type="button"
                onClick={onSelect}
                data-route-marker="true"
                className={`relative flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-md transition focus:outline-none focus:ring-4 focus:ring-gray-950/20 ${selected ? "ring-4 ring-gray-950/20" : "hover:scale-105"}`}
                aria-label={`${activity.location || `스팟 ${index + 1}`} 입력 열기`}
            >
                <MapPin className="h-10 w-10 drop-shadow-sm" fill="currentColor" strokeWidth={2.2} style={{ color: markerColor }} />
                <span className="absolute top-2 text-[11px] font-black text-white">
                    {index + 1}
                </span>
                <span
                    className="hidden"
                    aria-label="마커 순서 변경"
                >
                    <GripVertical className="h-3.5 w-3.5" />
                </span>
            </button>
            <div className="mt-1.5 max-w-36 rounded-lg border border-gray-200 bg-white/95 px-2.5 py-1.5 text-center text-xs font-black leading-4 text-gray-950 shadow-sm backdrop-blur">
                <div className="truncate">{activity.location || "장소"}</div>
                <div className="mt-0.5 text-[10px] font-bold leading-3 text-gray-500">{activity.time || "--:--"}</div>
                {activity.routeRole && activity.routeRole !== "NONE" && (
                    <div className="mx-auto mt-1 w-fit max-w-full truncate rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-black leading-3 text-gray-600">{routeRoleLabel(activity.routeRole)}</div>
                )}
            </div>
        </div>
    );
}

function RoutePlanMapBackground({
    stops,
    fallbackPoints,
    onPointsChange,
}: {
    stops: ItineraryActivity[];
    fallbackPoints: Array<{ x: number; y: number }>;
    onPointsChange: (points: Array<{ x: number; y: number }>) => void;
}) {
    const mapElementRef = useRef<HTMLDivElement | null>(null);
    const leafletMapRef = useRef<LeafletMap | null>(null);
    const fallbackPointsRef = useRef(fallbackPoints);
    const stopsRef = useRef(stops);
    const coordinateKey = routeCoordinateKey(stops);
    const coordinateKeyRef = useRef(coordinateKey);
    const locatedStops = useMemo(() => routeLocatedStopsFromKey(coordinateKey), [coordinateKey]);
    const center = useMemo(() => routeMapCenter(locatedStops), [locatedStops]);

    useEffect(() => {
        coordinateKeyRef.current = coordinateKey;
    }, [coordinateKey]);

    useEffect(() => {
        fallbackPointsRef.current = fallbackPoints;
    }, [fallbackPoints]);

    useEffect(() => {
        stopsRef.current = stops;
    }, [stops]);

    const updateProjectedPoints = useCallback(() => {
        const map = leafletMapRef.current;
        if (!map) {
            onPointsChange(fallbackPointsRef.current);
            return;
        }
        const size = map.getSize();
        if (!size.x || !size.y) {
            onPointsChange(fallbackPointsRef.current);
            return;
        }
        const nextPoints = stopsRef.current.map((stop, index) => {
            const lat = Number(stop.lat);
            const lon = Number(stop.lon);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
                return fallbackPointsRef.current[index] ?? { x: 50, y: 50 };
            }
            const point = map.latLngToContainerPoint([lat, lon]);
            return {
                x: Math.max(-20, Math.min(120, (point.x / size.x) * 100)),
                y: Math.max(-20, Math.min(120, (point.y / size.y) * 100)),
            };
        });
        onPointsChange(nextPoints);
    }, [onPointsChange]);

    useEffect(() => {
        let mounted = true;
        let frameId = 0;
        leafletMapRef.current?.remove();
        leafletMapRef.current = null;
        if (!mapElementRef.current) return;

        loadLeaflet()
            .then((L) => {
                if (!mounted || !mapElementRef.current) return;
                const currentStops = routeLocatedStopsFromKey(coordinateKeyRef.current);
                const currentCenter = routeMapCenter(currentStops);
                const map = L.map(mapElementRef.current, {
                    zoomControl: true,
                    attributionControl: false,
                    dragging: true,
                    scrollWheelZoom: true,
                    doubleClickZoom: true,
                    boxZoom: true,
                    keyboard: true,
                    tap: true,
                }).setView(currentCenter, currentStops.length > 1 ? 12 : 13);

                const localTiles = L.tileLayer(TILE_URL, { maxZoom: 19 }).addTo(map);
                localTiles.on?.("tileerror", () => {
                    if (!map.__fallbackTilesAdded) {
                        map.__fallbackTilesAdded = true;
                        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                            maxZoom: 19,
                            attribution: "OpenStreetMap",
                        }).addTo(map);
                    }
                });

                if (currentStops.length > 1) {
                    map.fitBounds(currentStops.map((stop) => [stop.lat, stop.lon]), { padding: [64, 64] });
                }
                window.setTimeout(() => map.invalidateSize(), 0);
                leafletMapRef.current = map;
                const scheduleProjectionUpdate = () => {
                    window.cancelAnimationFrame(frameId);
                    frameId = window.requestAnimationFrame(updateProjectedPoints);
                };
                scheduleProjectionUpdate();
                map.on("zoom", scheduleProjectionUpdate);
                map.on("move", scheduleProjectionUpdate);
                map.on("zoomend", scheduleProjectionUpdate);
                map.on("moveend", scheduleProjectionUpdate);
            })
            .catch(() => {
                if (!mounted || !mapElementRef.current) return;
                mapElementRef.current.style.background = "linear-gradient(135deg,#e5e7eb,#f8fafc)";
            });

        return () => {
            mounted = false;
            window.cancelAnimationFrame(frameId);
            leafletMapRef.current?.remove();
            leafletMapRef.current = null;
        };
    }, [updateProjectedPoints]);

    useEffect(() => {
        if (leafletMapRef.current) {
            if (locatedStops.length > 1) {
                leafletMapRef.current.fitBounds(locatedStops.map((stop) => [stop.lat, stop.lon]), { padding: [64, 64] });
            } else {
                leafletMapRef.current.setView(center, 13);
            }
            window.requestAnimationFrame(updateProjectedPoints);
        }
    }, [center, coordinateKey, locatedStops, updateProjectedPoints]);

    return (
        <div className="absolute inset-0 z-0 overflow-hidden rounded-xl">
            <div ref={mapElementRef} className="h-full w-full" />
            <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-black text-gray-700 shadow-sm backdrop-blur">
                OSM 지도
            </div>
        </div>
    );
}

function SortableRouteSpotCard({
    activity,
    index,
    total,
    currency,
    selected,
    onSelect,
}: {
    activity: ItineraryActivity;
    index: number;
    total: number;
    currency: CurrencyRate;
    selected: boolean;
    onSelect: () => void;
}) {
    const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition, isDragging } = useSortable({ id: activity.id });
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.85 : 1,
        zIndex: isDragging ? 20 : undefined,
    };

    return (
        <article
            ref={setNodeRef}
            style={style}
            data-route-spot-card="true"
            onClick={onSelect}
            className={`cursor-pointer rounded-xl border bg-white p-3 shadow-sm transition hover:border-gray-400 hover:shadow-md ${
                selected ? "border-gray-950 ring-2 ring-gray-950/10" : "border-gray-200"
            }`}
        >
            <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                    <button
                        type="button"
                        ref={setActivatorNodeRef}
                        onClick={(event) => event.stopPropagation()}
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
                    <button
                        type="button"
                        onClick={onSelect}
                        className="min-w-0 truncate rounded-md px-1 text-left text-sm font-black text-gray-950 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-950/10"
                    >
                        {activity.location || `스팟 ${index + 1}`}
                    </button>
                </div>
                <button
                    type="button"
                    onClick={onSelect}
                    className="shrink-0 rounded-md px-1.5 py-1 text-xs font-black text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-950/10"
                >
                    {activity.time || "--:--"}
                </button>
            </div>
            <button
                type="button"
                onClick={onSelect}
                className="block min-h-10 w-full rounded-lg px-1 py-0.5 text-left text-sm font-semibold leading-5 text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-950/10"
            >
                <span className="line-clamp-2">
                {activity.activity || "일정 내용"}
                </span>
            </button>
            <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={onSelect}
                    className="rounded-lg bg-gray-50 px-2 py-1.5 text-xs font-black text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-950/10"
                >
                    {routeStopDuration(activity) || "소요 시간"}
                </button>
                {activity.cost > 0 && (
                    <button
                        type="button"
                        onClick={onSelect}
                        className="rounded-lg bg-emerald-50 px-2 py-1.5 text-xs font-black text-emerald-700 hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                    >
                        {formatCurrencyAmount(activity.cost, currency)}
                    </button>
                )}
            </div>
            {activity.routeRole && activity.routeRole !== "NONE" && (
                <button
                    type="button"
                    onClick={onSelect}
                    className="mt-2 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-black text-gray-700 hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-950/10"
                >
                    {routeRoleLabel(activity.routeRole)}
                </button>
            )}
            {routeStopAddress(activity) && (
                <button
                    type="button"
                    onClick={onSelect}
                    className="mt-2 block w-full truncate rounded-lg bg-gray-50 px-2 py-1.5 text-left text-[11px] font-bold text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-950/10"
                >
                    {routeStopAddress(activity)}
                </button>
            )}
        </article>
    );
}

function routeRoleLabel(role?: ItineraryActivity["routeRole"]) {
    return ROUTE_ROLE_OPTIONS.find((option) => option.value === role)?.label ?? "일반 스팟";
}

function routeStopDuration(activity: ItineraryActivity) {
    const value = activity.placeSubtitle?.trim() ?? "";
    return looksLikeAddress(value) ? "" : value;
}

function routeStopAddress(activity: ItineraryActivity) {
    const explicit = activity.address?.trim() ?? "";
    if (explicit) return explicit;
    const legacy = activity.placeSubtitle?.trim() ?? "";
    return looksLikeAddress(legacy) ? legacy : "";
}

function looksLikeAddress(value: string) {
    if (!value) return false;
    return /[,〒]|(대한민국|日本|Japan|Tokyo|서울|부산|제주|구 |시 |군 |동 |로 |길 )/.test(value);
}

function timelineDayDropId(dayId: string) {
    return `timeline-day:${dayId}`;
}

function parseTimelineDayDropId(value: string) {
    return value.startsWith("timeline-day:") ? value.slice("timeline-day:".length) : null;
}

function findActivityLocation(days: ItineraryDay[], activityId: string) {
    for (const day of days) {
        const activityIndex = day.activities.findIndex((activity) => activity.id === activityId);
        if (activityIndex >= 0) return { dayId: day.id, activityIndex };
    }
    return null;
}

function routeMarkerColor(activity: ItineraryActivity, index: number, total: number) {
    if (activity.markerColor) return activity.markerColor;
    if (index === 0) return ROUTE_MARKER_COLORS[1].value;
    if (index === total - 1) return ROUTE_MARKER_COLORS[2].value;
    return ROUTE_MARKER_COLORS[index % ROUTE_MARKER_COLORS.length].value;
}

function randomRouteMarkerColor(existingStops: ItineraryActivity[] = []) {
    const previousColor = existingStops.at(-1)?.markerColor;
    const candidates = ROUTE_MARKER_COLORS
        .map((color) => color.value)
        .filter((color) => color !== previousColor);
    return candidates[Math.floor(Math.random() * candidates.length)] ?? ROUTE_MARKER_COLORS[0].value;
}

function routeSheetLineStops(stops: ItineraryActivity[]) {
    const lodging = stops.find((stop) => stop.routeRole === "LODGING");
    const start = stops.find((stop) => stop.routeRole === "START");
    const explicitEnd = stops.find((stop) => stop.routeRole === "END");
    const end = lodging ?? explicitEnd ?? start;

    if (!start && !end) return stops;

    const middle = stops.filter((stop) => stop.id !== start?.id && stop.id !== end?.id);
    if (start) return end && end.id !== start.id ? [start, ...middle, end] : [start, ...middle, start];
    if (lodging) return [lodging, ...middle, lodging];
    return [...middle, end].filter((stop): stop is ItineraryActivity => Boolean(stop));
}

function routePointForStop(
    stop: ItineraryActivity,
    lineStops: ItineraryActivity[],
    points: Array<{ x: number; y: number }>
) {
    const lastIndex = lineStops.findLastIndex((lineStop) => lineStop.id === stop.id);
    return lastIndex >= 0 ? points[lastIndex] : null;
}

function routeLocatedStops(stops: ItineraryActivity[]) {
    return stops
        .map((stop, index) => ({
            id: stop.id,
            index,
            lat: Number(stop.lat),
            lon: Number(stop.lon),
        }))
        .filter((stop) => Number.isFinite(stop.lat) && Number.isFinite(stop.lon));
}

function routeCoordinateKey(stops: ItineraryActivity[]) {
    return routeLocatedStops(stops)
        .map((stop) => `${stop.index}:${stop.lat.toFixed(6)},${stop.lon.toFixed(6)}`)
        .join("|");
}

function routeLocatedStopsFromKey(key: string) {
    if (!key) return [];
    return key.split("|").flatMap((item) => {
        const [indexPart, coordsPart] = item.split(":");
        const [latPart, lonPart] = (coordsPart ?? "").split(",");
        const index = Number(indexPart);
        const lat = Number(latPart);
        const lon = Number(lonPart);
        if (!Number.isFinite(index) || !Number.isFinite(lat) || !Number.isFinite(lon)) return [];
        return [{ id: item, index, lat, lon }];
    });
}

function routeMapCenter(locatedStops: Array<{ lat: number; lon: number }>): LatLngTuple {
    if (locatedStops.length === 0) return [35.6812, 139.7671];
    const lat = locatedStops.reduce((sum, stop) => sum + stop.lat, 0) / locatedStops.length;
    const lon = locatedStops.reduce((sum, stop) => sum + stop.lon, 0) / locatedStops.length;
    return [lat, lon];
}

function routeSheetMapPoints(stops: ItineraryActivity[]) {
    const fallback = routeSheetPoints(stops.length);
    const locatedStops = routeLocatedStops(stops);
    if (locatedStops.length < 2) {
        return stops.map((stop, index) => {
            const located = locatedStops.find((item) => item.index === index);
            if (!located) return fallback[index] ?? fallback[fallback.length - 1];
            return { x: 50, y: 50 };
        });
    }

    const minLat = Math.min(...locatedStops.map((stop) => stop.lat));
    const maxLat = Math.max(...locatedStops.map((stop) => stop.lat));
    const minLon = Math.min(...locatedStops.map((stop) => stop.lon));
    const maxLon = Math.max(...locatedStops.map((stop) => stop.lon));
    const latRange = Math.max(maxLat - minLat, 0.001);
    const lonRange = Math.max(maxLon - minLon, 0.001);
    const padding = 12;

    return stops.map((stop, index) => {
        const lat = Number(stop.lat);
        const lon = Number(stop.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return fallback[index] ?? fallback[fallback.length - 1];
        const x = padding + ((lon - minLon) / lonRange) * (100 - padding * 2);
        const y = padding + ((maxLat - lat) / latRange) * (100 - padding * 2);
        return {
            x: Math.max(6, Math.min(94, x)),
            y: Math.max(10, Math.min(88, y)),
        };
    });
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

function routeSheetSegments(points: Array<{ x: number; y: number }>) {
    return points.slice(1).map((point, index) => {
        const previous = points[index];
        const controlX = (previous.x + point.x) / 2;
        const controlY = previous.y === point.y ? previous.y : (previous.y + point.y) / 2;
        return {
            id: `route-segment-${index}`,
            from: previous,
            to: point,
            mid: { x: controlX, y: controlY },
            path: `M ${previous.x} ${previous.y} Q ${controlX} ${controlY} ${point.x} ${point.y}`,
        };
    });
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
    if (isSpreadsheetTimeRow(rowKey)) return timeToMinutes(rowKey) ?? 0;
    return -1;
}

function spreadsheetRowKeys(days: ItineraryDay[]) {
    const timeRows = new Set<string>();
    const customRows = new Map<string, string>();
    days.forEach((day) => {
        day.activities.forEach((activity) => {
            if (isSpreadsheetTimeRow(activity.time)) timeRows.add(activity.time);
            if (activity.time.startsWith("__custom__:")) customRows.set(activity.time, activity.time);
        });
    });
    return [
        LODGING_ROW_KEY,
        ...Array.from(timeRows).sort((left, right) => (timeToMinutes(left) ?? 0) - (timeToMinutes(right) ?? 0)),
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

function spreadsheetLinkedPlaceCellClass(rowKey: string) {
    if (rowKey === LODGING_ROW_KEY) return "bg-sky-100";
    if (rowKey.startsWith("__cost__:")) return "bg-green-100";
    if (rowKey.startsWith("__custom__:")) return "bg-green-100";
    return "bg-orange-100";
}

function isSpreadsheetTimeRow(rowKey: string) {
    return normalizeSpreadsheetTime(rowKey) === rowKey;
}

function normalizeSpreadsheetTime(value: string) {
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return "";
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 24 || minute < 0 || minute > 59) return "";
    if (hour === 24 && minute !== 0) return "";
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function nextSpreadsheetTimeRow(days: ItineraryDay[]) {
    const usedMinutes = new Set<number>();
    days.forEach((day) => {
        day.activities.forEach((activity) => {
            if (!isSpreadsheetTimeRow(activity.time)) return;
            const minutes = timeToMinutes(activity.time);
            if (minutes !== null) usedMinutes.add(minutes);
        });
    });

    const lastMinute = Math.max(-60, ...Array.from(usedMinutes));
    const preferred = Math.min(lastMinute + 60, 24 * 60);
    if (!usedMinutes.has(preferred)) return formatSpreadsheetTime(preferred);

    for (let minute = 0; minute <= 24 * 60; minute += 30) {
        if (!usedMinutes.has(minute)) return formatSpreadsheetTime(minute);
    }
    return `__custom__:${createClientId("row")}:추가 시간`;
}

function formatSpreadsheetTime(totalMinutes: number) {
    const clamped = Math.min(Math.max(totalMinutes, 0), 24 * 60);
    const hour = Math.floor(clamped / 60);
    const minute = clamped % 60;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function clampTableSize(value: number, min: number, max: number) {
    if (!Number.isFinite(value)) return min;
    return Math.min(Math.max(Math.round(value), min), max);
}

function spreadsheetColumnWidth(day: ItineraryDay) {
    return clampTableSize(day.tableColumnWidth ?? DEFAULT_TABLE_COLUMN_WIDTH, MIN_TABLE_COLUMN_WIDTH, MAX_TABLE_COLUMN_WIDTH);
}

function spreadsheetRowHeight(days: ItineraryDay[], rowKey: string) {
    for (const day of days) {
        const activity = day.activities.find((item) => item.time === rowKey && item.rowHeight);
        if (activity?.rowHeight) return clampTableSize(activity.rowHeight, MIN_TABLE_ROW_HEIGHT, MAX_TABLE_ROW_HEIGHT);
    }
    return DEFAULT_TABLE_ROW_HEIGHT;
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
    const activity = spreadsheetCellActivity(day, rowKey);
    return activity?.activity || activity?.location || "";
}

function spreadsheetCellActivity(day: ItineraryDay, rowKey: string) {
    return day.activities.find((item) => item.time === rowKey);
}

function spreadsheetActivityHasPlace(activity?: ItineraryActivity) {
    if (!activity) return false;
    return Boolean(activity.placeId || (Number.isFinite(activity.lat) && Number.isFinite(activity.lon)));
}

function spreadsheetDayHasPlace(day: ItineraryDay) {
    return day.activities.some((activity) => spreadsheetActivityHasPlace(activity));
}
