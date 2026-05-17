import type { ChecklistItem } from "@/components/planner/TravelCheckList";
import type { ItineraryDay } from "@/components/planner/TravelItinerary";
import type { Participant } from "@/components/planner/ParticipantsSidebar";

export type TravelPlanDraft = {
    id: string;
    title: string;
    template: "basic";
    checklist: ChecklistItem[];
    days: ItineraryDay[];
    participants: Participant[];
    createdAt: string;
    updatedAt: string;
};

const INDEX_KEY = "infp.travelPlans.index";
const planKey = (id: string) => `infp.travelPlans.${id}`;

export function createEmptyTravelPlan(id: string, title = "신규 여행 일정표"): TravelPlanDraft {
    const now = new Date().toISOString();
    return {
        id,
        title,
        template: "basic",
        checklist: [],
        days: [],
        participants: [],
        createdAt: now,
        updatedAt: now,
    };
}

export function loadTravelPlan(id: string): TravelPlanDraft | null {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(planKey(id));
    if (!raw) return null;
    try {
        return JSON.parse(raw) as TravelPlanDraft;
    } catch {
        return null;
    }
}

export function saveTravelPlan(plan: TravelPlanDraft) {
    if (typeof window === "undefined") return;
    const updated = { ...plan, updatedAt: new Date().toISOString() };
    window.localStorage.setItem(planKey(updated.id), JSON.stringify(updated));
    const index = loadTravelPlanIndex().filter((item) => item.id !== updated.id);
    index.unshift({
        id: updated.id,
        title: updated.title,
        updatedAt: updated.updatedAt,
        createdAt: updated.createdAt,
    });
    window.localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

export function loadTravelPlanIndex(): Array<Pick<TravelPlanDraft, "id" | "title" | "createdAt" | "updatedAt">> {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    try {
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

export function generatePlanId() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
