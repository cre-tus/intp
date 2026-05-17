import React, {useState} from "react";
import type { ItineraryActivity } from "./TravelItinerary";
import TimeField from "@/components/planner/ActivityField/TimeField";
import LocationField from "@/components/planner/ActivityField/LocationField";
import ActivityField from "@/components/planner/ActivityField/ActivityField";
import CostField from "@/components/planner/ActivityField/CostField";
import DeleteButton from "@/components/planner/ActivityField/DeleteButton";
import PlaceSearchModal from "@/components/planner/ActivityField/PlaceSerachModal";

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

    dragHandleProps?: DragHandleProps; // ✅ 추가
}) {
    const { activity, index, error } = props;
    const [placeOpen, setPlaceOpen] = useState(false);

    return (
        <div className="flex gap-3 items-center group bg-white p-3 rounded-lg border border-gray-200 hover:border-gray-900 hover:shadow-md transition-all">
            {/* ✅ 번호 = 드래그 핸들 */}
            <div
                ref={(el) => props.dragHandleProps?.setActivatorNodeRef?.(el)}
                {...(props.dragHandleProps?.attributes ?? {})}
                {...(props.dragHandleProps?.listeners ?? {})}
                className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-gray-900 to-gray-700 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-sm cursor-grab active:cursor-grabbing select-none"
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

            <LocationField
                value={activity.location}
                onOpen={() => setPlaceOpen(true)}
            />

            <PlaceSearchModal
                open={placeOpen}
                onClose={() => setPlaceOpen(false)}
                initialQuery={activity.location}
                onSelect={(p) => {
                    props.onChangeField("location", p.title);
                    props.onChangeField("placeId", p.id);
                    props.onChangeField("placeSubtitle", p.subtitle);
                    props.onChangeField("lat", p.lat);
                    props.onChangeField("lon", p.lon);
                }}
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
