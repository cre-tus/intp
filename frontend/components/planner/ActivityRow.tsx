import React from "react";
import type { ItineraryActivity } from "./TravelItinerary";

import TimeField from "@/components/planner/ActivityField/TimeField";
import LocationField from "@/components/planner/ActivityField/LocationField";
import ActivityField from "@/components/planner/ActivityField/ActivityField";
import CostField from "@/components/planner/ActivityField/CostField";
import DeleteButton from "@/components/planner/ActivityField/DeleteButton";

type ActivityError = { message: string } | null;

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
}) {
    const { activity, index, error } = props;

    return (
        <div className="flex gap-3 items-center group bg-white p-3 rounded-lg border border-gray-200 hover:border-gray-900 hover:shadow-md transition-all">
            {/* 번호 */}
            <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-gray-900 to-gray-700 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-sm">
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

            <LocationField
                value={activity.location}
                onChange={(next) => props.onChangeField("location", next)}
            />

            <ActivityField
                value={activity.activity}
                onChange={(next) => props.onChangeField("activity", next)}
            />

            <CostField
                value={activity.cost}
                onChange={(next) => props.onChangeField("cost", next)}
            />

            <DeleteButton onClick={props.onRemove} />
        </div>
    );
}
