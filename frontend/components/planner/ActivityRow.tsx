import React, { useState } from "react";
import type { ItineraryActivity } from "./TravelItinerary";
import TimeField from "@/components/planner/ActivityField/TimeField";
import LocationField from "@/components/planner/ActivityField/LocationField";
import ActivityField from "@/components/planner/ActivityField/ActivityField";
import CostField from "@/components/planner/ActivityField/CostField";
import DeleteButton from "@/components/planner/ActivityField/DeleteButton";
import PlaceSearchModal from "@/components/planner/ActivityField/PlaceSerachModal";
import { Pin } from "lucide-react";

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
}) {
    const { activity, index, error } = props;
    const [placeOpen, setPlaceOpen] = useState(false);

    return (
        <div className="group flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 transition-all hover:border-gray-900 hover:shadow-md">
            <div
                ref={(el) => props.dragHandleProps?.setActivatorNodeRef?.(el)}
                {...(props.dragHandleProps?.attributes ?? {})}
                {...(props.dragHandleProps?.listeners ?? {})}
                className="flex h-8 w-8 flex-shrink-0 cursor-grab select-none items-center justify-center rounded-full bg-gradient-to-br from-gray-900 to-gray-700 text-sm font-bold text-white shadow-sm active:cursor-grabbing"
                aria-label="일정 순서 변경"
            >
                {index + 1}
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

            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <Pin className="h-4 w-4 flex-shrink-0 text-gray-600" />
                <select
                    value={activity.routeRole ?? "NONE"}
                    onChange={(event) => props.onChangeField("routeRole", event.target.value)}
                    className="bg-transparent text-sm font-medium text-gray-800 focus:outline-none"
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
