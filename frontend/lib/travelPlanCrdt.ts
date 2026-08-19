import type { ChecklistItem } from "@/components/planner/TravelCheckList";
import type { ItineraryActivity, ItineraryDay } from "@/components/planner/TravelItinerary";
import type { Participant } from "@/components/planner/ParticipantsSidebar";
import { resolveTravelPlanTier, type TravelPlanDraft } from "@/lib/travelPlans";

type Identified = { id: string | number };

export function mergeTravelPlans(
    base: TravelPlanDraft,
    local: TravelPlanDraft,
    remote: TravelPlanDraft,
): TravelPlanDraft {
    return {
        ...remote,
        title: mergeValue(base.title, local.title, remote.title),
        template: mergeValue(base.template, local.template, remote.template),
        tier: mergeTier(base.tier, local.tier, remote.tier),
        checklist: mergeChecklist(base.checklist, local.checklist, remote.checklist),
        participants: mergeParticipants(base.participants, local.participants, remote.participants),
        days: mergeDays(base.days, local.days, remote.days),
        createdAt: earliestDate(base.createdAt, local.createdAt, remote.createdAt),
        updatedAt: latestDate(local.updatedAt, remote.updatedAt, new Date().toISOString()),
    };
}

export function travelPlansEqual(left: TravelPlanDraft, right: TravelPlanDraft) {
    return stableStringify(left) === stableStringify(right);
}

function mergeChecklist(base: ChecklistItem[], local: ChecklistItem[], remote: ChecklistItem[]) {
    return mergeById(base, local, remote, (baseItem, localItem, remoteItem) => ({
        ...remoteItem,
        text: mergeValue(baseItem?.text, localItem.text, remoteItem.text),
        checked: mergeValue(baseItem?.checked, localItem.checked, remoteItem.checked),
        cost: mergeValue(baseItem?.cost, localItem.cost, remoteItem.cost),
    }));
}

function mergeParticipants(base: Participant[], local: Participant[], remote: Participant[]) {
    return mergeById(base, local, remote, (baseItem, localItem, remoteItem) => ({
        ...remoteItem,
        name: mergeValue(baseItem?.name, localItem.name, remoteItem.name),
        email: mergeValue(baseItem?.email, localItem.email, remoteItem.email),
        role: mergeValue(baseItem?.role, localItem.role, remoteItem.role),
    }));
}

function mergeDays(base: ItineraryDay[], local: ItineraryDay[], remote: ItineraryDay[]) {
    return mergeById(base, local, remote, (baseDay, localDay, remoteDay) => ({
        ...remoteDay,
        date: mergeValue(baseDay?.date, localDay.date, remoteDay.date),
        dayTitle: mergeValue(baseDay?.dayTitle, localDay.dayTitle, remoteDay.dayTitle),
        activities: mergeActivities(baseDay?.activities ?? [], localDay.activities, remoteDay.activities),
    }));
}

function mergeActivities(base: ItineraryActivity[], local: ItineraryActivity[], remote: ItineraryActivity[]) {
    return mergeById(base, local, remote, (baseItem, localItem, remoteItem) => ({
        ...remoteItem,
        time: mergeValue(baseItem?.time, localItem.time, remoteItem.time),
        location: mergeValue(baseItem?.location, localItem.location, remoteItem.location),
        activity: mergeValue(baseItem?.activity, localItem.activity, remoteItem.activity),
        cost: mergeValue(baseItem?.cost, localItem.cost, remoteItem.cost),
        placeId: mergeValue(baseItem?.placeId, localItem.placeId, remoteItem.placeId),
        placeSubtitle: mergeValue(baseItem?.placeSubtitle, localItem.placeSubtitle, remoteItem.placeSubtitle),
        lat: mergeValue(baseItem?.lat, localItem.lat, remoteItem.lat),
        lon: mergeValue(baseItem?.lon, localItem.lon, remoteItem.lon),
        routeRole: mergeValue(baseItem?.routeRole, localItem.routeRole, remoteItem.routeRole),
    }));
}

function mergeById<T extends Identified>(
    base: T[],
    local: T[],
    remote: T[],
    mergeExisting: (baseItem: T | undefined, localItem: T, remoteItem: T) => T,
) {
    const baseById = byId(base);
    const localById = byId(local);
    const remoteById = byId(remote);
    const preferredOrder = orderChanged(base, local) ? local : remote;
    const ids = new Set<string>();

    preferredOrder.forEach((item) => ids.add(String(item.id)));
    local.forEach((item) => ids.add(String(item.id)));
    remote.forEach((item) => ids.add(String(item.id)));

    const merged: T[] = [];
    ids.forEach((id) => {
        const baseItem = baseById.get(id);
        const localItem = localById.get(id);
        const remoteItem = remoteById.get(id);

        if (localItem && remoteItem) {
            merged.push(mergeExisting(baseItem, localItem, remoteItem));
            return;
        }
        if (localItem && !remoteItem) {
            if (baseItem && !changed(baseItem, localItem)) return;
            merged.push(localItem);
            return;
        }
        if (!localItem && remoteItem) {
            if (baseItem && !changed(baseItem, remoteItem)) return;
            merged.push(remoteItem);
        }
    });
    return merged;
}

function mergeValue<T>(baseValue: T | undefined, localValue: T, remoteValue: T) {
    const localChanged = !same(baseValue, localValue);
    const remoteChanged = !same(baseValue, remoteValue);
    if (localChanged && !remoteChanged) return localValue;
    return remoteValue;
}

function mergeTier(
    baseTier: TravelPlanDraft["tier"],
    localTier: TravelPlanDraft["tier"],
    remoteTier: TravelPlanDraft["tier"],
) {
    return resolveTravelPlanTier(mergeValue(baseTier, localTier, remoteTier), resolveTravelPlanTier(localTier, remoteTier));
}

function byId<T extends Identified>(items: T[]) {
    return new Map(items.map((item) => [String(item.id), item]));
}

function orderChanged<T extends Identified>(base: T[], next: T[]) {
    return base.map((item) => String(item.id)).join("|") !== next.map((item) => String(item.id)).join("|");
}

function changed<T>(base: T, next: T) {
    return !same(base, next);
}

function same(left: unknown, right: unknown) {
    return stableStringify(left) === stableStringify(right);
}

function stableStringify(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    if (value && typeof value === "object") {
        return `{${Object.entries(value)
            .filter(([, entryValue]) => entryValue !== undefined)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
            .join(",")}}`;
    }
    return JSON.stringify(value);
}

function latestDate(...values: string[]) {
    return values.reduce((latest, value) => Date.parse(value) > Date.parse(latest) ? value : latest);
}

function earliestDate(...values: string[]) {
    return values.reduce((earliest, value) => Date.parse(value) < Date.parse(earliest) ? value : earliest);
}
