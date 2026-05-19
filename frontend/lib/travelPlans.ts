import type { Participant } from "@/components/planner/ParticipantsSidebar";
import type { ChecklistItem } from "@/components/planner/TravelCheckList";
import type { ItineraryDay } from "@/components/planner/TravelItinerary";
import { api } from "@/service/api";

export type TravelPlanTemplate = "basic" | "spreadsheet";
export type TravelPlanTier = "FREE" | "PENDING_PAID" | "PAID";

export type TravelPlanDraft = {
    id: string;
    title: string;
    template: TravelPlanTemplate;
    tier: TravelPlanTier;
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
        id: crypto.randomUUID(),
        date: "",
        dayTitle: `Day ${dayIndex + 1}`,
        activities: [
            {
                id: crypto.randomUUID(),
                time: lodgingRow,
                location: "",
                activity: "",
                cost: 0,
                routeRole: "LODGING" as const,
            },
            ...timeRows.map((time) => ({
                id: crypto.randomUUID(),
                time,
                location: "",
                activity: "",
                cost: 0,
                routeRole: "NONE" as const,
            })),
            ...costRows.map((label) => ({
                id: crypto.randomUUID(),
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

export function travelPlanNodeLimit(plan: Pick<TravelPlanDraft, "tier">) {
    return plan.tier === "PAID" ? 20 : 10;
}

export function generatePlanId() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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
        checklist: plan.checklist ?? [],
        days: plan.days ?? [],
        participants: plan.participants ?? [],
        createdAt: plan.createdAt ?? now,
        updatedAt: plan.updatedAt ?? now,
    };
}
