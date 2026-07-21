import type { Participant } from "@/components/planner/ParticipantsSidebar";
import type { ChecklistItem } from "@/components/planner/TravelCheckList";
import type { ItineraryDay } from "@/components/planner/TravelItinerary";
import { api } from "@/service/api";
import { createClientId } from "@/lib/ids";

export type TravelPlanTemplate = "basic" | "spreadsheet" | "timeline" | "route_sheet";
export type TravelPlanTier = "FREE" | "PENDING_PAID" | "PAID";
export type TravelCountryCode = "KR" | "JP";
export type CompanionType =
    | "unknown"
    | "solo"
    | "couple"
    | "friends"
    | "parents_only"
    | "family_with_young_child"
    | "family_with_child"
    | "family_with_teen"
    | "multi_generation";
export type ChildAgeBucket = "none" | "unknown" | "infant" | "toddler" | "preschool" | "lower_elementary" | "upper_elementary" | "teen";
export type GroupAgeBucket = "unknown" | "10s" | "20s" | "30s" | "40s" | "50s" | "60s_plus" | "mixed";
export type SeasonBucket = "unknown" | "spring" | "summer" | "rainy" | "autumn" | "winter";

export type TravelPlanTripContext = {
    countryCode: TravelCountryCode;
    companionType: CompanionType;
    childAgeBucket: ChildAgeBucket;
    groupAgeBucket: GroupAgeBucket;
    monthBucket: string;
    seasonBucket: SeasonBucket;
    rainySeason: boolean;
};

export type TravelPlanDraft = {
    id: string;
    title: string;
    template: TravelPlanTemplate;
    tier: TravelPlanTier;
    tripContext: TravelPlanTripContext;
    checklist: ChecklistItem[];
    days: ItineraryDay[];
    participants: Participant[];
    createdAt: string;
    updatedAt: string;
};

export type TravelPlanIndexItem = Pick<TravelPlanDraft, "id" | "title" | "template" | "tier" | "createdAt" | "updatedAt"> & {
    participantCount: number;
};

type TravelPlanApiResponse = {
    id: string;
    title: string;
    template: TravelPlanTemplate;
    tier: TravelPlanTier;
    content: Partial<TravelPlanDraft>;
    createdAt: string;
    updatedAt: string;
};

type TravelPlanPayload = {
    id: string;
    title: string;
    template: TravelPlanTemplate;
    tier: TravelPlanTier;
    content: TravelPlanDraft;
};

export function createEmptyTravelPlan(
    id: string,
    title = "신규 여행 일정표",
    template: TravelPlanTemplate = "basic",
    tier: TravelPlanTier = "FREE",
): TravelPlanDraft {
    const now = new Date().toISOString();
    return {
        id,
        title,
        template,
        tier,
        tripContext: {
            countryCode: "KR",
            companionType: "unknown",
            childAgeBucket: "unknown",
            groupAgeBucket: "unknown",
            monthBucket: "unknown",
            seasonBucket: "unknown",
            rainySeason: false,
        },
        checklist: [],
        days: [],
        participants: [],
        createdAt: now,
        updatedAt: now,
    };
}

export function createSpreadsheetTravelPlan(id: string, title = "엑셀형 여행 일정표", tier: TravelPlanTier = "FREE"): TravelPlanDraft {
    const plan = createEmptyTravelPlan(id, title, "spreadsheet", tier);
    const lodgingRow = "__lodging__";
    const timeRows = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, "0")}:00`);
    const costRows = ["아침", "점심", "저녁", "교통", "기타"];
    plan.days = Array.from({ length: 5 }, (_, dayIndex) => ({
        id: createClientId("day"),
        date: "",
        dayTitle: `Day ${dayIndex + 1}`,
        activities: [
            {
                id: createClientId("activity"),
                time: lodgingRow,
                location: "",
                activity: "",
                cost: 0,
                routeRole: "LODGING" as const,
            },
            ...timeRows.map((time) => ({
                id: createClientId("activity"),
                time,
                location: "",
                activity: "",
                cost: 0,
                routeRole: "NONE" as const,
            })),
            ...costRows.map((label) => ({
                id: createClientId("activity"),
                time: `__cost__:${label}`,
                location: "",
                activity: "",
                cost: 0,
                routeRole: "NONE" as const,
            })),
        ],
    }));
    return plan;
}

export async function loadTravelPlan(id: string): Promise<TravelPlanDraft | null> {
    try {
        const response = await api.get<TravelPlanApiResponse>(`/api/travel-plans/${encodeURIComponent(id)}`);
        return fromApi(response.data);
    } catch {
        return null;
    }
}

export async function saveTravelPlan(plan: TravelPlanDraft) {
    const updated = normalizePlan({ ...plan, updatedAt: new Date().toISOString() });
    const response = await api.put<TravelPlanApiResponse>(
        `/api/travel-plans/${encodeURIComponent(updated.id)}`,
        toPayload(updated),
    );
    return fromApi(response.data);
}

export function saveTravelPlanBeforeUnload(plan: TravelPlanDraft) {
    if (typeof window === "undefined") return false;
    const updated = normalizePlan({ ...plan, updatedAt: new Date().toISOString() });
    const url = `/api/travel-plans/${encodeURIComponent(updated.id)}/autosave`;
    const body = JSON.stringify(toPayload(updated));
    const blob = new Blob([body], { type: "application/json" });

    if (navigator.sendBeacon?.(url, blob)) return true;

    void fetch(url, {
        method: "POST",
        body,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        keepalive: true,
    });
    return true;
}

export async function updateTravelPlanTier(id: string, tier: TravelPlanTier) {
    const plan = await loadTravelPlan(id);
    if (!plan) return null;
    return saveTravelPlan({ ...plan, tier });
}

export async function deleteTravelPlan(id: string) {
    await api.delete(`/api/travel-plans/${encodeURIComponent(id)}`);
}

export async function loadTravelPlanIndex(): Promise<TravelPlanIndexItem[]> {
    const response = await api.get<TravelPlanIndexItem[]>("/api/travel-plans");
    return response.data;
}

export function createTimelineTravelPlan(id: string, title = "트립 보드 여행 일정", tier: TravelPlanTier = "FREE"): TravelPlanDraft {
    const plan = createEmptyTravelPlan(id, title, "timeline", tier);
    plan.days = ["도착과 적응", "핵심 코스", "여유와 귀가"].map((dayTitle, dayIndex) => ({
        id: createClientId("day"),
        date: "",
        dayTitle: `Day ${dayIndex + 1} · ${dayTitle}`,
        activities: [
            {
                id: createClientId("activity"),
                time: dayIndex === 0 ? "10:00" : "09:30",
                location: "",
                activity: dayIndex === 0 ? "체크인 전 가볍게 둘러보기" : "오늘의 메인 스팟",
                cost: 0,
                routeRole: dayIndex === 0 ? "START" : "NONE",
            },
            {
                id: createClientId("activity"),
                time: "13:00",
                location: "",
                activity: "점심과 주변 산책",
                cost: 0,
                routeRole: "NONE",
            },
            {
                id: createClientId("activity"),
                time: dayIndex === 2 ? "17:00" : "19:00",
                location: "",
                activity: dayIndex === 2 ? "기념품 정리와 이동" : "저녁 코스",
                cost: 0,
                routeRole: dayIndex === 2 ? "END" : "NONE",
            },
        ],
    }));
    return plan;
}

export function createRouteSheetTravelPlan(id: string, title = "Route Plan 여행 일정", tier: TravelPlanTier = "FREE"): TravelPlanDraft {
    const plan = createEmptyTravelPlan(id, title, "route_sheet", tier);
    plan.days = [{
        id: createClientId("day"),
        date: "",
        dayTitle: "DAY 1",
        activities: [
            routeSheetStop("09:00", "첫 번째 장소", "도착 및 주변 둘러보기", "40분", "START", "#16a34a"),
            routeSheetStop("11:00", "두 번째 장소", "대표 스팟 방문", "1시간", "NONE", "#2563eb"),
            routeSheetStop("13:00", "점심 장소", "식사와 휴식", "1시간 20분", "NONE", "#d97706"),
            routeSheetStop("15:30", "세 번째 장소", "예약 일정 진행", "1시간", "NONE", "#7c3aed"),
            routeSheetStop("18:00", "마지막 장소", "저녁 일정 후 이동", "50분", "END", "#e11d48"),
        ],
    }];
    return plan;
}

function routeSheetStop(
    time: string,
    location: string,
    activity: string,
    duration: string,
    routeRole: "NONE" | "START" | "END" = "NONE",
    markerColor?: string,
): ItineraryDay["activities"][number] {
    return {
        id: createClientId("activity"),
        time,
        location,
        activity,
        cost: 0,
        placeSubtitle: duration,
        markerColor,
        routeRole,
    };
}

export async function loadSharedTravelPlanIndex(): Promise<TravelPlanIndexItem[]> {
    const response = await api.get<TravelPlanIndexItem[]>("/api/travel-plans/shared");
    return response.data;
}

export function travelPlanNodeLimit(plan: Pick<TravelPlanDraft, "tier">) {
    return plan.tier === "PAID" ? 20 : 10;
}

export function generatePlanId() {
    return createClientId("plan");
}

function toPayload(plan: TravelPlanDraft): TravelPlanPayload {
    return {
        id: plan.id,
        title: plan.title,
        template: plan.template,
        tier: plan.tier,
        content: plan,
    };
}

function fromApi(response: TravelPlanApiResponse): TravelPlanDraft {
    return normalizePlan({
        ...response.content,
        id: response.id,
        title: response.title,
        template: response.template,
        tier: response.tier,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt,
    });
}

function normalizePlan(plan: Partial<TravelPlanDraft> & { id: string }): TravelPlanDraft {
    const now = new Date().toISOString();
    return {
        id: plan.id,
        title: plan.title ?? "여행 계획",
        template: plan.template ?? "basic",
        tier: plan.tier ?? "FREE",
        tripContext: {
            countryCode: plan.tripContext?.countryCode ?? "KR",
            companionType: plan.tripContext?.companionType ?? "unknown",
            childAgeBucket: plan.tripContext?.childAgeBucket ?? "unknown",
            groupAgeBucket: plan.tripContext?.groupAgeBucket ?? "unknown",
            monthBucket: plan.tripContext?.monthBucket ?? "unknown",
            seasonBucket: plan.tripContext?.seasonBucket ?? "unknown",
            rainySeason: Boolean(plan.tripContext?.rainySeason),
        },
        checklist: plan.checklist ?? [],
        days: plan.days ?? [],
        participants: plan.participants ?? [],
        createdAt: plan.createdAt ?? now,
        updatedAt: plan.updatedAt ?? now,
    };
}
