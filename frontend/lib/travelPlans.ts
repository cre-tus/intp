import type { ChecklistItem } from "@/components/planner/TravelCheckList";
import type { ItineraryDay } from "@/components/planner/TravelItinerary";
import type { Participant } from "@/components/planner/ParticipantsSidebar";

export type TravelPlanDraft = {
    id: string;
    title: string;
    template: "basic" | "spreadsheet";
    checklist: ChecklistItem[];
    days: ItineraryDay[];
    participants: Participant[];
    createdAt: string;
    updatedAt: string;
};

const INDEX_KEY = "infp.travelPlans.index";
const planKey = (id: string) => `infp.travelPlans.${id}`;

export function createEmptyTravelPlan(
    id: string,
    title = "신규 여행 일정표",
    template: TravelPlanDraft["template"] = "basic"
): TravelPlanDraft {
    const now = new Date().toISOString();
    return {
        id,
        title,
        template,
        checklist: [],
        days: [],
        participants: [],
        createdAt: now,
        updatedAt: now,
    };
}

export function createSpreadsheetTravelPlan(id: string, title = "엑셀형 여행 일정표"): TravelPlanDraft {
    const plan = createEmptyTravelPlan(id, title, "spreadsheet");
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
        template: updated.template,
        participantCount: updated.participants.length,
        updatedAt: updated.updatedAt,
        createdAt: updated.createdAt,
    });
    window.localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

export function deleteTravelPlan(id: string) {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(planKey(id));
    const index = loadTravelPlanIndex().filter((item) => item.id !== id);
    window.localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

export function loadTravelPlanIndex(): Array<Pick<TravelPlanDraft, "id" | "title" | "template" | "createdAt" | "updatedAt"> & { participantCount: number }> {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    try {
        return (JSON.parse(raw) as Array<Partial<TravelPlanDraft> & { id: string; participantCount?: number }>).map((item) => {
            const fullPlan = loadTravelPlan(item.id);
            return {
                id: item.id,
                title: item.title ?? fullPlan?.title ?? "여행 계획",
                template: item.template ?? fullPlan?.template ?? "basic",
                participantCount: item.participantCount ?? fullPlan?.participants.length ?? 0,
                createdAt: item.createdAt ?? fullPlan?.createdAt ?? new Date().toISOString(),
                updatedAt: item.updatedAt ?? fullPlan?.updatedAt ?? new Date().toISOString(),
            };
        });
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
